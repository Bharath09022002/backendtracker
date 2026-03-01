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

// Assign a task (habit) to a friend
router.post('/assign', auth, async (req, res) => {
    try {
        const validatedData = assignTaskSchema.parse(req.body);

        // Verify they are friends
        const user = await User.findById(req.user.id);
        if (!user.friends.includes(validatedData.friendId)) {
            return res.status(403).json({ error: 'You can only assign tasks to friends' });
        }

        // Create a habit for the friend
        const habit = new Habit({
            userId: validatedData.friendId,
            title: `[Task from ${user.fullName}] ${validatedData.title}`,
            description: validatedData.description || '',
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

// Get tasks assigned to me (habits from friends)
router.get('/assigned', auth, async (req, res) => {
    try {
        const habits = await Habit.find({
            userId: req.user.id,
            title: { $regex: /^\[Task from/ }
        }).sort({ createdAt: -1 });
        res.json(habits);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
