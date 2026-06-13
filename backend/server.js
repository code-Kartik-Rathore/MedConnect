require('dotenv').config(); // Trigger nodemon reload - port cleared
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const Message = require('./models/Message');

const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const slotRoutes = require('./routes/slotRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parser with size limits for base64 uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Route mounting
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Configure Socket.io for Consultation Rooms
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected to Socket.io: ${socket.id}`);

  // Join a specific consultation room
  socket.on('join_room', async ({ appointmentId, userId }) => {
    socket.join(appointmentId);
    console.log(`👤 User [${userId}] joined room: [${appointmentId}]`);
    
    // Send previous message logs to user
    try {
      const chatHistory = await Message.find({ appointmentId }).sort({ createdAt: 1 });
      socket.emit('chat_history', chatHistory);
    } catch (error) {
      console.error('Error fetching chat history on join:', error.message);
    }
  });

  // Handle message sending
  socket.on('send_message', async ({ appointmentId, senderId, content, image }) => {
    try {
      if (!appointmentId || !senderId) return;
      if (!content && !image) return;

      // Persist message to database
      const newMessage = await Message.create({
        appointmentId,
        senderId,
        content: content || '',
        image: image || ''
      });

      // Broadcast message to everyone in the room
      io.to(appointmentId).emit('receive_message', newMessage);
      console.log(`💬 Msg from ${senderId} in room ${appointmentId}`);
    } catch (error) {
      console.error('Error saving or broadcasting message:', error.message);
    }
  });

  // Relay WebRTC signaling between consultation room peers
  socket.on('webrtc_signal', ({ appointmentId, signal }) => {
    socket.to(appointmentId).emit('webrtc_signal', signal);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Connect to MongoDB & Start Server
const PORT = process.env.PORT || 5050;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medconnect';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('📦 Connected to MongoDB database successfully.');
    server.listen(PORT, () => {
      console.log(`🚀 MedConnect server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n👋 ${signal} received. Closing HTTP server and database connection...`);
  server.close(() => {
    console.log('🚀 HTTP server closed.');
    mongoose.connection.close(false, () => {
      console.log('📦 MongoDB connection closed.');
      process.exit(0);
    });
  });

  // Force exit after 3 seconds if not closed cleanly
  setTimeout(() => {
    console.error('⚠️ Forcefully shutting down after timeout.');
    process.exit(1);
  }, 3000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGUSR2', () => {
  console.log('\n👋 nodemon restart signal (SIGUSR2) received. Closing connections...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.kill(process.pid, 'SIGUSR2');
    });
  });
});

