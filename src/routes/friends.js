const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Get my friends list
router.get('/list', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('friends', 'fullName email _id');
        res.json(user.friends || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a friend by their user ID
router.post('/add', auth, async (req, res) => {
    try {
        const { friendId } = req.body;
        if (!friendId) return res.status(400).json({ error: 'friendId is required' });
        if (friendId === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });

        const friend = await User.findById(friendId);
        if (!friend) return res.status(404).json({ error: 'User not found' });

        const user = await User.findById(req.user.id);
        if (user.friends.includes(friendId)) {
            return res.status(400).json({ error: 'Already friends' });
        }

        user.friends.push(friendId);
        await user.save();

        // Mutual: also add current user to friend's list
        if (!friend.friends.includes(req.user.id)) {
            friend.friends.push(req.user.id);
            await friend.save();
        }

        res.json({ message: 'Friend added successfully', friend: { _id: friend._id, fullName: friend.fullName, email: friend.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove a friend
router.delete('/:friendId', auth, async (req, res) => {
    try {
        const { friendId } = req.params;
        await User.findByIdAndUpdate(req.user.id, { $pull: { friends: friendId } });
        await User.findByIdAndUpdate(friendId, { $pull: { friends: req.user.id } });
        res.json({ message: 'Friend removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
