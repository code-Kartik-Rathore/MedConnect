const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { uploadImage } = require('../services/cloudinaryService');
const emailService = require('../services/emailService');

// Helper to generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'super_secret_key_medconnect_123!@#', {
    expiresIn: '30d'
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (patient or doctor or admin)
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    role, 
    languages, 
    speciality, 
    licenseNumber, 
    experience, 
    consultationFee 
  } = req.body;

  try {
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Build user record
    const userFields = {
      name,
      email,
      password: passwordHash,
      role: role || 'patient',
      languages: languages || ['English']
    };

    // If role is doctor, populate doctor-specific fields
    if (role === 'doctor') {
      if (!speciality || !licenseNumber || !experience || !consultationFee) {
        return res.status(400).json({ 
          message: 'All doctor verification details (speciality, license number, experience, and fee) are required.' 
        });
      }
      userFields.speciality = speciality;
      userFields.licenseNumber = licenseNumber;
      userFields.experience = Number(experience);
      userFields.consultationFee = Number(consultationFee);
      userFields.isApproved = false; // Must be approved by admin
    }

    const user = await User.create(userFields);

    if (user) {
      // Send signup notification email (non-blocking)
      emailService.sendSignupNotification(user.email, user.name, user.role).catch(err => {
        console.error('Error triggering signup notification email:', err.message);
      });

      // If registered user is a doctor, notify all admins for approval (non-blocking)
      if (user.role === 'doctor') {
        User.find({ role: 'admin' }).then(admins => {
          admins.forEach(admin => {
            emailService.sendDoctorPendingApprovalNotification(
              admin.email,
              admin.name,
              user.name,
              user.speciality,
              user.licenseNumber
            ).catch(err => {
              console.error(`Error notifying admin ${admin.email} about doctor approval:`, err.message);
            });
          });
        }).catch(err => {
          console.error('Error querying admins for doctor approval notification:', err.message);
        });
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        token: generateToken(user._id, user.role)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Send login notification email (non-blocking)
      emailService.sendLoginNotification(user.email, user.name, user.role).catch(err => {
        console.error('Error triggering login notification email:', err.message);
      });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        token: generateToken(user._id, user.role)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user details
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Fetch profile error:', error.message);
    res.status(500).json({ message: 'Server error fetching user profile' });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current logged in user profile details
 * @access  Private
 */
router.put('/profile', protect, async (req, res) => {
  const { name, email, languages, speciality, experience, consultationFee, profilePic } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update common fields
    if (name) user.name = name;
    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
      user.email = email;
    }
    if (languages) {
      if (Array.isArray(languages)) {
        user.languages = languages;
      } else if (typeof languages === 'string') {
        user.languages = languages.split(',').map(l => l.trim()).filter(Boolean);
      }
    }
    
    // Cloudinary profile pic upload handling
    if (profilePic !== undefined) {
      if (profilePic.startsWith('data:image')) {
        const secureUrl = await uploadImage(profilePic, 'medconnect_profiles');
        user.profilePic = secureUrl;
      } else {
        user.profilePic = profilePic;
      }
    }

    // Doctor specific fields
    if (user.role === 'doctor') {
      if (speciality) user.speciality = speciality;
      if (experience !== undefined) user.experience = Number(experience);
      if (consultationFee !== undefined) user.consultationFee = Number(consultationFee);
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

/**
 * @route   POST /api/auth/upload
 * @desc    Upload an image directly to Cloudinary (used by chat attachments)
 * @access  Private
 */
router.post('/upload', protect, async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ message: 'No image data provided' });
  }

  try {
    const secureUrl = await uploadImage(image, 'medconnect_chat');
    res.json({ imageUrl: secureUrl });
  } catch (error) {
    console.error('Upload endpoint error:', error.message);
    res.status(500).json({ message: 'Server error uploading image to Cloudinary' });
  }
});

module.exports = router;
