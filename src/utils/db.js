const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;

    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            dbName: process.env.DATABASE_NAME || 'personal_tracker'
        });
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
