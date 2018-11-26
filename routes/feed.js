const express = require('express');
const { body } = require('express-validator/check');

const router = express.Router();

const feedController = require('../controllers/feed');



router.get('/posts', feedController.getPosts);

router.post('/post', [
    body('title', 'Title must be at least seven chars')
        .trim()
        .isLength({min:7}),
    body('content','Content must not be empty')
        .trim()
        .isLength({min:1})
], feedController.createPost);

router.get('/post/:postId', feedController.getPost);


module.exports = router;