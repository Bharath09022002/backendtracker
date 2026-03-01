const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async (retryCount = 0) => {
    if (mongoose.connection.readyState >= 1) return;

    const maxRetries = parseInt(process.env.DB_RETRY_ATTEMPTS) || 5;
    const retryDelay = parseInt(process.env.DB_RETRY_DELAY) || 5000;

    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            dbName: process.env.DATABASE_NAME || 'personal_tracker'
        });
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(`MongoDB Connection Error (Attempt ${retryCount + 1}/${maxRetries}):`, err.message);
        if (retryCount < maxRetries) {
            console.log(`Retrying in ${retryDelay / 1000} seconds...`);
            setTimeout(() => connectDB(retryCount + 1), retryDelay);
        } else {
            console.error('Max retries reached. Exiting...');
            process.exit(1);
        }
    }
};

module.exports = connectDB;
