require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tracker';

async function seedAdmin() {
    try {
        await mongoose.connect(DB_URI);
        console.log('Connected to DB');

        const email = 'bharath@gmail.com';
        const password = 'bharath1234';

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let admin = await User.findOne({ email });

        if (admin) {
            console.log('User found, updating to admin and resetting password...');
            admin.isAdmin = true;
            admin.hashedPassword = hashedPassword;
            await admin.save();
            console.log('Admin user updated successfully.');
        } else {
            console.log('User not found, creating new admin user...');
            admin = new User({
                fullName: 'Bharath Admin',
                email: email,
                hashedPassword: hashedPassword,
                isAdmin: true
            });
            await admin.save();
            console.log('Admin user created successfully.');
        }

        mongoose.connection.close();
    } catch (err) {
        console.error('Error seeding admin:', err);
        mongoose.connection.close();
    }
}

seedAdmin();
