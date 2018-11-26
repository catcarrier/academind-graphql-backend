const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const MONGDB_URI = 'mongodb://localhost:27017/messages';
const path = require('path');

const app = express();


app.use(bodyParser.urlencoded({ extended: false })); // x-www.form-urlencoded form
app.use(bodyParser.json());
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'images') },
    filename: (req, file, cb) => {
        // for Windows: remove colons

        const newFilename = new Date()
            .toISOString()
            .replace(/:/g, '-')
            .replace(/\s/g, '') + '-' + file.originalname.replace(/\\/g, '/').replace(/\s/g, '');

        cb(null, newFilename);
    }
})

const fileFilter = (req, file, cb) => {
    if (['image/jpg', 'image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) {
        //console.log('file is ok', file)
        cb(null, true);
    } else {
        //console.log('rejecting ', file)
        cb(null, false);
    }
}

app.use(
    multer({
        storage: fileStorage,
        fileFilter: fileFilter
    })
        .single('image')
);

app.use('/images', express.static(path.join(__dirname, 'images')));
const feedRoutes = require('./routes/feed');

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/feed', feedRoutes);

app.use((err, req, res, next) => {
    console.log(err);
    const statusCode = err.statusCode || 500;
    const message = err.message;
    res.status(statusCode).json({
        message: message
    })
});

mongoose.connect(MONGDB_URI, { useNewUrlParser: true }, (err) => {
    if (err) {
        console.log(err)
    } else {
        app.listen(8080);
    }
})

