const User = require('../models/user');
const Post = require('../models/post');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

module.exports = {
    getUserStatus: async function(args, req) {
        if(!req.isAuth) {
            return '';
        }

        const user = await User.findById(req.userId);
        return user.status;
    },
    setUserStatus: async function({newStatus}, req) {
        if(!req.isAuth) {
            return;
        }

        const user = await User.findById(req.userId);
        user.status = newStatus;
        await user.save();
        return user.status;
    },
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
            const error = new Error('User is not authenticated');
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
    getPosts: async function ({ currentPage }, req) {

        if (!req.isAuth) {
            const error = new Error('User not authenticated');
            error.code = 401;
            throw error;
        }

        if (!currentPage) { currentPage = 1 }

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
    },
    getPost: async function ({ id }, req) {
        if (!req.isAuth) {
            const error = new Error('User not authenticated');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id)
            .populate('creator', 'name -_id');
        if (!post) {
            const error = new Error('No such post');
            error.code = 404;
            throw error;
        }

        return {
            _id: post._id.toString(),
            title: post.title,
            content: post.content,
            imageUrl: post.imageUrl,
            creator: post.creator,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString()
        }

    },
    updatePost: async function ({ id, postInput }, req) {

        if (!req.isAuth) {
            const error = new Error('User not authenticated');
            error.code = 401;
            throw error;
        }

        const post = await Post.findById(id)
            .populate('creator', 'name');
        if (!post) {
            const error = new Error('No such post');
            error.code = 404;
            throw error;
        }

        // Allow edit only if current user created this post.
        if (post.creator._id.toString() !== req.userId.toString()) {
            const err = new Error('Not authorized')
            err.code = 403;
            throw err;
        }

        // Validate the updated post values
        const errors = [];
        if (validator.isEmpty(postInput.title)) {
            errors.push(new Error('title is required'));
        }
        if (validator.isEmpty(postInput.content)) {
            errors.push(new Error('Post content is required'));
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input');
            error.data = errors;
            error.statusCode = 422;
            throw error;
        }

        post.title = postInput.title;
        post.content = postInput.content;
        if (postInput.imageUrl) {
            post.imageUrl = postInput.imageUrl;
        }

        let updatedPost;
        try {
            updatedPost = await post.save();
        } catch (e) {
            console.log(e)
            throw e
        }

        // The return value replaces mongo _ids with Strings
        // becuase Graphql does not know about _ids.
        return {
            ...updatedPost._doc,
            _id: updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString()
        }

    },
    deletePost: async function ({ id }, req) {

        if (!req.isAuth) {
            const error = new Error('User not authenticated');
            error.code = 401;
            throw error;
        }

        // only post creator can delete
        const post = await Post.findById(id)
            .populate('creator', 'name');
        if (!post) {
            const error = new Error('No such post');
            error.code = 404;
            throw error;
        }

        if (post.creator._id.toString() !== req.userId.toString()) {
            const err = new Error('Not authorized')
            err.code = 403;
            throw err;
        }

        // delete the image
        clearImage(post.imageUrl);

        let removedPost;
        try {
            removedPost = await post.remove();
        } catch(e) {
            console.log(e);
            const err = new Error('Unable to delete post ' + id);
            err.code = 500;
            throw err;
        }

        // Remove this post from the user's history
        // Note the assumption that it appears in only one user's history,
        // and that the current user is that user.
        //
        // Note that user.posts is an [] of ObjectIds, not Strings, so we use == not ===.
        const user = await User.findById({_id: req.userId}); // userId is String, relying on Mongoose to cast for us
        const postIndex = user.posts.findIndex(i => i == id);
        if(postIndex > -1) {
            user.posts.splice(postIndex, 1);
            await user.save();
        }

        // Return the removed post, with dates as strings (Graphql does
        // not support mongo dates)
        return {
            ...removedPost._doc,
            _id: removedPost._id.toString(),
            createdAt: removedPost.createdAt.toISOString(),
            updatedAt: removedPost.updatedAt.toISOString()
        }
    }
     
}

const clearImage = (filePath) => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => { if (err) { console.log(err) } });
};
