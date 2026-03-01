const express = require('express');
const { z } = require('zod');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const router = express.Router();

const postSchema = z.object({
    content: z.string().min(1, 'Post content is required')
});

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
        const validatedData = postSchema.parse(req.body);
        const post = new Post({ userId: req.user.id, content: validatedData.content });
        await post.save();
        res.status(201).json(post);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
