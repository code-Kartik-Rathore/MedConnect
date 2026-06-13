const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },    // e.g., "500mg"
  frequency: { type: String, required: true }, // e.g., "Once daily", "Twice a day after meals"
  duration: { type: String, required: true }   // e.g., "5 days"
});

const prescriptionSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  diagnosis: { type: String, required: true },
  medicines: [medicineSchema],
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
