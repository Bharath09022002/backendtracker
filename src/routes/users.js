const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Get Current User Profile
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-hashedPassword');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile
router.put('/me', auth, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true }).select('-hashedPassword');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
