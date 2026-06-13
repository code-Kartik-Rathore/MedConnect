const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const emailService = require('../services/emailService');

/**
 * @route   GET /api/doctors
 * @desc    Get all approved doctors with optional filters (speciality, language, rating, fee)
 * @access  Private (Registered Patients/Doctors/Admins)
 */
router.get('/', protect, async (req, res) => {
  const { speciality, language, rating, maxFee } = req.query;

  try {
    // Basic filter: must be a doctor and must be approved by admin
    const query = { role: 'doctor', isApproved: true };

    if (speciality) {
      query.speciality = { $regex: new RegExp(speciality, 'i') };
    }

    if (language) {
      query.languages = { $in: [new RegExp(language, 'i')] };
    }

    if (rating) {
      query.rating = { $gte: Number(rating) };
    }

    if (maxFee) {
      query.consultationFee = { $lte: Number(maxFee) };
    }

    const doctors = await User.find(query).select('-password');
    res.json(doctors);
  } catch (error) {
    console.error('Fetch doctors error:', error.message);
    res.status(500).json({ message: 'Server error fetching doctor list' });
  }
});

/**
 * @route   GET /api/doctors/admin/all
 * @desc    Get all doctors (both approved and pending)
 * @access  Private (Admin only)
 */
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('-password');
    res.json(doctors);
  } catch (error) {
    console.error('Fetch all admin doctors error:', error.message);
    res.status(500).json({ message: 'Server error fetching admin doctor list' });
  }
});

/**
 * @route   PUT /api/doctors/:id/approve
 * @desc    Approve or reject a doctor profile
 * @access  Private (Admin only)
 */
router.put('/:id/approve', protect, authorize('admin'), async (req, res) => {
  const { isApproved } = req.body;

  try {
    const doctor = await User.findOne({ _id: req.params.id, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const previouslyApproved = doctor.isApproved;
    doctor.isApproved = isApproved;
    await doctor.save();

    // Send email to doctor if they were newly approved (non-blocking)
    if (isApproved && !previouslyApproved) {
      emailService.sendDoctorApprovedNotification(doctor.email, doctor.name).catch(err => {
        console.error(`Error sending approval email to Dr. ${doctor.name}:`, err.message);
      });
    }

    res.json({
      message: `Doctor ${doctor.name} has been ${isApproved ? 'approved' : 'unapproved'}.`,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        isApproved: doctor.isApproved
      }
    });
  } catch (error) {
    console.error('Approve doctor error:', error.message);
    res.status(500).json({ message: 'Server error during doctor approval status toggle' });
  }
});

/**
 * @route   GET /api/doctors/:id
 * @desc    Get details of a single doctor
 * @access  Private
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const doctor = await User.findOne({ _id: req.params.id, role: 'doctor' }).select('-password');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.json(doctor);
  } catch (error) {
    console.error('Fetch doctor details error:', error.message);
    res.status(500).json({ message: 'Server error fetching doctor details' });
  }
});

module.exports = router;
