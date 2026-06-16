# MedConnect 🏥

**MedConnect** is a state-of-the-art, secure, full-stack telehealth and digital clinical platform. It bridges the gap between patients and medical specialists while incorporating advanced AI diagnostics to analyze medical report PDFs. 

The platform supports booking availability slots, processing secure payments, consulting via real-time chat, and generating digital prescriptions.

---

## 🌟 Key Features

### 👤 Role-Based Dashboards
*   **Patient Dashboard:** Browse specialists, book appointments, complete payments, engage in real-time consultations, upload/analyze lab reports, and download digital prescriptions.
*   **Doctor Dashboard:** Set dynamic availability slots, review patient medical histories, join consultation chatrooms, and issue digital prescriptions.
*   **Admin Dashboard:** Platform-wide oversight of patients, doctors, and appointments, including registration approvals and service health monitoring.

### 🧠 Gemini AI Report Analyzer
*   **PDF Extraction:** Upload digital medical reports (PDFs) and extract raw text using `pypdf`.
*   **Structured Diagnostics:** Analyzes medical reports to output structured summaries, clinical severity levels, flagged out-of-bounds parameters, and next steps using Gemini 2.5 Flash.
*   **Smart Specialist Routing:** Recommends specific medical specialties based on clinical abnormalities found in reports.
*   **Patient-Friendly Explanation:** Simplifies complex medical jargon into warm, easy-to-understand explanations.
*   **Interactive Report Chatbot:** A context-aware chat interface allowing patients to ask questions directly about their uploaded reports.

### 💳 Secure Payments & Booking
*   **Razorpay Integration:** Seamless checkout flow. Appointments are secured and activated only after payment confirmation.
*   **Slot Management:** Dynamic doctor availability schedules that prevent double-booking.

### 💬 Real-Time Consultations
*   **Socket.io Chatrooms:** Instantly connect patients and doctors when consultations begin. Keep logs of all clinical chat history securely in MongoDB.

### 📄 Digital Prescriptions & Alerts
*   **PDF Generation:** Doctors generate official digital prescriptions on-the-fly using `PDFKit`.
*   **Email Notifications:** Email updates for bookings and payment transactions via Resend and Nodemailer.

---

## 🖼️ Application Walkthrough & Previews

> [!NOTE]
> *Screenshots below provide a visual guide to the application interfaces and workflows.*

### 🔍 Landing Page (Specialist Selector)
Discover and filter registered doctors by their clinical specialties.
<img width="1469" height="829" alt="image" src="https://github.com/user-attachments/assets/68d72a22-f6ff-4064-b291-864fb87a0628" />

<img width="1470" height="836" alt="image" src="https://github.com/user-attachments/assets/babaf02c-0432-41a7-be4c-7443c9de7d1d" />
<img width="1470" height="834" alt="image" src="https://github.com/user-attachments/assets/6e81f0ad-b4b0-4fa3-bcb4-bb5c07ae46f8" />


### 🔑 Authentication (Login / Signup)
Secure credentials-based authentication with role assignment (Patient or Doctor).
<img width="1470" height="834" alt="image" src="https://github.com/user-attachments/assets/2bdb95f3-5dbe-47a2-8eaf-f31d783e6f8f" />
<img width="1470" height="832" alt="image" src="https://github.com/user-attachments/assets/f321674c-7e2c-4bd0-aaf5-dd8f70287d03" />



### 📋 Patient Dashboard
Access appointment histories, review AI-analyzed reports, and join active consultations.
<!-- Replace the path below with your local screenshot path -->
<img width="1470" height="831" alt="image" src="https://github.com/user-attachments/assets/61f4ddb8-bdb5-481e-b4e8-a8f4cc9e2ca8" />



### 🧑‍⚕️ Doctor Dashboard
Manage schedules, edit availability slots, review upcoming consultations, and issue prescriptions.
<!-- Replace the path below with your local screenshot path -->

<img width="1469" height="834" alt="image" src="https://github.com/user-attachments/assets/56e4327f-238e-4774-b0e7-e5fb1da7b779" />



### 🛡️ Admin Control Panel
Full administrative view to monitor appointments, verify medical practitioners, and manage users.
<img width="1470" height="831" alt="image" src="https://github.com/user-attachments/assets/db465cb4-bb1c-4877-855a-e4e4bb854d39" />



### 💳 Payment Gateway Integration
Fast, secure checkout using Razorpay for direct slot reservations.
<img width="1470" height="837" alt="image" src="https://github.com/user-attachments/assets/39878510-ee16-472e-a269-eb6d81ec2d0d" />
<img width="1470" height="836" alt="image" src="https://github.com/user-attachments/assets/7209da58-526c-4f36-90b5-a26e2e62a2cf" />
<img width="1470" height="826" alt="image" src="https://github.com/user-attachments/assets/af2926f3-2907-4030-9a25-a582c2052d0d" />




