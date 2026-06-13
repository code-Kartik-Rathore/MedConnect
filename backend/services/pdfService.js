const PDFDocument = require('pdfkit');

/**
 * Generates a PDF buffer for a prescription.
 * @param {Object} prescription - The prescription database document
 * @param {Object} appointment - The related appointment details
 * @param {Object} doctor - Doctor user details
 * @param {Object} patient - Patient user details
 * @returns {Promise<Buffer>} - Resolves to the PDF binary buffer
 */
function generatePrescriptionPDF(prescription, appointment, doctor, patient) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- BRANDING HEADER ---
      doc.fillColor('#0D9488') // Teal primary
         .rect(0, 0, 595.28, 20) // Full width top band
         .fill();

      doc.fillColor('#0F172A') // Dark Slate text
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('MedConnect', 50, 45)
         .fontSize(10)
         .font('Helvetica')
         .fillColor('#64748B')
         .text('Digital Care Platform', 50, 70);

      // Rx Logo (Traditional prescription symbol)
      doc.fontSize(36)
         .fillColor('#0D9488')
         .font('Helvetica-Bold')
         .text('R', 500, 45, { width: 50, align: 'right' });
      doc.fontSize(18)
         .text('x', 525, 60, { width: 20 });

      // Horizontal separator line
      doc.moveTo(50, 95)
         .lineTo(545, 95)
         .strokeColor('#E2E8F0')
         .lineWidth(1)
         .stroke();

      // --- DOCTOR & PATIENT DETAILS ---
      // Doctor column (left)
      doc.fillColor('#0F172A')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('PRESCRIBING DOCTOR:', 50, 115)
         .font('Helvetica')
         .text(`Dr. ${doctor.name}`, 50, 130)
         .text(`Specialty: ${doctor.speciality || 'General Medicine'}`, 50, 145)
         .text(`License No: ${doctor.licenseNumber || 'N/A'}`, 50, 160);

      // Patient/Appointment column (right)
      doc.font('Helvetica-Bold')
         .text('PATIENT DETAILS:', 320, 115)
         .font('Helvetica')
         .text(`Name: ${patient.name}`, 320, 130)
         .text(`Email: ${patient.email}`, 320, 145)
         .text(`Date: ${new Date(prescription.date).toLocaleDateString()}`, 320, 160)
         .text(`Appt ID: ${appointment._id.toString().slice(-8).toUpperCase()}`, 320, 175);

      // Separator line
      doc.moveTo(50, 200)
         .lineTo(545, 200)
         .strokeColor('#E2E8F0')
         .stroke();

      // --- DIAGNOSIS ---
      doc.fillColor('#0F172A')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('DIAGNOSIS / CLINICAL ASSESSMENT', 50, 220)
         .fontSize(10)
         .font('Helvetica')
         .fillColor('#334155')
         .text(prescription.diagnosis, 50, 240, { width: 495, align: 'justify' });

      // --- MEDICATIONS TABLE HEADER ---
      let currentY = 290;
      doc.fillColor('#0F172A')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('PRESCRIBED MEDICINES', 50, currentY);

      currentY += 25;
      
      // Table Header Row Background
      doc.fillColor('#F1F5F9')
         .rect(50, currentY, 495, 20)
         .fill();

      doc.fillColor('#475569')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('Medicine Name', 60, currentY + 6)
         .text('Dosage', 230, currentY + 6)
         .text('Frequency', 330, currentY + 6)
         .text('Duration', 460, currentY + 6);

      currentY += 20;

      // --- MEDICATIONS LIST ---
      doc.font('Helvetica')
         .fillColor('#0F172A');

      prescription.medicines.forEach((med, index) => {
        // Alternating background colors
        if (index % 2 === 1) {
          doc.fillColor('#F8FAFC')
             .rect(50, currentY, 495, 25)
             .fill();
        }
        
        doc.fillColor('#0F172A')
           .fontSize(9.5)
           .text(med.name, 60, currentY + 8, { width: 160 })
           .text(med.dosage, 230, currentY + 8, { width: 90 })
           .text(med.frequency, 330, currentY + 8, { width: 120 })
           .text(med.duration, 460, currentY + 8, { width: 80 });

        // Add subtle bottom line to row
        doc.moveTo(50, currentY + 25)
           .lineTo(545, currentY + 25)
           .strokeColor('#F1F5F9')
           .stroke();

        currentY += 25;
      });

      currentY += 20;

      // --- ADDITIONAL NOTES ---
      if (prescription.notes) {
        doc.fillColor('#0F172A')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('DOCTOR\'S REMARKS / INSTRUCTIONS', 50, currentY);

        currentY += 15;
        doc.fontSize(9.5)
           .font('Helvetica')
           .fillColor('#475569')
           .text(prescription.notes, 50, currentY, { width: 495, align: 'justify' });

        currentY += doc.heightOfString(prescription.notes, { width: 495 }) + 30;
      } else {
        currentY += 20;
      }

      // --- SIGNATURE SECTION ---
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.moveTo(350, currentY + 40)
         .lineTo(520, currentY + 40)
         .strokeColor('#94A3B8')
         .stroke();

      doc.fillColor('#475569')
         .fontSize(9)
         .text('Authorized Electronic Signature', 350, currentY + 46, { width: 170, align: 'center' })
         .text(`Dr. ${doctor.name}, ${doctor.speciality || 'Consultant'}`, 350, currentY + 58, { width: 170, align: 'center' });

      // --- FOOTER ---
      doc.fillColor('#94A3B8')
         .fontSize(8)
         .text('This is a digitally signed, secure prescription generated on MedConnect.', 50, 780, { align: 'center' })
         .text('Consult your doctor immediately if you experience adverse reactions.', 50, 790, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates a PDF buffer for a payment invoice.
 * @param {Object} appointment - The appointment database document
 * @param {Object} doctor - Doctor user details
 * @param {Object} patient - Patient user details
 * @returns {Promise<Buffer>} - Resolves to the PDF binary buffer
 */
function generateInvoicePDF(appointment, doctor, patient) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- BRANDING HEADER ---
      doc.fillColor('#0D9488') // Teal primary
         .rect(0, 0, 595.28, 20) // Full width top band
         .fill();

      doc.fillColor('#0F172A') // Dark Slate text
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('MedConnect', 50, 45)
         .fontSize(10)
         .font('Helvetica')
         .fillColor('#64748B')
         .text('Digital Care Platform', 50, 70);

      // INVOICE title
      doc.fontSize(24)
         .fillColor('#0D9488')
         .font('Helvetica-Bold')
         .text('INVOICE', 350, 45, { width: 200, align: 'right' });

      // Horizontal separator line
      doc.moveTo(50, 95)
         .lineTo(545, 95)
         .strokeColor('#E2E8F0')
         .lineWidth(1)
         .stroke();

      // --- INVOICE & BILLING DETAILS ---
      // Left Column: Billing Details
      doc.fillColor('#0F172A')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('PROVIDER / BILLING FROM:', 50, 115)
         .font('Helvetica')
         .text('MedConnect Care Solutions', 50, 130)
         .text(`Consultant: Dr. ${doctor.name}`, 50, 145)
         .text(`Department: ${doctor.speciality || 'General Medicine'}`, 50, 160);

      // Right Column: Invoice / Customer Details
      const invoiceNo = `INV-${appointment._id.toString().slice(-6).toUpperCase()}`;
      doc.font('Helvetica-Bold')
         .text('PATIENT / BILLING TO:', 320, 115)
         .font('Helvetica')
         .text(`Name: ${patient.name}`, 320, 130)
         .text(`Email: ${patient.email}`, 320, 145)
         .text(`Invoice Date: ${new Date(appointment.updatedAt).toLocaleDateString()}`, 320, 160)
         .text(`Invoice No: ${invoiceNo}`, 320, 175);

      // Separator line
      doc.moveTo(50, 200)
         .lineTo(545, 200)
         .strokeColor('#E2E8F0')
         .stroke();

      // --- TRANSACTION DETAILS ---
      doc.fillColor('#0F172A')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('TRANSACTION INFORMATION', 50, 220);

      doc.fontSize(9.5)
         .font('Helvetica')
         .fillColor('#334155')
         .text(`Payment Gateway: Razorpay Test Mode`, 50, 240)
         .text(`Transaction Reference: ${appointment.paymentId || 'N/A'}`, 50, 255)
         .text(`Status: Paid`, 50, 270);

      // --- ITEMIZATION TABLE ---
      let currentY = 310;
      doc.fillColor('#0F172A')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('BILLING DETAILS', 50, currentY);

      currentY += 20;
      
      // Table Header Row Background
      doc.fillColor('#F1F5F9')
         .rect(50, currentY, 495, 20)
         .fill();

      doc.fillColor('#475569')
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text('Description', 60, currentY + 6)
         .text('Fee (INR)', 450, currentY + 6, { width: 80, align: 'right' });

      currentY += 20;

      // Table Row Content
      doc.fillColor('#0F172A')
         .font('Helvetica')
         .fontSize(9)
         .text(`Telehealth Consultation with Dr. ${doctor.name} (${doctor.speciality || 'General Medicine'})`, 60, currentY + 8, { width: 350 })
         .text(`${appointment.date} @ ${appointment.startTime}`, 60, currentY + 22, { width: 350 })
         .text(`₹${doctor.consultationFee || 500}.00`, 450, currentY + 8, { width: 80, align: 'right' });

      // Add bottom line to row
      doc.moveTo(50, currentY + 40)
         .lineTo(545, currentY + 40)
         .strokeColor('#F1F5F9')
         .stroke();

      currentY += 40;

      // --- TOTAL SECTION ---
      currentY += 20;
      doc.fillColor('#F8FAFC')
         .rect(300, currentY, 245, 50)
         .fill();

      doc.fillColor('#475569')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('Subtotal:', 310, currentY + 10)
         .text(`₹${doctor.consultationFee || 500}.00`, 440, currentY + 10, { width: 95, align: 'right' })
         .fillColor('#0D9488')
         .fontSize(11)
         .text('Total Paid:', 310, currentY + 30)
         .text(`₹${doctor.consultationFee || 500}.00`, 440, currentY + 30, { width: 95, align: 'right' });

      // --- FOOTER ---
      doc.fillColor('#94A3B8')
         .fontSize(8)
         .text('This is a computer-generated receipt. No signature is required.', 50, 780, { align: 'center' })
         .text('Thank you for choosing MedConnect for your virtual care.', 50, 790, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generatePrescriptionPDF,
  generateInvoicePDF
};
