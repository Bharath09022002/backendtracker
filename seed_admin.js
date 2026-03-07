require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const DB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/personal_tracker';

async function seedAdmin() {
    try {
        await mongoose.connect(DB_URI);
        console.log('Connected to DB');

        const email = 'bharath@gmail.com';
        const password = 'bharath1234';

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Use raw MongoDB collection to avoid schema validation errors with old indexes
        const usersCollection = mongoose.connection.db.collection('users');
        const admin = await usersCollection.findOne({ email });

        if (admin) {
            console.log('User found, updating to admin and resetting password via native driver...');
            await usersCollection.updateOne({ email }, {
                $set: {
                    isAdmin: true,
                    hashedPassword: hashedPassword
                }
            });
            console.log('Admin user updated successfully.');
        } else {
            console.log('User not found, creating new admin user via native driver...');
            await usersCollection.insertOne({
                fullName: 'Bharath Admin',
                email: email,
                hashedPassword: hashedPassword,
                isAdmin: true,
                mobileNumber: '0000000000' + Math.floor(Math.random() * 999999),
                createdAt: new Date()
            });
            console.log('Admin user created successfully.');
        }

        mongoose.connection.close();
    } catch (err) {
        console.error('Error seeding admin:', err);
        mongoose.connection.close();
    }
}

seedAdmin();
