const User = require('../models/user');
const Post = require('../models/post');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

module.exports = {
    createUser: async function (args, req) {
        const email = args.userInput.email;
        const name = args.userInput.name;
        const password = args.userInput.password;

        // Validation must be done here in the resolver, becuase with
        // Graphql there are no routes to which we can attach validation middleware
        const errors = [];
        if (!validator.isEmail(email)) {
            errors.push({ message: "email is no good" })
        }
        if (validator.isEmpty(password) || !validator.isLength(password, { min: 5 })) {
            errors.push({ message: "password must be 5+ characters" });
        }

        // TODO more validation

        if (errors.length > 0) {
            const error = new Error('Invalid input');
            error.data = errors;
            error.statusCode = 422;
            throw error;
        }


        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            const error = new Error('User exists!');
            throw error;
        }

        const hash = await bcrypt.hash(password, 12);
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
    login: async function (args, req) {
        const email = args.email;
        const password = args.password;

        // check for user
        const user = await User.findOne({ email: email });
        if (!user) {
            const error = new Error('User not found');
            error.code = 401;
            throw error;
        }

        // Compare password arg with hashed version stored on the user object
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const error = new Error('Unable to authenticate');
            error.code = 401;
            throw error;
        }

        // Create token
        const token = jwt.sign({
            userId: user._id.toString(),
            email: user.email
        }, 'secret secret hush hush on the QT', { expiresIn: '1h' });

        // Return objct must match the AuthData pattern in schema.js:
        // type AuthData {
        //     token: String!
        //     userId: String!
        // }
        return {
            token: token,
            userId: user._id.toString()
        }

    },
    createPost: async function (args, req) {

        if (!req.isAuth) { /* see middleware just before graphql handler */
            const error = new Error('Not authenticated');
            error.statusCode = 401;
            throw error;
        }

        const input = args.postInput;

        const errors = [];
        if (validator.isEmpty(input.title)) {
            errors.push(new Error('title is required'));
        }
        if (validator.isEmpty(input.content)) {
            errors.push(new Error('Post content is required'));
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input');
            error.data = errors;
            error.statusCode = 422;
            throw error;
        }

        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('Invalid user!');
            error.statusCode = 401;
            throw error;
        }

        const newPost = new Post({
            title: input.title,
            content: input.content,
            imageUrl: input.imageUrl,
            creator: user._id
        });
        const createdPost = await newPost.save();

        user.posts.push(createdPost);
        await user.save();

        // Return must have the post _id as String, as GraphQL does not know about mongo _ids.
        // Return must have the date fields as String, as GraphQL does not know about dates.
        const returnObject = {
            ...createdPost._doc,
            _id: createdPost._id.toString(),
            creator: user,
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString()
        };

        return returnObject;
    },
    getPosts: async function ({currentPage}, req) {

        if (!req.isAuth) {
            const error = new Error('User not authenticated');
            error.code = 401;
            throw error;
        }

        if(!currentPage) { currentPage = 1 }

        const PER_PAGE = 3;
        let totalPosts = await Post.find().countDocuments();
        const posts = await Post.find()
            .populate('creator', 'name -_id')
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * PER_PAGE)
            .limit(PER_PAGE);

        return {
            totalPosts: totalPosts,
            posts: posts.map(p => {
                return {
                    ...p._doc,
                    _id: p._id.toString(),
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString()
                }
            })
        }
    }
}