const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { validationResult } = require('express-validator/check');

exports.signup = (req, res, next) => {

    // check validation errors returned by the route handler
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error(errors.array()[0]);
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }

    email = req.body.email;
    name = req.body.name;
    password = req.body.password;

    // encrypt the password
    bcrypt
        .hash(password, 12)
        .then(hash => {
            const user = new User({
                email: email,
                password: hash,
                name: name
            });
            return user.save();
        })
        .then(user => {
            res.status(201).json({ message: 'User created', userId: user._id });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        })

}

exports.login = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    let loadedUser;

    User.findOne({ email: email })
        .then(user => {
            if (!user) {
                const err = new Error('No user matching this email');
                err.statusCode = 401;
                next(err);
            }
            loadedUser = user;
            return bcrypt.compare(password, user.password)
        })
        .then(match => {
            if (!match) {
                const err = new Error('Password does not match');
                err.statusCode = 401;
                next(err);
            }

            // TODO import the secret and reuse
            const token = jwt.sign({
                email: loadedUser.email,
                userId: loadedUser._id.toString()
            }, 'secret secret hush hush on the QT', { expiresIn: '1h' });
            res.status(200).json({ token: token, userId: loadedUser._id.toString() })
        })
        .catch(err => {
            if (!err.statusCode) { err.statuscode = 500 }
            next(err);
        })

};