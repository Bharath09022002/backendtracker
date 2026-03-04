const express = require('express');
const { z } = require('zod');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const router = express.Router();

const postSchema = z.object({
    content: z.string().trim().min(1, 'Post content is required').max(1000, 'Post is too long')
});

const commentSchema = z.object({
    text: z.string().trim().min(1, 'Comment text is required').max(500, 'Comment is too long')
});

// Get Feed (Paginated)
router.get('/feed', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const posts = await Post.find()
            .populate('userId', 'fullName profilePicture shortId')
            .populate('comments.userId', 'fullName profilePicture shortId')
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .lean();

        const total = await Post.countDocuments();

        const postsWithIsLiked = posts.map(post => ({
            ...post,
            isLiked: Array.isArray(post.likes) && post.likes.some(id => id.toString() === req.user.id)
        }));

        res.json({
            posts: postsWithIsLiked,
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

        const socket = require('../utils/socket');
        socket.emitToAll('post_stats_updated', {
            postId: post._id,
            likesCount: post.likes.length
        });

        res.json({ likes: post.likes.length, isLiked: index === -1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Comment
router.post('/posts/:postId/comment', auth, async (req, res) => {
    try {
        const validatedData = commentSchema.parse(req.body);
        const { text } = validatedData;

        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        post.comments.push({ userId: req.user.id, text });
        await post.save();

        const updatedPost = await Post.findById(req.params.postId).populate('comments.userId', 'fullName profilePicture').lean();

        const socket = require('../utils/socket');
        socket.emitToAll('post_comments_updated', {
            postId: post._id,
            commentsCount: updatedPost.comments.length
        });

        res.json(updatedPost.comments);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
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
