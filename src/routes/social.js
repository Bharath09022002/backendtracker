const express = require('express');
const { z } = require('zod');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const router = express.Router();

const postSchema = z.object({
    content: z.string().min(1, 'Post content is required')
});

// Get Feed (Paginated)
router.get('/feed', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const posts = await Post.find()
            .populate('userId', 'fullName profilePicture')
            .populate('comments.userId', 'fullName profilePicture')
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);

        const total = await Post.countDocuments();

        res.json({
            posts,
            hasMore: offset + posts.length < total,
            total
        });
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

// Toggle Like
router.post('/posts/:postId/like', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const index = post.likes.indexOf(req.user.id);
        if (index === -1) {
            post.likes.push(req.user.id);
        } else {
            post.likes.splice(index, 1);
        }

        await post.save();
        res.json({ likes: post.likes.length, isLiked: index === -1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Comment
router.post('/posts/:postId/comment', auth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Comment text is required' });

        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        post.comments.push({ userId: req.user.id, text });
        await post.save();

        const updatedPost = await Post.findById(req.params.postId).populate('comments.userId', 'fullName profilePicture');
        res.json(updatedPost.comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Post
router.delete('/posts/:postId', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        if (post.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to delete this post' });
        }

        await Post.findByIdAndDelete(req.params.postId);
        res.json({ message: 'Post deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
