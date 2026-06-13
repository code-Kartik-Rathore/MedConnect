const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Appointment = require('../models/Appointment');
const Slot = require('../models/Slot');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const emailService = require('../services/emailService');

// Initialize Razorpay client only if credentials exist
let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

/**
 * @route   POST /api/payments/create-order
 * @desc    Initialize a payment order (Patient only)
 * @access  Private (Patient only)
 */
router.post('/create-order', protect, authorize('patient'), async (req, res) => {
  const { appointmentId } = req.body;

  if (!appointmentId) {
    return res.status(400).json({ message: 'Appointment ID is required.' });
  }

  try {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized. You are not the patient for this appointment.' });
    }

    const doctor = await User.findById(appointment.doctorId);
    const fee = doctor.consultationFee || 500; // default 500 INR

    if (!razorpayInstance) {
      // Mock Sandbox Mode
      console.log('💳 Razorpay keys missing. Initializing Mock Sandbox Payment Order.');
      const mockOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
      appointment.paymentId = mockOrderId;
      await appointment.save();

      return res.json({
        isMock: true,
        orderId: mockOrderId,
        amount: fee,
        currency: 'INR',
        keyId: 'mock_key_id'
      });
    }

    // Real Razorpay Order
    const options = {
      amount: fee * 100, // amount in paisa (e.g. 500 INR = 50000 paisa)
      currency: 'INR',
      receipt: appointmentId.toString()
    };

    const order = await razorpayInstance.orders.create(options);
    appointment.paymentId = order.id;
    await appointment.save();

    res.json({
      isMock: false,
      orderId: order.id,
      amount: fee,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Payment order creation error:', error.message);
    res.status(500).json({ message: 'Server error generating payment order' });
  }
});

/**
 * @route   POST /api/payments/verify
 * @desc    Verify payment signature or handle simulation verification
 * @access  Private (Patient only)
 */
router.post('/verify', protect, authorize('patient'), async (req, res) => {
  const { 
    appointmentId, 
    razorpay_payment_id, 
    razorpay_order_id, 
    razorpay_signature,
    simulateSuccess 
  } = req.body;

  if (!appointmentId) {
    return res.status(400).json({ message: 'Appointment ID is required.' });
  }

  try {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const doctor = await User.findById(appointment.doctorId);
    const patient = req.user;

    // Check if simulating mock success
    if (!razorpayInstance || simulateSuccess) {
      if (simulateSuccess) {
        appointment.paymentStatus = 'paid';
        appointment.status = 'accepted'; // Auto-accept on successful payment in mock mode
        await appointment.save();

        // Send confirmation emails (non-blocking)
        console.log(`📧 Booking confirmed in Mock Mode. Dispatching email alerts to ${patient.email} and ${doctor.email}`);
        emailService.sendPatientBookingAndPaymentNotification(
          patient.email, 
          patient.name, 
          doctor.name, 
          appointment.date, 
          appointment.startTime,
          doctor.consultationFee || 500
        ).catch(err => console.error('Error sending patient booking notification:', err.message));

        emailService.sendDoctorBookingAndPaymentNotification(
          doctor.email,
          doctor.name,
          patient.name,
          appointment.date,
          appointment.startTime,
          doctor.consultationFee || 500
        ).catch(err => console.error('Error sending doctor booking notification:', err.message));

        return res.json({ success: true, message: 'Mock payment verified successfully.' });
      } else {
        return res.status(400).json({ message: 'Mock simulation signal missing.' });
      }
    }

    // Real Signature Verification
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay parameters for verification.' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      appointment.paymentStatus = 'paid';
      appointment.status = 'accepted'; // Auto-accept on successful payment
      await appointment.save();

      // Send confirmation emails (non-blocking)
      emailService.sendPatientBookingAndPaymentNotification(
        patient.email, 
        patient.name, 
        doctor.name, 
        appointment.date, 
        appointment.startTime,
        doctor.consultationFee || 500
      ).catch(err => console.error('Error sending patient booking notification:', err.message));

      emailService.sendDoctorBookingAndPaymentNotification(
        doctor.email, 
        doctor.name, 
        patient.name, 
        appointment.date, 
        appointment.startTime,
        doctor.consultationFee || 500
      ).catch(err => console.error('Error sending doctor booking notification:', err.message));

      res.json({ success: true, message: 'Payment verified and appointment confirmed.' });
    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }
  } catch (error) {
    console.error('Payment verification error:', error.message);
    res.status(500).json({ message: 'Server error verifying payment' });
  }
});

