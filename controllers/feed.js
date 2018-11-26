const { validationResult } = require('express-validator/check');

const Post = require('../models/post');

exports.getPosts = (req, res, next) => {
    Post.find()
        .then(posts => {
            res.status(200).json({message:'OK', posts:posts});
        })
        .catch(err => {
            if(!err.statusCode){ err.statusCode = 500}
            next(err);
        })
}

exports.getPost = (req, res, next) => {

    //console.log('req.params is -> ', req.params)

    //console.log('req.params.postId -> ', req.params.postId)

    const postId = req.params.postId;
    Post.findById({_id: require('mongoose').Types.ObjectId(postId)})
    .then(post => {
        //console.log(post);
        if(!post) {
            const error = new Error('No such post!')
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({message:"ok", post:post});
    })
    .catch(err => {
        if(!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    })
}

exports.createPost = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error( 'Validation failed - data not correct' );
        error.statusCode = 422;

        // This is synchronous code, OK to throw
        throw(error);
    }

    const title = req.body.title;
    const content = req.body.content;

    const post = new Post({
        title: title,
        imageUrl: 'images/bug.jpg',
        content: content,
        creator: { name: 'Thomas' }
    })
    post.save()
        .then(result => {
            console.log(result);
            res.status(201).json({
                message: "Post created OK",
                post: result
            })
        })
        .catch(err => {
            // If there is no status code, assign a 500-range.
            // Cannot throw here, as we are in a promise chain, have to call next()
            if(!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        })

}