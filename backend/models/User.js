const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor', 'admin'], required: true },
  profilePic: { type: String, default: '' },
  languages: { type: [String], default: ['English'] },
  
  // Doctor specific fields
  speciality: { type: String },
  licenseNumber: { type: String },
  experience: { type: Number },
  consultationFee: { type: Number },
  isApproved: { type: Boolean, default: false }, // Requires admin approval
  rating: { type: Number, default: 5.0 },
  earnings: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
