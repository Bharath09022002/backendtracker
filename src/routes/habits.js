const express = require('express');
const { z } = require('zod');
const Habit = require('../models/Habit');
const auth = require('../middleware/auth');
const router = express.Router();

const habitSchema = z.object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().optional(),
    frequency: z.enum(['daily', 'weekly']).optional()
});

// Get All Habits for User
router.get('/', auth, async (req, res) => {
    try {
        const habits = await Habit.find({ userId: req.user.id });
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

        const dateIndex = habit.completedDates.indexOf(today);
        if (dateIndex > -1) {
            // Un-complete
            habit.completedDates.splice(dateIndex, 1);
            habit.streak = Math.max(0, habit.streak - 1);
        } else {
            // Complete
            habit.completedDates.push(today);
            habit.streak += 1;
        }

        await habit.save();
        res.json(habit);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
