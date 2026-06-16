const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { protect } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Upload helper to Cloudinary.
 * Accepts full base64 data URI (data:application/pdf;base64,...)
 */
const uploadPdfToCloudinary = async (base64Str, folder = 'medconnect_reports') => {
  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Str, {
      folder: folder,
      resource_type: 'auto'
    });
    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Cloudinary PDF upload error:', error.message);
    throw new Error('Failed to upload PDF to Cloudinary');
  }
};

/**
 * @route   POST /api/reports/upload
 * @desc    Upload a patient medical report (base64 PDF), request FastAPI AI analysis, and store in MongoDB.
 * @access  Private (Patient only)
 */
router.post('/upload', protect, async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied. Only patients can upload medical reports.' });
    }

    const { fileBase64, fileName } = req.body;
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ message: 'PDF file data (base64) and file name are required.' });
    }

    // Ensure it starts with proper data URI header
    let base64WithHeader = fileBase64;
    if (!fileBase64.startsWith('data:application/pdf;base64,')) {
      base64WithHeader = `data:application/pdf;base64,${fileBase64}`;
    }

    // 1. Host raw PDF on Cloudinary
    let fileUrl = '';
    try {
      fileUrl = await uploadPdfToCloudinary(base64WithHeader);
      console.log(`PDF hosted on Cloudinary: ${fileUrl}`);
    } catch (err) {
      console.warn("Cloudinary upload failed, proceeding without hosted PDF file url:", err.message);
    }

    // 2. Prepare multipart request for FastAPI analyze
    const base64Data = base64WithHeader.replace(/^data:application\/pdf;base64,/, "");
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    console.log(`Forwarding report to FastAPI at ${AI_SERVICE_URL}/analyze...`);
    const aiRes = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: 'POST',
      body: formData
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error(`FastAPI returned status ${aiRes.status}: ${errorText}`);
      
      let clientMessage = 'AI analysis service failed to process the request.';
      try {
        const errJson = JSON.parse(errorText);
        if (errJson && errJson.detail) {
          clientMessage = errJson.detail;
        }
      } catch (e) {
        if (errorText.includes('502') || errorText.includes('Bad Gateway')) {
          clientMessage = 'The AI analysis service is temporarily busy, timed out, or crashed due to server memory limits. Please try uploading a smaller or digital (not scanned) PDF report.';
        } else {
          clientMessage = `AI analysis service failed: ${errorText.substring(0, 150)}`;
        }
      }
      return res.status(aiRes.status).json({ message: clientMessage });
    }

    const aiData = await aiRes.json();
    const { extracted_text, ...analysis } = aiData;

    // 3. Save details to MongoDB
    const report = await Report.create({
      patientId: req.user._id,
      fileName,
      fileUrl,
      extractedText: extracted_text || 'Text extraction empty.',
      analysis
    });

    console.log(`Successfully created report record ${report._id} for patient ${req.user._id}`);
    res.status(201).json(report);
  } catch (error) {
    console.error('Report upload/analyze endpoint error:', error);
    res.status(500).json({ message: 'Server error processing and analyzing medical report.' });
  }
});

/**
 * @route   GET /api/reports
 * @desc    Retrieve all reports for the logged-in patient, or doctor-requested patient reports.
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    let targetPatientId = req.user._id;

    // Doctors can fetch specific patient reports if patientId is provided in query params
    if (req.user.role === 'doctor') {
      const { patientId } = req.query;
      if (!patientId) {
        return res.status(400).json({ message: 'Query parameter patientId is required for doctors.' });
      }
      targetPatientId = patientId;
    }

    const reports = await Report.find({ patientId: targetPatientId }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error.message);
    res.status(500).json({ message: 'Server error fetching reports.' });
  }
});

/**
 * @route   POST /api/reports/:id/chat
 * @desc    Ask a follow-up question regarding a specific medical report.
 * @access  Private
 */
router.post('/:id/chat', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message query cannot be empty.' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    // Verify authorized user
    if (req.user.role === 'patient' && report.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view or chat about this report.' });
    }

    // Forward chat query to FastAPI
    console.log(`Forwarding chat question to FastAPI at ${AI_SERVICE_URL}/chat...`);
    const aiRes = await fetch(`${AI_SERVICE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        report_text: report.extractedText,
        question: message
      })
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error(`FastAPI Chat returned status ${aiRes.status}: ${errorText}`);
      return res.status(502).json({ message: 'Failed to retrieve response from AI assistant.' });
    }

    const aiData = await aiRes.json();
    const answer = aiData.answer;

    // Append both questions and answers to model chatHistory
    report.chatHistory.push({ sender: 'patient', message });
    report.chatHistory.push({ sender: 'ai', message: answer });
    await report.save();

    res.json({
      answer,
      chatHistory: report.chatHistory
    });
  } catch (error) {
    console.error('Error in report chat endpoint:', error);
    res.status(500).json({ message: 'Server error processing medical chat.' });
  }
});

/**
 * @route   DELETE /api/reports/:id
 * @desc    Delete a specific medical report.
 * @access  Private (Patient only)
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    // Verify ownership
    if (report.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own reports.' });
    }

    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Medical report deleted successfully.' });
  } catch (error) {
    console.error('Error deleting report:', error.message);
    res.status(500).json({ message: 'Server error deleting report.' });
  }
});

module.exports = router;
