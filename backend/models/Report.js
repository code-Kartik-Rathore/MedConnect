const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  fileName: { 
    type: String, 
    required: true 
  },
  fileUrl: { 
    type: String, 
    default: '' 
  },
  extractedText: { 
    type: String, 
    required: true 
  },
  analysis: {
    summary: { type: String, required: true },
    report_type: { type: String, required: true },
    severity: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'critical'], 
      required: true 
    },
    abnormal_findings: [{
      finding: { type: String },
      value: { type: String },
      reference_range: { type: String },
      explanation: { type: String }
    }],
    potential_concerns: [{ type: String }],
    recommended_specialists: [{ type: String }],
    next_steps: [{ type: String }],
    requires_urgent_attention: { type: Boolean, default: false },
    urgent_reason: { type: String, default: null },
    patient_friendly_explanation: { type: String, required: true },
    disclaimer: { type: String, required: true }
  },
  chatHistory: [{
    sender: { 
      type: String, 
      enum: ['patient', 'ai'], 
      required: true 
    },
    message: { 
      type: String, 
      required: true 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
