const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Slot = require('../models/Slot');
const User = require('../models/User');
const Prescription = require('../models/Prescription');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const aiService = require('../services/aiService');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

/**
 * @route   POST /api/appointments/symptom-check
 * @desc    Public AI Symptom Checker suggesting which specialist to consult
 * @access  Public
 */
router.post('/symptom-check', async (req, res) => {
  const { symptoms } = req.body;
  if (!symptoms) {
    return res.status(400).json({ message: 'Symptoms description is required.' });
  }
  try {
    const suggestion = await aiService.getSpecialistRecommendation(symptoms);
    res.json(suggestion);
  } catch (error) {
    console.error('AI Symptom check endpoint error:', error.message);
    res.status(500).json({ message: 'Server error analyzing symptoms' });
  }
});

/**
 * @route   POST /api/appointments
 * @desc    Book an appointment slot (Patient only)
 * @access  Private (Patient only)
 */
router.post('/', protect, authorize('patient'), async (req, res) => {
  const { doctorId, slotId, symptomsDescription } = req.body;

  if (!doctorId || !slotId || !symptomsDescription) {
    return res.status(400).json({ message: 'Doctor ID, Slot ID, and symptoms description are required.' });
  }

  try {
    // 1. Verify doctor exists
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isApproved: true });
    if (!doctor) {
      return res.status(404).json({ message: 'Approved doctor not found.' });
    }

    // 2. Verify slot is available
    const slot = await Slot.findOne({ _id: slotId, doctorId, status: 'available' });
    if (!slot) {
      return res.status(400).json({ message: 'Slot is not available or does not belong to this doctor.' });
    }

    // 3. Run AI Pre-booking Symptom Checker to recommend specialty
    const aiSuggestion = await aiService.getSpecialistRecommendation(symptomsDescription);

    // 4. Lock slot status to 'booked' to prevent double booking
    slot.status = 'booked';
    await slot.save();

    // 5. Create appointment in pending status
    const appointment = await Appointment.create({
      patientId: req.user._id,
      doctorId,
      slotId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'pending', // Pending payment
      symptomsDescription,
      aiSpecialistSuggestion: `${aiSuggestion.specialty} - ${aiSuggestion.reasoning}`,
      paymentStatus: 'pending'
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Create appointment error:', error.message);
    res.status(500).json({ message: 'Server error booking appointment' });
  }
});

/**
 * @route   GET /api/appointments/my-bookings
 * @desc    Get user's appointments (Patients & Doctors see their own)
 * @access  Private
 */
router.get('/my-bookings', protect, async (req, res) => {
  try {
    let appointments;
    if (req.user.role === 'patient') {
      appointments = await Appointment.find({ patientId: req.user._id })
        .populate('doctorId', 'name speciality profilePic rating')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'doctor') {
      appointments = await Appointment.find({ doctorId: req.user._id })
        .populate('patientId', 'name email profilePic')
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ message: 'Admins should use the global endpoint' });
    }

    res.json(appointments);
  } catch (error) {
    console.error('Fetch bookings error:', error.message);
    res.status(500).json({ message: 'Server error retrieving appointments' });
  }
});

/**
 * @route   GET /api/appointments/admin/all
 * @desc    Get all appointments across the platform
 * @access  Private (Admin only)
 */
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
  try {
    const appointments = await Appointment.find({})
      .populate('patientId', 'name email')
      .populate('doctorId', 'name speciality')
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (error) {
    console.error('Admin fetch all bookings error:', error.message);
    res.status(500).json({ message: 'Server error fetching bookings list' });
  }
});

/**
 * @route   GET /api/appointments/:id
 * @desc    Get detailed appointment information
 * @access  Private
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email profilePic')
      .populate('doctorId', 'name speciality licenseNumber profilePic rating consultationFee');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Verify authorized access (Patient, Doctor, or Admin)
    const isPatient = appointment.patientId._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctorId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this appointment.' });
    }

    // Include prescription if it exists
    const prescription = await Prescription.findOne({ appointmentId: appointment._id });

    res.json({
      appointment,
      prescription
    });
  } catch (error) {
    console.error('Fetch appointment details error:', error.message);
    res.status(500).json({ message: 'Server error fetching appointment details' });
  }
});

/**
 * @route   PUT /api/appointments/:id/status
 * @desc    Update appointment status (Doctor accepts/rejects, Patient/Admin cancels)
 * @access  Private
 */
