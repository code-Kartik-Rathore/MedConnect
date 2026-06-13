const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
let resendClient = null;

if (apiKey && apiKey.trim() !== '') {
  resendClient = new Resend(apiKey);
  console.log('✉️ Email Service running with Resend API client.');
} else {
  console.log('✉️ Email Service running in Mock/Console Mode (RESEND_API_KEY is missing).');
}

/**
 * Base email sending utility
 */
async function sendEmail({ to, subject, html, text }) {
  const fromEnv = (process.env.SENDER_EMAIL || '').trim();
  const from = (resendClient && (fromEnv === '' || fromEnv === 'noreply@medconnect.com'))
    ? 'onboarding@resend.dev'
    : (fromEnv || 'onboarding@resend.dev');
  if (resendClient) {
    try {
      const response = await resendClient.emails.send({
        from: `MedConnect <${from}>`,
        to,
        subject,
        html,
        text
      });
      return response;
    } catch (error) {
      console.error(`❌ Failed to send email via Resend to ${to}:`, error.message);
      throw error;
    }
  } else {
    console.log('\n=================== MOCK EMAIL SENT (RESEND FALLBACK) ===================');
    console.log(`From:    MedConnect <${from}>`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('--------------------------- BODY ---------------------------');
    console.log(text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
    console.log('=========================================================================\n');
    return { id: 'mock-resend-id-' + Date.now() };
  }
}

/**
 * Send welcome email on registration (signup)
 */
async function sendSignupNotification(email, name, role) {
  let roleText = '';
  let dashboardInstructions = '';
  
  if (role === 'admin') {
    roleText = 'an Administrator';
    dashboardInstructions = 'You can now log in to review doctor registrations, manage system settings, and coordinate appointments.';
  } else if (role === 'doctor') {
    roleText = 'a Medical Practitioner';
    dashboardInstructions = 'Your profile is currently <strong>pending admin approval</strong>. You will receive an email as soon as our administrators verify your medical credentials. Once approved, you can set your availability and host digital consultations.';
  } else {
    roleText = 'a Patient';
    dashboardInstructions = 'You can now browse through qualified specialists, book slots, complete secure payments, and connect via video/chat consultations directly from your patient dashboard.';
  }

  const subject = `Welcome to MedConnect, ${name}!`;
  const text = `Welcome to MedConnect, ${name}! Your account has been registered successfully as ${role === 'doctor' ? 'a doctor (pending approval)' : role}.\n\nInstructions: ${dashboardInstructions}`;
  
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.025em;">MedConnect</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Your Digital Health Companion</p>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 25px;" />
      <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 10px;">Account Created Successfully</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Hello <strong>${name}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Thank you for joining MedConnect! Your profile has been created as <strong>${roleText}</strong>.
      </p>
      <div style="background-color: #f8fafc; border-left: 4px solid #0d9488; padding: 15px 20px; border-radius: 6px; margin: 20px 0; font-size: 14px; line-height: 1.5; color: #475569;">
        ${dashboardInstructions}
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 25px;">
        If you have any questions or need support getting started, feel free to contact our helper line.
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-top: 25px; margin-bottom: 15px;" />
      <p style="font-size: 12px; text-align: center; color: #94a3b8; margin: 0;">
        This email was sent to ${email} because you signed up on MedConnect.<br/>
        &copy; 2026 MedConnect Inc. All rights reserved.
      </p>
    </div>
  `;

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Send security alert email on login
 */
async function sendLoginNotification(email, name, role) {
  const loginTime = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
  const subject = `MedConnect: New Login Detected`;
  const text = `Hello ${name},\n\nWe detected a new login to your MedConnect ${role} account on ${loginTime}.\n\nIf this was not you, please secure your account by changing your password immediately.`;
  
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.025em;">MedConnect</h1>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 25px;" />
      <h2 style="color: #0f172a; font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 10px;">Security Notification: New Login</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Hello <strong>${name}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        This email is to notify you that your MedConnect <strong>${role}</strong> account was accessed on <strong>${loginTime}</strong>.
      </p>
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 6px; margin: 20px 0; font-size: 14px; line-height: 1.5; color: #b45309;">
        <strong>If this was you:</strong> You can safely ignore this email.<br/>
        <strong>If this was NOT you:</strong> Please log in to your dashboard and change your password immediately to secure your account.
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-top: 25px; margin-bottom: 15px;" />
      <p style="font-size: 12px; text-align: center; color: #94a3b8; margin: 0;">
        This is an automated security notification. Please do not reply directly to this message.
      </p>
    </div>
  `;

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Send pending approval alert to Admin when a doctor signs up
 */
async function sendDoctorPendingApprovalNotification(adminEmail, adminName, doctorName, speciality, licenseNumber) {
  const subject = `MedConnect: Action Required - Approve Profile for Dr. ${doctorName}`;
  const text = `Hello Admin ${adminName},\n\nA new doctor, Dr. ${doctorName} (${speciality}), has signed up on MedConnect and is pending approval.\n\nLicense Number: ${licenseNumber}\n\nPlease log in to the admin panel to review and approve their profile.`;
  
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.025em;">MedConnect</h1>
        <p style="color: #475569; font-weight: 500; font-size: 14px;">Administration Console</p>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 25px;" />
      <h2 style="color: #0f172a; font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Pending Doctor Verification</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 15px;">
        Hello <strong>${adminName}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        A new healthcare practitioner has completed registration and is awaiting credentials review.
      </p>
      <div style="background-color: #f1f5f9; padding: 18px; border-radius: 8px; margin: 20px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">
        <h3 style="margin-top: 0; margin-bottom: 10px; color: #0f172a; font-size: 15px;">Doctor Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; width: 35%;"><strong>Name:</strong></td>
            <td style="padding: 4px 0; color: #0f172a;">Dr. ${doctorName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;"><strong>Speciality:</strong></td>
            <td style="padding: 4px 0; color: #0f172a;">${speciality}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;"><strong>License No:</strong></td>
            <td style="padding: 4px 0; color: #0f172a; font-family: monospace;">${licenseNumber}</td>
          </tr>
        </table>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 25px;">
        Please log into the MedConnect Admin panel and review their details to approve or reject their application.
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-top: 25px; margin-bottom: 15px;" />
      <p style="font-size: 12px; text-align: center; color: #94a3b8; margin: 0;">
        This notification was dispatched to all registered administrators.
      </p>
    </div>
  `;

  await sendEmail({ to: adminEmail, subject, html, text });
}

/**
 * Send approval confirmation email to Doctor
 */
async function sendDoctorApprovedNotification(email, doctorName) {
  const subject = `MedConnect: Your Account Has Been Approved!`;
  const text = `Hello Dr. ${doctorName},\n\nWe are excited to inform you that your doctor account has been approved by the admin.\n\nYou can now log in, configure your consulting availability slots, and start receiving consultations from patients.\n\nThank you,\nMedConnect Operations Team`;
  
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.025em;">MedConnect</h1>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 25px;" />
      <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 10px;">Verification Successful</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Hello <strong>Dr. ${doctorName}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        We are pleased to inform you that our administration team has verified your credentials and <strong>approved your MedConnect profile</strong>.
      </p>
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px 20px; border-radius: 6px; margin: 20px 0; font-size: 14px; line-height: 1.5; color: #065f46;">
        <strong>What's Next?</strong><br/>
        1. Log in to your doctor portal dashboard.<br/>
        2. Set up your consult slots availability under 'Manage Slots'.<br/>
        3. Patients can now browse your profile and book digital appointments!
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 25px;">
        Welcome onboard, and thank you for helping us provide quality digital healthcare.
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-top: 25px; margin-bottom: 15px;" />
      <p style="font-size: 12px; text-align: center; color: #94a3b8; margin: 0;">
        This is a transactional confirmation notification.
      </p>
    </div>
  `;

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Send booking and receipt email to Patient
 */
async function sendPatientBookingAndPaymentNotification(email, patientName, doctorName, date, time, fee) {
  const subject = `MedConnect: Booking & Payment Confirmed - Dr. ${doctorName}`;
  const text = `Hello ${patientName},\n\nYour appointment booking and payment has been confirmed.\n\nDetails:\nDoctor: Dr. ${doctorName}\nDate: ${date}\nTime: ${time}\nAmount Paid: INR ${fee}\n\nPlease log in to your dashboard to access the consultation room.`;
  
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.025em;">MedConnect</h1>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 25px;" />
      <h2 style="color: #0d9488; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 10px;">Booking & Payment Confirmed</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 15px;">
        Hello <strong>${patientName}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        Your consultation has been successfully booked, and the payment transaction was completed.
      </p>
      <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 35%;"><strong>Doctor:</strong></td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">Dr. ${doctorName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Date:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${date}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Time:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${time} (30 mins)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Amount Paid:</strong></td>
            <td style="padding: 6px 0; color: #0d9488; font-weight: 600;">INR ${fee}.00</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Status:</strong></td>
            <td style="padding: 6px 0; color: #10b981; font-weight: 600;">Paid & Confirmed</td>
          </tr>
        </table>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 25px;">
        Please log into the patient dashboard to join the consultation room when your slot starts.
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-top: 25px; margin-bottom: 15px;" />
      <p style="font-size: 12px; text-align: center; color: #94a3b8; margin: 0;">
        Thank you for booking with MedConnect.
      </p>
    </div>
  `;

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Send booking notification and payment credit email to Doctor
 */
async function sendDoctorBookingAndPaymentNotification(email, doctorName, patientName, date, time, fee) {
  const subject = `MedConnect: New Booking & Payment Credit - ${patientName}`;
  const text = `Hello Dr. ${doctorName},\n\nA patient, ${patientName}, has booked an appointment slot with you.\n\nDetails:\nPatient: ${patientName}\nDate: ${date}\nTime: ${time}\nEarnings Credited: INR ${fee}\n\nPlease be ready to join the consultation room in your dashboard at the scheduled time.`;
  
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.025em;">MedConnect</h1>
      </div>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 25px;" />
      <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 10px;">New Consultation Booked</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 15px;">
        Hello <strong>Dr. ${doctorName}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
        A new patient has scheduled a consultation with you and completed the payment.
      </p>
      <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 35%;"><strong>Patient:</strong></td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${patientName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Date:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${date}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Time:</strong></td>
            <td style="padding: 6px 0; color: #0f172a;">${time} (30 mins)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Earnings:</strong></td>
            <td style="padding: 6px 0; color: #0d9488; font-weight: 600;">INR ${fee}.00</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Payment Status:</strong></td>
            <td style="padding: 6px 0; color: #10b981; font-weight: 600;">Credited (Held for Completion)</td>
          </tr>
        </table>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 25px;">
        Please open your provider dashboard to connect with the patient when the slot begins.
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin-top: 25px; margin-bottom: 15px;" />
      <p style="font-size: 12px; text-align: center; color: #94a3b8; margin: 0;">
        Thank you for partner consulting with MedConnect.
      </p>
    </div>
  `;

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Legacy support for booking confirmation (nodemailer compatible)
 */
async function sendBookingConfirmation(email, patientName, doctorName, date, time) {
  await sendPatientBookingAndPaymentNotification(email, patientName, doctorName, date, time, 500);
}

/**
 * Send cancellation & refund email
 */
async function sendCancellationNotification(email, recipientName, doctorName, date, time, reason = '', refunded = false) {
  const subject = refunded ? 'MedConnect: Appointment Cancelled & Refund Initiated' : 'MedConnect: Appointment Cancelled';
  const refundStatusText = refunded 
    ? 'A full refund has been initiated to your original payment method. It may take 5-7 business days to reflect.' 
    : 'If you paid for this appointment, please contact support or check your dashboard for refund details.';

  const text = `Hello ${recipientName},\n\nYour appointment with Dr. ${doctorName} on ${date} at ${time} has been cancelled.\nReason: ${reason || 'Not specified'}\n\n${refundStatusText}\n\nBest regards,\nMedConnect Support Team`;
  
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
      <h2 style="color: #ef4444; font-size: 20px; font-weight: 600; margin-top: 0;">Appointment Cancelled</h2>
      <p>Hello <strong>${recipientName}</strong>,</p>
      <p>We regret to inform you that your appointment with <strong>Dr. ${doctorName}</strong> has been cancelled.</p>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; color: #991b1b;">
        <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
        <p style="margin: 5px 0;"><strong>Reason:</strong> ${reason || 'Cancelled by provider'}</p>
      </div>
      <p><strong>Refund Status:</strong> ${refundStatusText}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b;">This is a system generated email. Please do not reply directly.</p>
    </div>
  `;

  await sendEmail({ to: email, subject, html, text });
}

/**
 * Send digital prescription ready email
 */
async function sendPrescriptionReadyNotification(email, patientName, doctorName) {
  const subject = 'MedConnect: Digital Prescription Ready';
  const text = `Hello ${patientName},\n\nDr. ${doctorName} has issued your digital prescription.\n\nYou can view the summary and download the PDF from your booking history on the MedConnect portal.\n\nBest regards,\nMedConnect Support Team`;
  
  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
      <h2 style="color: #0d9488; font-size: 20px; font-weight: 600; margin-top: 0;">Prescription Issued</h2>
      <p>Hello <strong>${patientName}</strong>,</p>
      <p>Your digital prescription has been successfully generated by <strong>Dr. ${doctorName}</strong>.</p>
      <p>Please log in to your patient dashboard, head to the booking history section, and download your digital prescription PDF.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b;">This is a system generated email. Please do not reply directly.</p>
    </div>
  `;

  await sendEmail({ to: email, subject, html, text });
}

module.exports = {
  sendSignupNotification,
  sendLoginNotification,
  sendDoctorPendingApprovalNotification,
  sendDoctorApprovedNotification,
  sendPatientBookingAndPaymentNotification,
  sendDoctorBookingAndPaymentNotification,
  sendBookingConfirmation,
  sendCancellationNotification,
  sendPrescriptionReadyNotification
};
