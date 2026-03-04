const express = require('express');
const { z } = require('zod');
const Habit = require('../models/Habit');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

const assignTaskSchema = z.object({
    friendId: z.string().min(1, 'Friend ID is required'),
    title: z.string().min(1, 'Task title is required'),
    description: z.string().optional(),
});

// Harmful keywords for safety filter
const HARMFUL_KEYWORDS = ['kill', 'suicide', 'cut', 'slice', 'die', 'harm', 'end my life'];

// Assign a task (habit) to a friend
router.post('/assign', auth, async (req, res) => {
    try {
        const validatedData = assignTaskSchema.parse(req.body);
        const content = (validatedData.title + ' ' + (validatedData.description || '')).toLowerCase();

        const user = await User.findById(req.user.id);

        // 1. Safety Filter Check
        const containsHarmful = HARMFUL_KEYWORDS.some(word => content.includes(word));

        if (containsHarmful) {
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            // Clean up old strikes and add new one
            user.strikeTimestamps = user.strikeTimestamps.filter(t => t > oneWeekAgo);
            user.strikeTimestamps.push(now);

            const strikeCount = user.strikeTimestamps.length;

            if (strikeCount >= 5) {
                // EXTREME ACTION: Delete account
                await User.findByIdAndDelete(req.user.id);
                // Also optionally delete their habits/posts, but being destructive here as requested
                await Habit.deleteMany({ userId: req.user.id });
                return res.status(403).json({
                    error: 'ACCOUNT DELETED. Multiple violations of safety policy. Harmful content detected 5 times within 7 days.'
                });
            } else {
                await user.save();
                return res.status(403).json({
                    error: `WARNING: Harmful content detected. This is strike ${strikeCount}/5. Reach 5 strikes in a week and your account will be PERMANENTLY DELETED.`,
                    strikes: strikeCount
                });
            }
        }

        // Verify they are friends
        if (!user.friends.includes(validatedData.friendId)) {
            return res.status(403).json({ error: 'You can only assign tasks to friends' });
        }

        // Create a habit for the friend
        const habit = new Habit({
            userId: validatedData.friendId,
            assignedBy: req.user.id,
            isShared: true,
            title: validatedData.title,
            description: validatedData.description || `Assigned by ${user.fullName}`,
            frequency: 'daily',
        });
        await habit.save();

        res.status(201).json({ message: 'Task assigned successfully', habit });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(500).json({ error: err.message });
    }
});

// Get tasks I have assigned to others (to track their progress)
router.get('/assigned-to-others', auth, async (req, res) => {
    try {
        const habits = await Habit.find({
            assignedBy: req.user.id
        }).populate('userId', 'fullName').sort({ createdAt: -1 }).lean();

        // Map to a more useful format for the frontend
        const result = habits.map(h => {
            const today = new Date().toISOString().split('T')[0];
            return {
                id: h._id,
                title: h.title,
                friendName: h.userId.fullName,
                isCompletedToday: h.completedDates.includes(today),
                streak: h.streak
            };
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get tasks assigned to me
router.get('/assigned', auth, async (req, res) => {
    try {
        const habits = await Habit.find({
            userId: req.user.id,
            $or: [
                { assignedBy: { $exists: true } },
                { title: { $regex: /^\[Task from/ } } // Backward compatibility
            ]
        }).sort({ createdAt: -1 });
        res.json(habits);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
