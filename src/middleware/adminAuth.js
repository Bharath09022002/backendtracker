const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required. No token provided.' });
        }

        const secret = process.env.ACCESS_TOKEN_SECRET || process.env.SECRET_KEY || 'your_super_secret_jwt_key_here_change_it_in_production';
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'User not found.' });
        }

        if (!user.isAdmin) {
            return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
        }

        req.user = { id: user._id.toString() }; // Compatibility with existing routes
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        res.status(401).json({ error: 'Invalid or missing authentication token.' });
    }
};

module.exports = adminAuth;
