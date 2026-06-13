const express = require('express');
const router = express.Router();
const Slot = require('../models/Slot');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

/**
 * @route   POST /api/slots
 * @desc    Batch create availability slots (Doctors only)
 * @access  Private (Doctor only)
 */
router.post('/', protect, authorize('doctor'), async (req, res) => {
  const { slots } = req.body; // Expecting array of { date: 'YYYY-MM-DD', startTime: 'HH:MM', endTime: 'HH:MM' }

  if (!req.user.isApproved) {
    return res.status(403).json({ message: 'Your doctor profile is pending admin approval. You cannot set slots yet.' });
  }

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ message: 'Please provide an array of slot objects.' });
  }

  try {
    const createdSlots = [];
    const errors = [];

    for (const slotData of slots) {
      const { date, startTime, endTime } = slotData;

      if (!date || !startTime || !endTime) {
        errors.push({ slot: slotData, error: 'Missing date, startTime, or endTime.' });
        continue;
      }

      try {
        const slot = await Slot.create({
          doctorId: req.user._id,
          date,
          startTime,
          endTime,
          status: 'available'
        });
        createdSlots.push(slot);
      } catch (err) {
        if (err.code === 11000) {
          errors.push({ slot: slotData, error: 'A slot for this date and time already exists.' });
        } else {
          errors.push({ slot: slotData, error: err.message });
        }
      }
    }

    res.status(201).json({
      message: `Created ${createdSlots.length} slots. ${errors.length} slots failed to create.`,
      slots: createdSlots,
      errors
    });
  } catch (error) {
    console.error('Batch slot creation error:', error.message);
    res.status(500).json({ message: 'Server error during slot setup' });
  }
});

/**
 * @route   GET /api/slots/doctor/:doctorId
 * @desc    Get all available slots for a specific doctor
 * @access  Private
 */
router.get('/doctor/:doctorId', protect, async (req, res) => {
  const { all } = req.query; // If all=true, return booked too (useful for doctor dashboard)

  try {
    const filter = { doctorId: req.params.doctorId };
    if (all !== 'true') {
      filter.status = 'available';
    }

    // Sort by date then start time
    const slots = await Slot.find(filter).sort({ date: 1, startTime: 1 });
    res.json(slots);
  } catch (error) {
    console.error('Fetch slots error:', error.message);
    res.status(500).json({ message: 'Server error fetching slots' });
  }
});

/**
 * @route   DELETE /api/slots/:id
 * @desc    Delete a slot (Doctor only - if not booked)
 * @access  Private (Doctor only)
 */
router.delete('/:id', protect, authorize('doctor'), async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    // Ensure slot belongs to this doctor
    if (slot.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to delete this slot.' });
    }

    // Ensure slot is not booked
    if (slot.status === 'booked') {
      return res.status(400).json({ message: 'Cannot delete a booked slot.' });
    }

    await Slot.findByIdAndDelete(req.params.id);
    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Delete slot error:', error.message);
    res.status(500).json({ message: 'Server error deleting slot' });
  }
});

module.exports = router;
