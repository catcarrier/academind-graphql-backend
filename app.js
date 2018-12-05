const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const MONGDB_URI = 'mongodb://localhost:27017/messages';
const path = require('path');
const fs = require('fs');
const graphqlHttp = require('express-graphql');
const graphqlSchema = require('./graphql/schema.js');
const graphqlResolver = require('./graphql/resolver.js');
const auth = require('./middleware/auth');

const app = express();

app.use(bodyParser.urlencoded({ extended: false })); // x-www.form-urlencoded form
app.use(bodyParser.json());
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'images') },
    filename: (req, file, cb) => {
        // for Windows: remove colons

        const newFilename = 'img' + new Date()
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

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Graphql rejects any request that is not a POST, so the usual preflight OPTIONS check
    // will get a 405 (Not Allowed) back unless we intercept the preflight as follows.
    // Options requests do not reach the Graphql handler.
    if(req.method==='OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// sets req.isAuth to true/false based on token, but does not redirect.
// It is left up to the resolver to allow the user to continue, or not.
// This is because with graphql there are no more routes, so we do not redirect etc.
app.use(auth); 

// Becuase we are using graphql, which handles only json, we need a way
// for the user to upload an image as part of creating a post. Multer (see
// above) will have extracted the file and put in /images folder.
app.put('/postImage', (req, res, next) => {

    if(!req.isAuth) {
        const err = new Error('User not authenticated');
        err.code = 401;
        throw err;
    }

    // Request exposes file upload in the .file property. This might be
    // falsy if the user is performing an update and not changing the image.
    if(!req.file){
        return res.status(200).json({message:'No file provided.'});
    }
    if(req.body.oldPath) {
        clearImage(req.body.oldPath);
    }
    return res.status(201).json({message:'File stored', filePath:req.file.path});
})

app.use('/graphql', graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    formatError(err) {
        if(!err.originalError) {
            return err; // system-thrown error eg a nullpointer
        }
        const data = err.originalError.data;
        const message = err.message || "An error occurred";
        const code = err.originalError.statusCode | 500;
        return {
            message: message,
            status: code,
            data: data
        }
    },
    graphiql: true
}))

app.use((err, req, res, next) => {
    console.log(err);
    const statusCode = err.statusCode || 500;
    const data = err.data;
    res.status(statusCode).json({
        message: err.message,
        data: data
    })
});

mongoose.connect(MONGDB_URI, { useNewUrlParser: true }, (err) => {
    if (err) {
        console.log(err)
    } else {
        app.listen(8080);
    }
})

const clearImage = (filePath) => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => { if (err) { console.log(err) } });
};