const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator/check');

const Post = require('../models/post');

exports.getPosts = (req, res, next) => {
    Post.find()
        .then(posts => {
            res.status(200).json({ message: 'OK', posts: posts });
        })
        .catch(err => {
            if (!err.statusCode) { err.statusCode = 500 }
            next(err);
        })
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

        // This is synchronous code, OK to throw
        throw (error);
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
        creator: { name: 'Thomas' }
    })
    post.save()
        .then(result => {
            //console.log(result);
            res.status(201).json({
                message: "Post created OK",
                post: result
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

    Post.findById({_id: require('mongoose').Types.ObjectId(postId)})
        .then(post => {
            if(!post) {
                const error = new Error('No matching post (' + postId + ')');
                error.errorCode = 404;
                throw error;
            }

            // If the user sent a new file, these two will not match, 
            // and we whack the old one.
            if(imageUrl /* new value */ != post.imageUrl /* old value */) {
                clearImage(post.imageUrl)
            }

            post.title = title;
            post.content = content;
            post.imageUrl = imageUrl;

            console.log('new image ', imageUrl)

            return post.save();
        })
        .then(post => {
            res.status(200).json({message:'Post updated', post: post});
        })
        .catch(err => {
            if(!err.statusCode) {
                err.statusCode=500;
            }
            next(err); // use next() in asynch, throw() in synch
        })


}

exports.deletePost = (req, res, next) => {
    const postId = req.params.postId;
    Post.findById(postId)
        .then(post => {
            if(!post) {
                const error = new Error('No matching post (' + postId + ')');
                error.errorCode = 404;
                throw error;
            }

            // TODO
            // Was this posted created by the current user?

            // TODO whack the image
            clearImage(post.imageUrl);

            return Post.findByIdAndRemove(postId);
        })
        .then(result => {
            res.status(200).json({message:'Post deleted'});
        })
        .catch(err => {
            if(!err.statusCode) {
                err.statusCode=500;
            }
            next(err);
        })
}

const clearImage = (filePath) => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => {if(err) {console.log(err)}});
};