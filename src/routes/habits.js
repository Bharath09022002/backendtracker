const express = require('express');
const { z } = require('zod');
const Habit = require('../models/Habit');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

const habitSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(100, 'Title is too long'),
    description: z.string().trim().optional().default(''),
    frequency: z.enum(['daily', 'weekly']).optional().default('daily')
});

// Get All Habits for User
router.get('/', auth, async (req, res) => {
    try {
        const habits = await Habit.find({ userId: req.user.id })
            .select('title description frequency completedDates streak assignedBy icon color category xpReward')
            .populate('assignedBy', 'fullName')
            .lean();
        res.json(habits);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Habit
router.post('/', auth, async (req, res) => {
    try {
        const validatedData = habitSchema.parse(req.body);
        const { title, description, frequency } = validatedData;
        const habit = new Habit({ userId: req.user.id, title, description, frequency });
        await habit.save();
        res.status(201).json(habit);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(500).json({ error: err.message });
    }
});

// Toggle Habit Completion (Aligned with Frontend PATCH /toggle)
router.patch('/:id/toggle', auth, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const habit = await Habit.findOne({ _id: req.params.id, userId: req.user.id });
        if (!habit) return res.status(404).json({ error: 'Habit not found' });
        const user = await User.findById(req.user.id);

        const dateIndex = habit.completedDates.indexOf(today);
        let leveledUp = false;

        if (dateIndex > -1) {
            // Un-complete
            habit.completedDates.splice(dateIndex, 1);
            habit.streak = Math.max(0, habit.streak - 1);
            user.xp = Math.max(0, user.xp - 25);
        } else {
            // Complete
            habit.completedDates.push(today);
            habit.streak += 1;
            user.xp += 25;
        }

        const newLevel = Math.floor(user.xp / 500) + 1;
        if (newLevel > user.level) {
            user.level = newLevel;
            leveledUp = true;
        } else {
            user.level = newLevel; // Might downgrade if they un-complete
        }

        await Promise.all([user.save(), habit.save()]);

        const socket = require('../utils/socket');
        socket.emitToUser(req.user.id, 'habit_updated', {
            habitId: habit._id,
            xp: user.xp,
            level: user.level
        });

        res.json({ habit, xp: user.xp, level: user.level, leveledUp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit Habit
router.put('/:id', auth, async (req, res) => {
    try {
        const validatedData = habitSchema.parse(req.body);
        const { title, description, frequency } = validatedData;

        const habit = await Habit.findOneAndUpdate(
            {
                _id: req.params.id,
                $or: [{ userId: req.user.id }, { assignedBy: req.user.id }]
            },
            { title, description, frequency },
            { new: true }
        );

        if (!habit) return res.status(404).json({ error: 'Habit not found or unauthorized' });
        res.json(habit);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(500).json({ error: err.message });
    }
});

// Delete Habit
router.delete('/:id', auth, async (req, res) => {
    try {
        const habit = await Habit.findOneAndDelete({
            _id: req.params.id,
            $or: [{ userId: req.user.id }, { assignedBy: req.user.id }]
        });
        if (!habit) return res.status(404).json({ error: 'Habit not found or unauthorized' });
        res.json({ message: 'Habit deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
