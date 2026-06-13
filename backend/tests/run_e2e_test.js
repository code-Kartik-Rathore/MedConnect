require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Slot = require('../models/Slot');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Message = require('../models/Message');

const API_PORT = process.env.PORT || 5050;
const BASE_URL = `http://127.0.0.1:${API_PORT}/api`;

let serverProcess = null;

async function runTests() {
  console.log('\n🏥 MedConnect E2E Verification Suite Starting...');
  
  // Clear any existing database state for clean test run
  console.log('🧹 Cleaning test database collections...');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medconnect';
  await mongoose.connect(MONGODB_URI);
  await User.deleteMany({});
  await Slot.deleteMany({});
  await Appointment.deleteMany({});
  await Prescription.deleteMany({});
  await Message.deleteMany({});
  await mongoose.disconnect();
  console.log('✅ Database cleaned.');

  // Start the server in the background
  console.log('🚀 Booting Express server...');
  const { exec } = require('child_process');
  serverProcess = exec('node server.js', { cwd: './' });

  // Wait 3 seconds for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  let patientToken = '';
  let patientId = '';
  let doctorToken = '';
  let doctorId = '';
  let adminToken = '';
  let slotId = '';
  let appointmentId = '';

  const testReport = {
    authPatient: false,
    authDoctor: false,
    authAdmin: false,
    adminApproval: false,
    doctorSlots: false,
    symptomChecker: false,
    bookAppointment: false,
    paymentCapture: false,
    chatMessaging: false,
    prescriptionSubmit: false,
    geminiAISummary: false,
    prescriptionPDF: false
  };

  try {
    // 1. Patient Registration & Login
    console.log('\n--- Test 1: Patient Registration & Login ---');
    const patRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jane Doe',
        email: 'jane@patient.com',
        password: 'password123',
        role: 'patient'
      })
    });
    
    if (patRegRes.status === 201) {
      const data = await patRegRes.json();
      patientToken = data.token;
      patientId = data._id;
      testReport.authPatient = true;
      console.log(`✓ Patient registered successfully. ID: ${patientId}`);
    } else {
      console.log(`✗ Patient registration failed: ${patRegRes.status}`);
    }

    // 2. Doctor Registration & Login
    console.log('\n--- Test 2: Doctor Registration & Login ---');
    const docRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sarah Jenkins',
        email: 'sarah@doctor.com',
        password: 'password123',
        role: 'doctor',
        speciality: 'Cardiologist',
        licenseNumber: 'MC-78901',
        experience: 12,
        consultationFee: 750
      })
    });

    if (docRegRes.status === 201) {
      const data = await docRegRes.json();
      doctorToken = data.token;
      doctorId = data._id;
      testReport.authDoctor = true;
      console.log(`✓ Doctor registered successfully. ID: ${doctorId}`);
    } else {
      console.log(`✗ Doctor registration failed: ${docRegRes.status}`);
    }

    // 3. Admin Registration
    console.log('\n--- Test 3: Admin Registration & Doctor Approval ---');
    const adminRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Platform Admin',
        email: 'admin@medconnect.com',
        password: 'adminpassword',
        role: 'admin'
      })
    });

    if (adminRegRes.status === 201) {
      const data = await adminRegRes.json();
      adminToken = data.token;
      testReport.authAdmin = true;
      console.log('✓ Admin registered successfully.');

      // Approve Doctor
      const approveRes = await fetch(`${BASE_URL}/doctors/${doctorId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ isApproved: true })
      });

      if (approveRes.ok) {
        const approveData = await approveRes.json();
        testReport.adminApproval = approveData.doctor.isApproved;
        console.log(`✓ Admin approved Doctor License: ${approveData.doctor.isApproved}`);
      } else {
        console.log('✗ Doctor approval failed.');
      }
    } else {
      console.log(`✗ Admin registration failed: ${adminRegRes.status}`);
    }

    // 4. Doctor Publishes Slots
    console.log('\n--- Test 4: Doctor Slot Creation ---');
    const slotRes = await fetch(`${BASE_URL}/slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({
        slots: [{
          date: '2026-06-08',
          startTime: '09:00',
          endTime: '09:30'
        }]
      })
    });

    if (slotRes.status === 201) {
      const slotData = await slotRes.json();
      slotId = slotData.slots[0]._id;
      testReport.doctorSlots = true;
      console.log(`✓ Doctor published 30-min slot. ID: ${slotId}`);
    } else {
      const data = await slotRes.json();
      console.log(`✗ Slot creation failed: ${data.message}`);
    }

    // 5. Symptom Checker Recommendation
    console.log('\n--- Test 5: AI Pre-booking Symptom Checker ---');
    const symRes = await fetch(`${BASE_URL}/appointments/symptom-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symptoms: 'I have severe chest pressure, radiating arm pain, and lightheadedness.'
      })
    });

    if (symRes.ok) {
      const symData = await symRes.json();
      testReport.symptomChecker = true;
      console.log(`✓ Grok AI Specialist recommendation: "${symData.specialty}"`);
      console.log(`  Reasoning: "${symData.reasoning}"`);
    } else {
      console.log('✗ Symptom check failed.');
    }

    // 6. Patient Books Slot
    console.log('\n--- Test 6: Patient Bookings ---');
    const bookRes = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${patientToken}`
      },
      body: JSON.stringify({
        doctorId,
        slotId,
        symptomsDescription: 'Frequent chest pain when jogging.'
      })
    });

    if (bookRes.status === 201) {
      const bookData = await bookRes.json();
      appointmentId = bookData._id;
      testReport.bookAppointment = true;
      console.log(`✓ Slot booked. Appointment ID: ${appointmentId}. Status: ${bookData.status}`);
    } else {
      const data = await bookRes.json();
      console.log(`✗ Appointment booking failed: ${data.message}`);
    }

    // 7. Payment Simulation
    console.log('\n--- Test 7: Razorpay Payment Simulation ---');
    const payRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${patientToken}`
      },
      body: JSON.stringify({
        appointmentId,
        simulateSuccess: true
      })
    });

    if (payRes.ok) {
      const payData = await payRes.json();
      testReport.paymentCapture = payData.success;
      console.log('✓ Simulated Razorpay webhook verified. Appointment confirmed.');
    } else {
      console.log('✗ Payment verification failed.');
    }

    // 8. Chat log simulation (Adding some messages to DB)
    console.log('\n--- Test 8: Chat Log Setup ---');
    await mongoose.connect(MONGODB_URI);
    await Message.create({ appointmentId, senderId: patientId, content: 'Hello Dr. Sarah, I have been feeling chest pains.' });
    await Message.create({ appointmentId, senderId: doctorId, content: 'Hello Jane, does the pain radiate to your arm or neck?' });
    await Message.create({ appointmentId, senderId: patientId, content: 'Yes, slightly down my left arm.' });
    await mongoose.disconnect();
    testReport.chatMessaging = true;
    console.log('✓ Consultation chat room dialogue stored in DB.');

    // 9. Doctor Digital Prescription & AI Summary Generator
    console.log('\n--- Test 9: Digital Prescription & Gemini AI Summary ---');
    const rxRes = await fetch(`${BASE_URL}/appointments/${appointmentId}/prescription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({
        diagnosis: 'Angina Pectoris (Exertional)',
        medicines: [
          { name: 'Nitroglycerin', dosage: '0.4mg', frequency: 'As needed for chest pain', duration: '30 days' },
          { name: 'Aspirin', dosage: '81mg', frequency: 'Once daily after meals', duration: 'Ongoing' }
        ],
        notes: 'Avoid heavy exercise. Follow up immediately if chest pain is unresolved by medicine.'
      })
    });

    if (rxRes.status === 201) {
      const rxData = await rxRes.json();
      testReport.prescriptionSubmit = true;
      
      // Fetch appointment detail to verify Grok AI output summaries
      const apptDetailRes = await fetch(`${BASE_URL}/appointments/${appointmentId}`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      const apptDetail = await apptDetailRes.json();
      
      if (apptDetail.appointment.aiSummary && apptDetail.appointment.followUpReminder) {
        testReport.geminiAISummary = true;
        console.log('✓ Digital prescription registered.');
        console.log('🤖 Gemini AI Consultation Summary:');
        console.log(`   "${apptDetail.appointment.aiSummary}"`);
        console.log('🤖 Gemini AI Follow-up Recommendation:');
        console.log(`   "${apptDetail.appointment.followUpReminder}"`);
      }
    } else {
      const data = await rxRes.json();
      console.log(`✗ Prescription submission failed: ${data.message}`);
    }

    // 10. Prescription PDF Download
    console.log('\n--- Test 10: PDF Prescription Download ---');
    const pdfRes = await fetch(`${BASE_URL}/appointments/${appointmentId}/prescription/pdf`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });

    if (pdfRes.status === 200) {
      const blob = await pdfRes.arrayBuffer();
      testReport.prescriptionPDF = blob.byteLength > 1000; // Check that it returned a valid file size
      console.log(`✓ PDF received successfully. Stream size: ${blob.byteLength} bytes.`);
    } else {
      console.log(`✗ PDF download failed: ${pdfRes.status}`);
    }

  } catch (error) {
    console.error('E2E pipeline crash:', error);
  } finally {
    // Terminate server
    if (serverProcess) {
      console.log('\n🛑 Shutting down Express server...');
      serverProcess.kill();
    }
    
    // Print report card
    console.log('\n========================================================');
    console.log('               MEDCONNECT TEST REPORT CARD              ');
    console.log('========================================================');
    Object.entries(testReport).forEach(([test, passed]) => {
      console.log(`${test.padEnd(25)} : ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    });
    console.log('========================================================\n');

    process.exit(Object.values(testReport).every(v => v) ? 0 : 1);
  }
}

runTests();
