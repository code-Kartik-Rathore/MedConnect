const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  symptomsDescription: { type: String, required: true },
  aiSpecialistSuggestion: { type: String },
  
  // Razorpay payment details
  paymentId: { type: String }, // Razorpay Order ID or mock payment id
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'refunded'], 
    default: 'pending' 
  },
  
  // Post-consultation AI notes
  aiSummary: { type: String, default: '' },
  followUpReminder: { type: String, default: '' } // Recommendations/Dates
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
