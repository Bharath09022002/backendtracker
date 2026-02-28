const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const User = require('../models/User');
const router = express.Router();

// Brute-force protection
const rateLimiter = new RateLimiterMemory({
    points: 5, // 5 requests
    duration: 60, // per 60 seconds
});

const authRateLimit = (req, res, next) => {
    rateLimiter.consume(req.ip)
        .then(() => next())
        .catch(() => res.status(429).json({ error: 'Too many requests' }));
};

// Register
router.post('/register', [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').notEmpty().withMessage('Full name is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, fullName } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ email, hashedPassword, fullName });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, email, fullName } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', authRateLimit, [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').exists().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, email, fullName: user.fullName } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
