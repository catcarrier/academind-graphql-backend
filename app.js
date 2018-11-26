const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const MONGDB_URI = 'mongodb://localhost:27017/messages';
const path = require('path');

const app = express();

app.use(bodyParser.json());
app.use('/images', express.static(path.join(__dirname, 'images')));
const feedRoutes = require('./routes/feed');

app.use((req, res ,next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/feed', feedRoutes);

app.use((err, req, res, next) => {
    console.log(err);
    const statusCode = err.statusCode || 500;
    const message = err.message;
    res.status(statusCode).json({
        message:message
    })
});

mongoose.connect(MONGDB_URI, (err) => {
    if(err) { 
        console.log(err)
    } else {
        app.listen(8080);
    }
})

