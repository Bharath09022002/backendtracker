const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const Habit = require('../models/Habit');
const User = require('../models/User');
const router = express.Router();

const AI_SERVICE_URL = "https://ai-xw67.onrender.com/ai/coach";

// POST /api/ai/coach
router.post('/coach', auth, async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: "Question is required" });
        }

        // 1. Fetch user habits
        const habits = await Habit.find({ userId: req.user.id });

        // 2. Format tracker data for the AI service
        // We'll provide the last 30 days of data for each habit
        const tracker_data = [];
        const today = new Date();

        for (const habit of habits) {
            // Add entries for the last 30 days
            for (let i = 0; i < 30; i++) {
                const date = new Date();
                date.setDate(today.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];

                const isCompleted = habit.completedDates.includes(dateStr);

                tracker_data.push({
                    date: dateStr,
                    task: habit.title,
                    completed: isCompleted,
                    streak: isCompleted ? habit.streak : 0, // Simplified streak passing
                    category: habit.category || "other"
                });
            }
        }

        // 3. Send to AI Service
        const response = await axios.post(AI_SERVICE_URL, {
            question: question,
            tracker_data: tracker_data
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000 // 15s timeout
        });

        // 4. Return the AI response
        res.json(response.data);

    } catch (err) {
        console.error("AI Coach Error:", err.message);
        if (err.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            return res.status(err.response.status).json({ error: err.response.data });
        } else if (err.request) {
            // The request was made but no response was received
            return res.status(503).json({ error: "AI Service is currently unavailable" });
        } else {
            // Something happened in setting up the request that triggered an Error
            return res.status(500).json({ error: err.message });
        }
    }
});

module.exports = router;
