const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  hashedPassword: { type: String, required: true },
  fullName: { type: String, required: true },
  bio: { type: String, default: "" },
  profilePicture: { type: String, default: "" },
  settings: {
    darkMode: { type: Boolean, default: false },
    notifications: { type: Boolean, default: true }
  },
  refreshToken: { type: String, default: null },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  monthlySalary: { type: Number, default: 20000 },
  currentBalance: { type: Number, default: 20000 },
  salaryDate: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.hashedPassword);
};

module.exports = mongoose.model('User', UserSchema);
