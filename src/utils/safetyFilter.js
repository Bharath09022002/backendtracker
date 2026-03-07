const { harmfulWords } = require('./harmfulWords');
const User = require('../models/User');
const Habit = require('../models/Habit');

// Pre-compile the regex for performance
// We use word boundaries \b to avoid false positives (e.g., "hello" matching "hell")
const harmfulRegex = new RegExp(
    `\\b(${harmfulWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'i'
);

/**
 * Checks content against harmful words and manages user strikes.
 * @param {Object} user - The user object from the database.
 * @param {string} content - The content to check (titles, descriptions, comments, etc.).
 * @returns {Promise<{isHarmful: boolean, error?: string, strikes?: number}>}
 */
async function handleSafetyCheck(user, content) {
    if (!content) return { isHarmful: false };

    const containsHarmful = harmfulRegex.test(content);

    if (containsHarmful) {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Clean up old strikes and add new one
        user.strikeTimestamps = user.strikeTimestamps.filter(t => t > oneWeekAgo);
        user.strikeTimestamps.push(now);

        const strikeCount = user.strikeTimestamps.length;

        if (strikeCount >= 5) {
            // EXTREME ACTION: Delete account
            await User.findByIdAndDelete(user._id);
            await Habit.deleteMany({ userId: user._id });
            // Note: We don't save the user here because it's deleted
            return {
                isHarmful: true,
                error: 'ACCOUNT DELETED. Multiple violations of safety policy. Harmful content detected 5 times within 7 days.',
                strikes: strikeCount
            };
        } else {
            await user.save();
            return {
                isHarmful: true,
                error: `WARNING: Harmful content detected. This is strike ${strikeCount}/5. Reach 5 strikes in a week and your account will be PERMANENTLY DELETED.`,
                strikes: strikeCount
            };
        }
    }

    return { isHarmful: false };
}

module.exports = { handleSafetyCheck };
