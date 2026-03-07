const express = require('express');
const User = require('../models/User');
const Habit = require('../models/Habit');
const Post = require('../models/Post');
// Assuming an Expense model exists based on conversation history context for salary tracking
let Expense = null;
try {
    Expense = require('../models/Expense');
} catch (e) {
    // Model not found
}

const adminAuth = require('../middleware/adminAuth');
const router = express.Router();

// @route   GET /api/admin/users
// @desc    Get all users with basic stats
// @access  Admin
router.get('/users', adminAuth, async (req, res) => {
    try {
        const users = await User.find()
            .select('-hashedPassword -refreshToken')
            .sort({ createdAt: -1 })
            .lean();

        // Add strike counts directly for easy frontend processing
        const usersWithStats = users.map(user => ({
            ...user,
            strikeCount: user.strikeTimestamps ? user.strikeTimestamps.length : 0
        }));

        res.json(usersWithStats);
    } catch (error) {
        console.error('Admin Fetch Users Error:', error);
        res.status(500).json({ error: 'Server error fetching users' });
    }
});

// @route   GET /api/admin/users/:userId/activities
// @desc    Get detailed activities (posts, habits, expenses) for a specific user
// @access  Admin
router.get('/users/:userId/activities', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify user exists
        const user = await User.findById(userId).select('fullName email');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch parallel data
        const [habits, posts, expenses] = await Promise.all([
            Habit.find({ userId }).sort({ createdAt: -1 }).lean(),
            Post.find({ userId }).sort({ createdAt: -1 }).lean(),
            Expense ? Expense.find({ userId }).sort({ createdAt: -1 }).lean() : Promise.resolve([])
        ]);

        res.json({
            user,
            activities: {
                habits,
                posts,
                expenses,
            }
        });

    } catch (error) {
        console.error('Admin Fetch User Activities Error:', error);
        res.status(500).json({ error: 'Server error fetching user activities' });
    }
});

module.exports = router;
