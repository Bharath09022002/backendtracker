const express = require('express');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const router = express.Router();

// Get Feed
router.get('/feed', auth, async (req, res) => {
    try {
        const posts = await Post.find().populate('userId', 'fullName profilePicture').sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Post
router.post('/posts', auth, async (req, res) => {
    try {
        const post = new Post({ userId: req.user.id, content: req.body.content });
        await post.save();
        res.status(201).json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
