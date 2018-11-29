const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { validationResult } = require('express-validator/check');

exports.signup = async (req, res, next) => {

    try {
        // check validation errors returned by the route handler
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const err = new Error(errors.array()[0]);
            err.statusCode = 422;
            err.data = errors.array();
            throw err;
        }

        const email = req.body.email;
        const name = req.body.name;
        const password = req.body.password;

        const hash = await bcrypt.hash(password, 12);
        let user = new User({
            email: email,
            password: hash,
            name: name
        });
        user = await user.save();
        res.status(201).json({ message: 'User created', userId: user._id });
    } catch (e) {
        if (!e.statusCode) {
            e.statusCode = 500;
        }
        next(e);
    }
}

exports.login = async (req, res, next) => {

    try {
        const email = req.body.email;
        const password = req.body.password;
        const user = await User.findOne({ email: email });

        if (!user) {
            const err = new Error('No user matching email ' + email);
            err.statusCode = 401;
            throw err;
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            const err = new Error('Password does not match');
            err.statusCode = 401;
            throw err;
        }

        // TODO import the secret from a shared resource, file etc
        const token = jwt.sign({
            email: user.email,
            userId: user._id.toString()
        }, 'secret secret hush hush on the QT', { expiresIn: '1h' });

        res.status(200).json({ token: token, userId: user._id.toString() })
    } catch (e) {
        if (!e.statusCode) { e.statusCode = 500 }
        next(e);
    }

};

exports.getUserStatus = async (req, res, next) => {
    try {
        const user = await User.findOne({ _id: req.userId });
        if (!user) {
            const err = new Error('No such user.');
            err.statusCode = 404;
            throw err;
        }
        res.status(200).json({ status: user.status });
    } catch (e) {
        if (!e.statusCode) { e.statusCode = 401; }
        next(err);
    }
}

exports.setUserStatus = async (req, res, next) => {
    let status = req.body.status;

    try {
        let user = await User.findOne({ _id: req.userId });
        if (!user) {
            const err = new Error('No such user.');
            err.statusCode = 404;
            throw err;
        }
        user.status = status;
        await user.save();
        res.status(200).json({ message: "OK", status: status });
    } catch (e) {
        if (!e.statusCode) { e.statusCode = 500; }
        throw e;
    }
}