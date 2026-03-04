const jwt = require('jsonwebtoken');

// JWT is cryptographically signed with a 15-min TTL.
// User existence is re-verified on token refresh (every 15 min).
// This eliminates a DB query (~5-15ms) on EVERY authenticated request.
module.exports = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};
