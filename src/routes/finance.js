const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { z } = require('zod');

const salarySchema = z.object({
    amount: z.number().min(0)
});

const expenseSchema = z.object({
    title: z.string().min(1),
    amount: z.number().min(0),
    category: z.enum(['lifestyle', 'fixed', 'fun', 'food', 'travel', 'entertainment', 'shopping', 'health', 'bills', 'other']).optional(),
    linkedActivityId: z.string().optional()
});

// Get Salary Summary
router.get('/summary', auth, async (req, res) => {
    try {
        const [user, recentExpenses] = await Promise.all([
            User.findById(req.user.id).select('monthlySalary currentBalance salaryDate').lean(),
            Expense.find({ userId: req.user.id }).sort({ date: -1 }).limit(10).lean()
        ]);

        res.json({
            salary: user.monthlySalary,
            balance: user.currentBalance,
            salaryDate: user.salaryDate,
            recentExpenses
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Salary
router.put('/salary', auth, async (req, res) => {
    try {
        const { amount } = salarySchema.parse(req.body);
        const user = await User.findById(req.user.id);
        user.monthlySalary = amount;
        // When updating salary, we might want to reset the balance too? 
        // Usually, yes, if they are setting their initial or new monthly salary.
        user.currentBalance = amount;
        await user.save();
        res.json({ message: 'Salary updated', salary: user.monthlySalary });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Log Expense
router.post('/expense', auth, async (req, res) => {
    try {
        const data = expenseSchema.parse(req.body);
        const expense = new Expense({
            ...data,
            userId: req.user.id
        });

        const user = await User.findById(req.user.id);
        user.currentBalance -= data.amount;

        await Promise.all([expense.save(), user.save()]);

        res.json({ message: 'Expense logged', expense, newBalance: user.currentBalance });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Edit Expense
router.put('/expense/:id', auth, async (req, res) => {
    try {
        const data = expenseSchema.parse(req.body);
        const expense = await Expense.findOne({ _id: req.params.id, userId: req.user.id });
        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        const user = await User.findById(req.user.id);
        // Adjust balance: add old amount back, subtract new amount
        user.currentBalance = user.currentBalance + expense.amount - data.amount;

        expense.title = data.title;
        expense.amount = data.amount;
        expense.category = data.category || 'other';

        await Promise.all([expense.save(), user.save()]);

        res.json({ message: 'Expense updated', expense, newBalance: user.currentBalance });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get Financial Analytics (Charts data)
router.get('/analytics', auth, async (req, res) => {
    try {
        const { period } = req.query; // 'week', 'month', 'year'
        const now = new Date();
        let startDate;

        if (period === 'week') {
            startDate = new Date(now.setDate(now.getDate() - now.getDay())); // Start of week
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1); // Start of year
        } else {
            startDate = new Date(now.setDate(now.getDate() - 30)); // Default last 30 days
        }

        const query = { userId: req.user.id, date: { $gte: startDate } };

        // 1. Group by Category (Pie Chart)
        const categoryData = await Expense.aggregate([
            { $match: { userId: new require('mongoose').Types.ObjectId(req.user.id), date: { $gte: startDate } } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } },
            { $sort: { total: -1 } }
        ]);

        // 2. Group by Date (Bar Chart)
        let groupFormat;
        if (period === 'year') {
            groupFormat = { month: { $month: '$date' }, year: { $year: '$date' } };
        } else {
            groupFormat = { day: { $dayOfMonth: '$date' }, month: { $month: '$date' }, year: { $year: '$date' } };
        }

        const dailyData = await Expense.aggregate([
            { $match: { userId: new require('mongoose').Types.ObjectId(req.user.id), date: { $gte: startDate } } },
            { $group: { _id: groupFormat, total: { $sum: '$amount' } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        res.json({
            categories: categoryData,
            timeSeries: dailyData,
            period
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Expense
router.delete('/expense/:id', auth, async (req, res) => {
    try {
        const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        const user = await User.findById(req.user.id);
        user.currentBalance += expense.amount;
        await user.save();

        res.json({ message: 'Expense deleted', newBalance: user.currentBalance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