router.put('/:id/status', protect, async (req, res) => {
  const { status, cancellationReason } = req.body;

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const isDoctor = appointment.doctorId.toString() === req.user._id.toString();
    const isPatient = appointment.patientId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to change this status.' });
    }

    const previousStatus = appointment.status;

    if (req.user.role === 'doctor') {
      if (!['accepted', 'rejected', 'completed'].includes(status)) {
        return res.status(400).json({ message: 'Doctors can only set status to accepted, rejected, or completed.' });
      }
      appointment.status = status;
    } else if (req.user.role === 'patient') {
      // Patient can cancel pending/accepted appointments before completion
      if (status !== 'cancelled') {
        return res.status(400).json({ message: 'Patients can only request cancellation.' });
      }
      if (['completed', 'rejected', 'cancelled'].includes(previousStatus)) {
        return res.status(400).json({ message: 'Cannot cancel an appointment that is already rejected, completed, or cancelled.' });
      }
      appointment.status = 'cancelled';
    } else if (req.user.role === 'admin') {
      appointment.status = status;
    }

    // Handle slot release if status is rejected or cancelled
    if (['rejected', 'cancelled'].includes(appointment.status)) {
      await Slot.findByIdAndUpdate(appointment.slotId, { status: 'available' });

      // If they paid, flag for refund (Admin will approve, or auto-process depending on webhook/webhook logic)
      if (appointment.paymentStatus === 'paid') {
        // Mark refund pending for admin review
        appointment.paymentStatus = 'pending'; // wait, let's keep it 'paid' but handle automatic refunds in the webhook or custom webhook controller
        console.log(`Refund needed for cancelled appointment ${appointment._id}`);
      }

      // Send cancellation emails
      const patient = await User.findById(appointment.patientId);
      const doctor = await User.findById(appointment.doctorId);
      await emailService.sendCancellationNotification(
        patient.email,
        patient.name,
        doctor.name,
        appointment.date,
        appointment.startTime,
        cancellationReason || 'Cancelled by practitioner/patient',
        appointment.paymentStatus === 'refunded'
      );
    }

    await appointment.save();
    res.json(appointment);
  } catch (error) {
    console.error('Update appointment status error:', error.message);
    res.status(500).json({ message: 'Server error updating appointment status' });
  }
});

/**
 * @route   POST /api/appointments/:id/prescription
 * @desc    Submit a digital prescription (Doctor only)
 * @access  Private (Doctor only)
 */
router.post('/:id/prescription', protect, authorize('doctor'), async (req, res) => {
  const { diagnosis, medicines, notes } = req.body;

  if (!diagnosis || !medicines || !Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({ message: 'Diagnosis and at least one medicine are required.' });
  }

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    if (appointment.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized. You are not the doctor for this appointment.' });
    }

    // Create prescription
    const prescription = await Prescription.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      doctorId: req.user._id,
      diagnosis,
      medicines,
      notes: notes || ''
    });

    // Update appointment status to completed
    appointment.status = 'completed';

    // Fetch chat messages for AI summaries
    const chatHistory = await Message.find({ appointmentId: appointment._id }).sort({ createdAt: 1 });

    // Generate Grok AI summary and follow-up
    console.log('🤖 Invoking Grok AI to generate consultation summary and follow-up reminders...');
    const summary = await aiService.generateConsultationSummary(chatHistory, prescription);
    const followUp = await aiService.generateFollowUpReminder(chatHistory, prescription);

    appointment.aiSummary = summary;
    appointment.followUpReminder = followUp;

    // Credit Doctor earnings (consultation fee)
    const doctor = await User.findById(req.user._id);
    doctor.earnings = (doctor.earnings || 0) + (doctor.consultationFee || 0);
    await doctor.save();

    await appointment.save();

    // Send notification emails
    const patient = await User.findById(appointment.patientId);
    await emailService.sendPrescriptionReadyNotification(patient.email, patient.name, doctor.name);

    res.status(201).json({
      prescription,
      appointment
    });
  } catch (error) {
    console.error('Prescription creation error:', error.message);
    res.status(500).json({ message: 'Server error generating digital prescription' });
  }
});

/**
 * @route   GET /api/appointments/:id/prescription/pdf
 * @desc    Download prescription as PDF
 * @access  Private (Patient or Doctor involved in appointment)
 */
router.get('/:id/prescription/pdf', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const isPatient = appointment.patientId.toString() === req.user._id.toString();
    const isDoctor = appointment.doctorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to download this prescription.' });
    }

    const prescription = await Prescription.findOne({ appointmentId: appointment._id });
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found.' });
    }

    const patient = await User.findById(appointment.patientId);
    const doctor = await User.findById(appointment.doctorId);

    const pdfBuffer = await pdfService.generatePrescriptionPDF(prescription, appointment, doctor, patient);

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=prescription_${appointment._id.toString().slice(-6)}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Download Error:', error.message);
    res.status(500).json({ message: 'Server error generating PDF download' });
  }
});

/**
 * @route   GET /api/appointments/:id/invoice/pdf
 * @desc    Download invoice/receipt as PDF
 * @access  Private (Patient or Doctor involved in appointment, or Admin)
 */
router.get('/:id/invoice/pdf', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Verify authorized access (Patient, Doctor, or Admin)
    const isPatient = appointment.patientId.toString() === req.user._id.toString();
    const isDoctor = appointment.doctorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to download this invoice.' });
    }

    const patient = await User.findById(appointment.patientId);
    const doctor = await User.findById(appointment.doctorId);

    const pdfBuffer = await pdfService.generateInvoicePDF(appointment, doctor, patient);

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${appointment._id.toString().slice(-6)}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Invoice PDF Download Error:', error.message);
    res.status(500).json({ message: 'Server error generating invoice PDF' });
  }
});

module.exports = router;
