const express = require('express');
const authController = require('../controllers/auth');
const User = require('../models/user');

// allow access to the req body for validation; expose the resulting error(s) to the controller.
const { body } = require('express-validator/check');

const router = express.Router();

router.put('/signup', [
    body('name', 'name is required')
        .trim()
        .not()
        .isEmpty(),
    body('email')
        .isEmail().withMessage('valid email is required')
        .custom(value => {
            return User.findOne({email:value})
                .then(user => {
                    if(user) { return Promise.reject('Email ' + email + ' already exists.')}
                })
                .catch(err => { 
                    if(!err.errorStatus) { err.errorStatus=500; }
                })
        })
        .normalizeEmail(),
    body('password')
        .isLength({min:5}).withMessage('Password minimum 5 characters'),
], authController.signup);

// validation in controller
router.post('/login', authController.login);

module.exports = router;