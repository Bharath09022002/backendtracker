const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
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

// Zod Schemas
const registerSchema = z.object({
    email: z.string().email('Valid email required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    fullName: z.string().min(1, 'Full name is required')
});

const loginSchema = z.object({
    email: z.string().email('Valid email required'),
    password: z.string().min(1, 'Password is required')
});

const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required')
});

// Helper functions for tokens
const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, process.env.SECRET_KEY, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: userId }, process.env.SECRET_KEY, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

// Register
router.post('/register', async (req, res) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const { email, password, fullName } = validatedData;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ email, hashedPassword, fullName });

        const { accessToken, refreshToken } = generateTokens(user._id);
        user.refreshToken = refreshToken;
        await user.save();

        res.status(201).json({
            token: accessToken,
            refreshToken,
            user: { id: user._id, email, fullName }
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', authRateLimit, async (req, res) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const { email, password } = validatedData;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const { accessToken, refreshToken } = generateTokens(user._id);
        user.refreshToken = refreshToken;
        await user.save();

        res.json({
            token: accessToken,
            refreshToken,
            user: { id: user._id, email, fullName: user.fullName }
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(500).json({ error: err.message });
    }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
    try {
        const validatedData = refreshSchema.parse(req.body);
        const { refreshToken } = validatedData;

        // Verify token cryptographically
        const payload = jwt.verify(refreshToken, process.env.SECRET_KEY);

        // Find user and verify token matches what's in DB (allows revoking)
        const user = await User.findById(payload.id);
        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Issue new tokens
        const tokens = generateTokens(user._id);
        user.refreshToken = tokens.refreshToken;
        await user.save();

        res.json({
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});

// Logout (revoke token)
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

        const payload = jwt.verify(refreshToken, process.env.SECRET_KEY, { ignoreExpiration: true });
        const user = await User.findById(payload.id);

        if (user && user.refreshToken === refreshToken) {
            user.refreshToken = null;
            await user.save();
        }

        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Something went wrong during logout' });
    }
});

module.exports = router;
