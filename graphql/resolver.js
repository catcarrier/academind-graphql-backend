const User = require('../models/user');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

module.exports = {
    createUser: async function(args, req) {
        const email = args.userInput.email;
        const name = args.userInput.name;
        const password = args.userInput.password;

        // Validation must be done here in the resolver, becuase with
        // Graphql there are no routes to which we can attach validation middleware
        const errors = [];
        if(!validator.isEmail(email)) {
            errors.push({message: "email is no good"})
        }
        if(validator.isEmpty(password)|| !validator.isLength(password, {min:5})){
            errors.push({message: "password must be 5+ characters"});
        }

        // TODO more validation

        if(errors.length > 0) {
            const error = new Error('Invalid input');
            error.data = errors;
            error.statusCode = 422;
            throw error;
        }


        const existingUser = await User.findOne({email: email});
        if(existingUser) {
            const error = new Error('User exists!');
            throw error;
        }

        const hash = await bcrypt.hash(password,12);
        const newUser = new User({
            email: email,
            name: name,
            password: hash
        });

        const createdUser = await newUser.save();

        // Return a user object matching the graphql schema.
        // The schema defines id as String.
        return {
            ...createdUser._doc, _id: createdUser._id.toString()
        };
    },
    login: async function(args, req) {
        const email = args.email;
        const password = args.password;

        // check for user
        const user = await User.findOne({email:email});
        if(!user) {
            const error = new Error('User not found');
            error.code = 401;
            throw error;
        }

        // Compare password arg with hashed version stored on the user object
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch) {
            const error = new Error('Unable to authenticate');
            error.code = 401;
            throw error;
        }

        // Create token
        const token = jwt.sign({
            userId: user._id.toString(),
            email: user.email
        }, 'Super secret secret', {expiresIn: '1h'} );

        // Return objct must match the AuthData pattern in schema.js:
        // type AuthData {
        //     token: String!
        //     userId: String!
        // }
        return {
            token: token,
            userId: user._id.toString()
        }

    }
}