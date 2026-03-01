const mongoose = require('mongoose');

const HabitSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    completedDates: [{ type: String }], // Store as YYYY-MM-DD
    streak: { type: Number, default: 0 },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isShared: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

HabitSchema.index({ userId: 1, createdAt: -1 });
HabitSchema.index({ assignedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Habit', HabitSchema);
