const express = require('express');
const { z } = require('zod');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

const updateProfileSchema = z.object({
    fullName: z.string().min(1).optional(),
    bio: z.string().optional(),
    profilePicture: z.string().url().optional(),
    settings: z.object({
        darkMode: z.boolean().optional(),
        notifications: z.boolean().optional()
    }).optional()
});

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
        const validatedData = updateProfileSchema.parse(req.body);
        const user = await User.findByIdAndUpdate(req.user.id, validatedData, { new: true }).select('-hashedPassword');
        res.json(user);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
