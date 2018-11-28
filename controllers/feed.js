const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator/check');
const User = require('../models/user');
const Post = require('../models/post');

exports.getPosts = (req, res, next) => {
    const currentPage = req.query.page || 1;
    const PER_PAGE = 2; // TODO share between back and front end
    let totalItems;
    Post.find()
        .countDocuments()
        .then(result => {
            totalItems = result;
            return Post.find()
                .skip((currentPage - 1) * PER_PAGE)
                .limit(PER_PAGE);
        })
        .then(posts => {
            res.status(200).json({
                message: 'OK',
                posts: posts,
                totalItems: totalItems
            });
        })
        .catch(err => {
            if (!err.statusCode) { err.statusCode = 500; }
            return next(err);
        });
}

exports.getPost = (req, res, next) => {

    //console.log('req.params is -> ', req.params)

    //console.log('req.params.postId -> ', req.params.postId)

    const postId = req.params.postId;
    Post.findById({ _id: require('mongoose').Types.ObjectId(postId) })
        .then(post => {
            //console.log(post);
            if (!post) {
                const error = new Error('No such post!')
                error.statusCode = 404;
                throw error;
            }
            res.status(200).json({ message: "ok", post: post });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        })
}

exports.createPost = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed - data not correct');
        error.statusCode = 422;
        throw (error); // synchronous, use throw
    }

    // file upload is required
    if (!req.file) {
        const error = new Error('Image upload is required, not found');
        error.statusCode = 422;
        throw (error);
    }

    const title = req.body.title;
    const content = req.body.content;
    const imageUrl = req.file.path.replace(/\\/g, '/');

    const post = new Post({
        title: title,
        imageUrl: imageUrl,
        content: content,
        creator: req.userId // mongoose will convert to ObjectId
    })

    let creator;

    post.save()
        .then(result => {
            return User.findOne({ _id: req.userId });
        })
        .then(user => {
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 401;
                return next(error);
            }
            creator = user;
            return user;
        })
        .then(user => {
            // Add this post to the user's list
            user.posts.push(post)
            return user.save();
        })
        .then(result => {
            res.status(201).json({
                message: "Post created OK",
                post: post,
                creator: { _id: creator._id, name: creator.name }
            })
        })
        .catch(err => {
            // If there is no status code, assign a 500-range.
            // Cannot throw here, as we are in a promise chain, have to call next()
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        })
}

exports.updatePost = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed - data not correct');
        error.statusCode = 422;

        // This is synchronous code, OK to throw
        throw (error);
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
        const error = new Error('No image file given for this post');
        error.errorCode = 422;
        throw (err);
    }

    Post.findById({ _id: require('mongoose').Types.ObjectId(postId) })
        .then(post => {
            if (!post) {
                const error = new Error('No matching post (' + postId + ')');
                error.errorCode = 404;
                throw error;
            }
            return post;
        })
        .then(post => {
            // Validate that the current user is the creator of this post.
            if(post.creator.toString() !== req.userId) {
                const error = new Error('Not allowed to edit this post.');
                error.errorCode = 403;
                throw error;
            }
            return post;
        })
        .then(post => {
            // If the user sent a new file, these two will not match, 
            // and we whack the old one.
            if (imageUrl /* new value */ != post.imageUrl /* old value */) {
                clearImage(post.imageUrl)
            }

            post.title = title;
            post.content = content;
            post.imageUrl = imageUrl;

            //console.log('new image ', imageUrl)

            return post.save();
        })

        .then(post => {
            res.status(200).json({ message: 'Post updated', post: post });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err); // use next() in asynch, throw() in synch
        })


}

exports.deletePost = (req, res, next) => {
    const postId = req.params.postId;
    Post.findById(postId)
        .then(post => {
            if (!post) {
                const error = new Error('No matching post (' + postId + ')');
                error.errorCode = 404;
                throw error;
            }
            return post;
        })
        .then(post => {
            // Only the post's creator can delete
            if(post.creator.toString() !== req.userId) {
                const error = new Error('Not allowed to delete this post.');
                error.errorCode = 403;
                throw error;
            }
            return post;
        })
        .then( post =>{
            // whack the image
            clearImage(post.imageUrl);
            return Post.findByIdAndRemove(postId);
        })
        .then(result => {
            // Find the user who posted that, and remove it from their post history.
            // Note that we do not assume it is the current user's User object. This
            // a precaution in case the post deletion (above) becomes role-based, and
            // not strictly limited to the post's author.
            // Note the assumption that the post appears in exactly one user's post history.
            let postObjectId = require('mongoose').Types.ObjectId(postId);
            return User.findOne({posts: postObjectId})
                .then(user => {
                    if(!user){
                        const error = new Error('Unable to remove this post from the user history.');
                        error.errorCode = 500;
                        throw error;
                    }
                    return user;
                })
                .then(user => {
                    var index = user.posts.indexOf(postObjectId);
                    user.posts.splice(index, 1);
                    return user.save();
                })
        })
        .then(result => {  
            res.status(200).json({ message: 'Post deleted' });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        })
}

const clearImage = (filePath) => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => { if (err) { console.log(err) } });
};