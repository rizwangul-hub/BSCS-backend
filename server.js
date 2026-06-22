import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import http from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';
import { initSocket } from './sockets/socketService.js';

// Load environmental variables
dotenv.config();

// Handle Uncaught Exceptions (synchronous errors that occur outside express lifecycle)
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down gracefully...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Connect to MongoDB Database
connectDB().then(() => {
  import('./migrate_old_registrations_inline.js').then((m) => {
    m.runInlineMigration().catch(console.error);
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO server
const io = initSocket(server);

// Define PORT
const PORT = process.env.PORT || 5000;

// Listen on HTTP server
const runningServer = server.listen(PORT, () => {
  console.log(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle Unhandled Rejections (asynchronous promise rejections)
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down gracefully...');
  console.error(err.name, err.message, err.stack);
  runningServer.close(() => {
    process.exit(1);
  });
});
