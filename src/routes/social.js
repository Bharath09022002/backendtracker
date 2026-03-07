const express = require('express');
const { z } = require('zod');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();
const { handleSafetyCheck } = require('../utils/safetyFilter');

const postSchema = z.object({
    content: z.string().trim().min(1, 'Post content is required').max(1000, 'Post is too long')
});

const commentSchema = z.object({
    text: z.string().trim().min(1, 'Comment text is required').max(500, 'Comment is too long')
});

// Get Feed (Cursor-based Pagination for O(1) performance)
router.get('/feed', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const before = req.query.before; // Cursor: timestamp to fetch posts before

        const query = {};
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        // Run posts query and total count in parallel
        const [posts, total] = await Promise.all([
            Post.find(query)
                .populate('userId', 'fullName profilePicture shortId')
                .populate('comments.userId', 'fullName profilePicture shortId')
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean(),
            Post.estimatedDocumentCount()
        ]);

        const postsWithIsLiked = posts.map(post => ({
            ...post,
            isLiked: Array.isArray(post.likes) && post.likes.some(id => id.toString() === req.user.id)
        }));

        // Calculate next cursor
        const nextCursor = posts.length > 0 ? posts[posts.length - 1].createdAt : null;

        res.json({
            posts: postsWithIsLiked,
            hasMore: posts.length === limit,
            nextCursor,
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
        const user = await User.findById(req.user.id);
        const safetyResult = await handleSafetyCheck(user, validatedData.content);
        if (safetyResult.isHarmful) {
            return res.status(403).json({
                error: safetyResult.error,
                strikes: safetyResult.strikes
            });
        }
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

// Toggle Like (Atomic operation – no race conditions)
router.post('/posts/:postId/like', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // First try to add the like (if not already present)
        let post = await Post.findOneAndUpdate(
            { _id: req.params.postId, likes: { $ne: userId } },
            { $addToSet: { likes: userId } },
            { new: true, projection: { likes: 1 } }
        ).lean();

        let isLiked = true;

        if (!post) {
            // User already liked – remove the like
            post = await Post.findOneAndUpdate(
                { _id: req.params.postId },
                { $pull: { likes: userId } },
                { new: true, projection: { likes: 1 } }
            ).lean();
            isLiked = false;
        }

        if (!post) return res.status(404).json({ error: 'Post not found' });

        const socket = require('../utils/socket');
        socket.emitToAll('post_stats_updated', {
            postId: post._id,
            likesCount: post.likes.length
        });

        res.json({ likes: post.likes.length, isLiked });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Comment
router.post('/posts/:postId/comment', auth, async (req, res) => {
    try {
        const validatedData = commentSchema.parse(req.body);
        const { text } = validatedData;

        const user = await User.findById(req.user.id);
        const safetyResult = await handleSafetyCheck(user, text);
        if (safetyResult.isHarmful) {
            return res.status(403).json({
                error: safetyResult.error,
                strikes: safetyResult.strikes
            });
        }

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
