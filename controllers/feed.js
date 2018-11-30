const fs = require('fs');
const path = require('path');
const io = require('../socket');
const { validationResult } = require('express-validator/check');
const User = require('../models/user');
const Post = require('../models/post');

exports.getPosts = async (req, res, next) => {
    const currentPage = req.query.page || 1;
    const PER_PAGE = 2; // TODO share between back and front end

    try {
        let totalItems = await Post.find().countDocuments();
        const posts = await Post.find()
            .populate('creator')
            .sort({createdAt:-1})
            .skip((currentPage - 1) * PER_PAGE)
            .limit(PER_PAGE);
        res.status(200).json({
            message: 'OK',
            posts: posts,
            totalItems: totalItems
        });
    } catch (e) {
        if (!e.statusCode) { e.statusCode = 500; }
        next(e);
    }
}

exports.getPost = async (req, res, next) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById({ _id: require('mongoose').Types.ObjectId(postId) });
        if (!post) {
            const err = new Error('No post found matching id ' + postId);
            err.statusCode = 404;
            throw err;
        }
        res.status(200).json({ message: "ok", post: post });
    } catch (e) {
        if (!e.statusCode) {
            e.statusCode = 500;
        }
        next(e);
    }
}

exports.createPost = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed - data not correct');
        error.statusCode = 422;
        throw error;
    }

    // file upload is required
    if (!req.file) {
        const error = new Error('Image upload is required, not found');
        error.statusCode = 422;
        throw error;
    }

    const title = req.body.title;
    const content = req.body.content;
    const imageUrl = req.file.path.replace(/\\/g, '/');

    let post = new Post({
        title: title,
        imageUrl: imageUrl,
        content: content,
        creator: req.userId // mongoose will convert to ObjectId
    })

    try {
        post = await post.save();

        // add this post to the user's history
        const user = await User.findOne({ _id: req.userId });
        user.posts.push(post._id);
        await user.save();

        // In emitting the post, append the creator-name. Without this addition, the users
        // will not see the creator-name until they fetch again.
        io.getIO().emit('posts', {action: 'create', post: {...post._doc, creator: {name: user.name}}});
        res.status(201).json({
            message: "Post created OK",
            post: post,
            creator: { _id: user._id, name: user.name }
        })
    } catch (e) {
        if (!e.statusCode) {
            e.statusCode = 500;
        }
        next(e);
    }
}

exports.updatePost = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const err = new Error('Validation failed - data not correct');
        err.statusCode = 422;
        throw err;
    }

    const postId = req.params.postId;
    const title = req.body.title;
    const content = req.body.content;

    // If the user did not pick a new file, the request body will contain
    // the existing filename...
    let imageUrl = req.body.image;

    // ...otherwise req.file will be set, and this is the new file
    if (req.file) {
        imageUrl = req.file.path.replace(/\\/g, '/');
    }

    // At least one of the above should be true, so imageUrl should be set.
    if (!imageUrl) {
        const err = new Error('No image file given for this post');
        err.errorCode = 422;
        throw err;
    }

    try {
        let post = await Post.findById({ _id: require('mongoose').Types.ObjectId(postId) })
        if (!post) {
            const err = new Error('No post matching id ' + postId);
            err.errorCode = 404;
            throw err;
        }

        // Validate that the current user is the creator of this post.
        if (post.creator.toString() !== req.userId) {
            const err = new Error('Not allowed to edit this post.');
            err.errorCode = 403;
            throw err;
        }

        // If the user sent a new file, these two will not match, 
        // and we whack the old one.
        if (imageUrl /* new value */ != post.imageUrl /* old value */) {
            clearImage(post.imageUrl)
        }

        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;

        post = await post.save();

        // Look up the post creator, so we can pass that info when we emit.
        // Without this precaution, recipients would not see the creator-name
        // until they fetch the post again, becuase it's not stored with the post.
        post = await post.populate('creator', {'name':1, '_id':0}).execPopulate();
        io.getIO().emit('posts', {action: 'update', post: post});

        res.status(200).json({ message: 'Post updated', post: post });
    } catch (e) {
        if (!e.statusCode) {
            e.statusCode = 500;
        }
        next(e);
    }
}

exports.deletePost = async (req, res, next) => {
    const postId = req.params.postId;

    try {
        const post = await Post.findById(postId);
        if (!post) {
            const err = new Error('No matching post (' + postId + ')');
            err.errorCode = 404;
            throw err;
        }

        // Only the post's creator can delete
        if (post.creator.toString() !== req.userId) {
            const err = new Error('Not allowed to delete this post.');
            err.errorCode = 403;
            throw err;
        }

        clearImage(post.imageUrl);

        await Post.findByIdAndRemove(postId);

        // Find the user who posted that, and remove it from their post history.
        // Note that we do not assume it is the current user's User object. This
        // a precaution in case the post deletion (above) becomes role-based, and
        // not strictly limited to the post's author.
        // Note the assumption that the post appears in exactly one user's post history.
        let postObjectId = require('mongoose').Types.ObjectId(postId);
        const user = await User.findOne({ posts: postObjectId });

        if (!user) {
            const err = new Error('Unable to remove this post from the user history - user not found.');
            err.errorCode = 500;
            throw err;
        }

        var index = user.posts.indexOf(postObjectId);
        user.posts.splice(index, 1);
        await user.save();

        io.getIO().emit('posts', {action:'remove', _id:postId});

        res.status(200).json({ message: 'Post deleted' });
    } catch (e) {
        if (!e.statusCode) {
            e.statusCode = 500;
        }
        next(e);
    }
}

const clearImage = (filePath) => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => { if (err) { console.log(err) } });
};