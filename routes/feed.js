const express = require('express');
const { body } = require('express-validator/check');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

const feedController = require('../controllers/feed');

router.get('/posts', [isAuth], feedController.getPosts);

router.post('/post', [
    isAuth,
    body('title', 'Title must be at least seven chars')
        .trim()
        .isLength({min:5}),
    body('content','Content must not be empty')
        .trim()
        .isLength({min:1})
], feedController.createPost);

router.get('/post/:postId', isAuth, feedController.getPost);

router.put('/post/:postId', [
    isAuth,
    body('title', 'Title must be at least seven chars')
        .trim()
        .isLength({min:5}),
    body('content','Content must not be empty')
        .trim()
        .isLength({min:1})
], feedController.updatePost);

router.delete('/post/:postId', isAuth, feedController.deletePost)

module.exports = router;