/**
 * @route   POST /api/payments/refund
 * @desc    Initiate a refund for a cancelled appointment (Admin only)
 * @access  Private (Admin only)
 */
router.post('/refund', protect, authorize('admin'), async (req, res) => {
  const { appointmentId } = req.body;

  if (!appointmentId) {
    return res.status(400).json({ message: 'Appointment ID is required.' });
  }

  try {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.paymentStatus !== 'paid' && appointment.status !== 'cancelled') {
      return res.status(400).json({ message: 'Only paid and cancelled appointments can be refunded.' });
    }

    const doctor = await User.findById(appointment.doctorId);
    const patient = await User.findById(appointment.patientId);

    // Call Razorpay refund API if instance is active
    if (razorpayInstance && appointment.paymentId && !appointment.paymentId.startsWith('order_mock_')) {
      try {
        // Find payment ID associated with the order (normally done via webhook or client passed ID,
        // let's assume paymentId stores orderId; to refund we fetch payments by order or pass paymentId directly).
        // Since we stored orderId in appointment.paymentId, in production we would query Razorpay payments by order,
        // then refund that payment. Let's write the correct Razorpay API block:
        const payments = await razorpayInstance.orders.fetchPayments(appointment.paymentId);
        if (payments && payments.items && payments.items.length > 0) {
          const actualPaymentId = payments.items[0].id;
          await razorpayInstance.payments.refund(actualPaymentId, {
            amount: doctor.consultationFee * 100,
            notes: { reason: 'Admin approved cancellation refund' }
          });
        }
      } catch (err) {
        console.error('Razorpay refund API call failed:', err.message);
        return res.status(500).json({ message: `Razorpay refund failed: ${err.message}` });
      }
    }

    // Update DB status
    appointment.paymentStatus = 'refunded';
    appointment.status = 'cancelled';
    await appointment.save();

    // Release slot back to available
    await Slot.findByIdAndUpdate(appointment.slotId, { status: 'available' });

    // Notify user
    await emailService.sendCancellationNotification(
      patient.email,
      patient.name,
      doctor.name,
      appointment.date,
      appointment.startTime,
      'Admin approved refund request',
      true // marked as refunded
    );

    res.json({ message: 'Refund processed successfully.', appointment });
  } catch (error) {
    console.error('Refund processing error:', error.message);
    res.status(500).json({ message: 'Server error processing refund' });
  }
});

/**
 * @route   POST /api/payments/webhook
 * @desc    Listen to Razorpay Webhook events (e.g. refund.processed)
 * @access  Public
 */
router.post('/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.log('⚠️ Razorpay Webhook secret is not configured in .env. Ignoring webhook verification.');
    return res.status(200).send('OK');
  }

  const signature = req.headers['x-razorpay-signature'];
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  if (digest === signature) {
    const event = req.body.event;
    console.log(`🔔 Razorpay Webhook Event Received: ${event}`);

    try {
      if (event === 'refund.processed') {
        const paymentId = req.body.payload.payment.entity.id;
        const refundEntity = req.body.payload.refund.entity;
        
        // Find appointment with this payment ID (orderId or paymentId lookup)
        // If we stored orderId in appointment, let's fetch the payment to get the orderId
        const orderId = req.body.payload.payment.entity.order_id;
        const appointment = await Appointment.findOne({ paymentId: orderId });
        
        if (appointment) {
          appointment.paymentStatus = 'refunded';
          appointment.status = 'cancelled';
          await appointment.save();
          console.log(`Appointment ${appointment._id} successfully updated to REFUNDED via webhook.`);
        }
      }
    } catch (err) {
      console.error('Error handling webhook event:', err.message);
    }
    
    res.status(200).send('OK');
  } else {
    res.status(400).send('Invalid signature');
  }
});

module.exports = router;
