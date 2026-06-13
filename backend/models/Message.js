const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, default: '' },
  image: { type: String, default: '' }
}, { timestamps: true });

// Indexing for rapid chat retrieval per appointment
messageSchema.index({ appointmentId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