### 🧬 AI Report Analyzer & Chatbot
Upload clinical lab PDFs for instant structured analysis and chat interactively about findings.
<img width="1470" height="836" alt="image" src="https://github.com/user-attachments/assets/2236b8ee-e36f-4949-88e3-d84fef22343a" />
<img width="1470" height="835" alt="image" src="https://github.com/user-attachments/assets/82f81de1-a01c-4e16-8420-761add7a67b1" />
<img width="1470" height="832" alt="image" src="https://github.com/user-attachments/assets/e51ebc17-1748-41ee-8e59-c355ab030049" />
<img width="1470" height="834" alt="image" src="https://github.com/user-attachments/assets/29c28ac6-aab1-4b44-b996-b578813a7e58" />


---

## 🛠️ Technology Stack

### Frontend
*   **Framework:** React 19, Vite (Fast build & HMR)
*   **Styling:** Custom Vanilla CSS (Responsive Design, Modern UI/UX)
*   **Icons:** Lucide React
*   **Communication:** Socket.io Client

### Backend
*   **Runtime:** Node.js, Express
*   **Database:** MongoDB, Mongoose ODM
*   **Real-time Communication:** Socket.io
*   **Payments:** Razorpay Node.js SDK
*   **Storage:** Cloudinary API (For prescription and report PDF storage)
*   **Emails:** Nodemailer & Resend SDK
*   **Document Generation:** PDFKit

### AI Service
*   **Framework:** FastAPI, Python 3
*   **Server:** Uvicorn
*   **Parsing:** pypdf (PDF text extraction)
*   **Client:** HTTPX (Asynchronous REST clients)
*   **LLM API:** Google Gemini 2.5 Flash API (with Grok API fallbacks)

---

## 📁 Repository Structure

```text
MedConnect/
├── frontend/             # React (Vite) App
│   ├── src/
│   │   ├── components/   # Reusable components (Navbar, ChatRoom, etc.)
│   │   ├── pages/        # Patient, Doctor, Admin Dashboards & Home
│   │   └── App.jsx       # Routing and Client Context
├── backend/              # Express API Server
│   ├── models/           # Mongoose schemas (User, Appointment, Slot, Report, etc.)
│   ├── routes/           # REST endpoints
│   ├── services/         # Cloudinary, Razorpay, PDF generation services
│   └── server.js         # Socket.io connection and main server startup
└── ai-service/           # Python FastAPI AI Microservice
    ├── main.py           # Report analyzer and Chat endpoints
    └── requirements.txt  # Python package list
```

---

## 🚀 Setup & Installation

Follow these steps to run MedConnect locally.

### 📋 Prerequisites
*   Node.js (v18+)
*   npm
*   Python 3.8+ & pip
*   MongoDB Instance (Local or Atlas)
*   Razorpay developer account credentials
*   Gemini API Key

---

### 1️⃣ AI Service Setup (Python)

1.  Navigate into `ai-service/`:
    ```bash
    cd ai-service
    ```
2.  Create and activate a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure environment variables. Create a `.env` file inside `ai-service/`:
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    PORT=8000
    ```
5.  Start the FastAPI server:
    ```bash
    uvicorn main:app --reload --port 8000
    ```
    The AI microservice will be running on `http://localhost:8000`.

---

### 2️⃣ Backend Setup (Node.js)

1.  Navigate into `backend/`:
    ```bash
    cd ../backend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Configure variables. Create a `.env` file:
    ```env
    PORT=5050
    MONGO_URI=mongodb+srv://your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret_token
    
    # Razorpay Credentials
    RAZORPAY_KEY_ID=rzp_test_...
    RAZORPAY_KEY_SECRET=your_razorpay_secret
    
    # Cloudinary Credentials (for PDF uploads)
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_cloudinary_key
    CLOUDINARY_API_SECRET=your_cloudinary_secret
    
    # AI Service URL
    AI_SERVICE_URL=http://localhost:8000
    
    # Resend Email Configuration (Optional)
    RESEND_API_KEY=re_...
    EMAIL_FROM=noreply@yourdomain.com
    ```
4.  Launch the backend development server:
    ```bash
    npm run dev
    ```
    The Express server runs on `http://localhost:5050`.

---

### 3️⃣ Frontend Setup (Vite + React)

1.  Navigate into `frontend/`:
    ```bash
    cd ../frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Set up frontend environment. Create a `.env` file:
    ```env
    VITE_API_URL=http://localhost:5050
    VITE_RAZORPAY_KEY_ID=rzp_test_...
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

---

## 🔒 Security & Medical Disclaimers
*   **No Diagnostic Liability:** The AI service parses reports for educational and informational purposes. The clinical output is not a replacement for professional medical consulting.
*   **HIPAA / Data Privacy:** All medical files are securely processed and stored. Ensure standard authentication checks are active when deploying public production instances.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
