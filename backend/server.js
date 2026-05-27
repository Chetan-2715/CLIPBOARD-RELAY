const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { Redis } = require('@upstash/redis');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

// Verify required env variables
const requiredEnv = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`CRITICAL: Missing environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Initialize Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize Express and HTTP Server
const app = express();
const server = http.createServer(app);

// Configure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Set up Multer for file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Helper: Generate a secure 6-character uppercase room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded easily confused letters: I, O, 0, 1
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// REST Endpoint: Create a new room
app.post('/api/room', async (req, res) => {
  try {
    let roomCode = generateRoomCode();
    let keyExists = await redis.exists(`room:${roomCode}`);
    
    // Ensure uniqueness
    let attempts = 0;
    while (keyExists && attempts < 5) {
      roomCode = generateRoomCode();
      keyExists = await redis.exists(`room:${roomCode}`);
      attempts++;
    }

    if (keyExists) {
      return res.status(500).json({ error: 'Failed to generate a unique room code. Please try again.' });
    }

    const key = `room:${roomCode}`;
    // Initialize an empty room state in Redis with 15 minutes TTL (900 seconds)
    await redis.set(key, JSON.stringify([]), { ex: 900 });

    res.status(201).json({ roomCode, ttlRemaining: 900 });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Server error initializing session' });
  }
});

// REST Endpoint: Check if room exists and fetch data
app.get('/api/room/:code', async (req, res) => {
  const roomCode = req.params.code.toUpperCase();
  const key = `room:${roomCode}`;

  try {
    const data = await redis.get(key);
    if (!data) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const items = typeof data === 'string' ? JSON.parse(data) : data;
    const ttlRemaining = await redis.ttl(key);

    res.json({ roomCode, items, ttlRemaining });
  } catch (error) {
    console.error('Error fetching room data:', error);
    res.status(500).json({ error: 'Server error retrieving room data' });
  }
});

// REST Endpoint: Upload File to Cloudinary
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    // Upload buffer directly to Cloudinary using upload_stream
    const uploadStream = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'ephemeral_clipboard',
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
    };

    const cloudinaryResult = await uploadStream();

    res.json({
      url: cloudinaryResult.secure_url,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Event: Join a Room
  socket.on('join-room', async ({ roomCode }) => {
    if (!roomCode) return;
    const code = roomCode.toUpperCase();
    const key = `room:${code}`;

    try {
      const data = await redis.get(key);
      if (!data) {
        socket.emit('error', 'Session expired or invalid room code');
        return;
      }

      socket.join(code);
      console.log(`Socket ${socket.id} joined room: ${code}`);

      const items = typeof data === 'string' ? JSON.parse(data) : data;
      const ttlRemaining = await redis.ttl(key);

      // Send initial data to the user who joined
      socket.emit('room-data', { items, ttlRemaining });
    } catch (error) {
      console.error('Socket join error:', error);
      socket.emit('error', 'Database read error joining room');
    }
  });

  // Event: Add Item (Text or File)
  socket.on('send-item', async ({ roomCode, item }) => {
    if (!roomCode || !item) return;
    const code = roomCode.toUpperCase();
    const key = `room:${code}`;

    try {
      const data = await redis.get(key);
      if (!data) {
        socket.emit('error', 'Session expired');
        return;
      }

      const items = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Enforce limits (e.g. max 50 items in a room to prevent abuse)
      if (items.length >= 50) {
        items.shift(); // Remove oldest
      }

      const newItem = {
        id: crypto.randomUUID(),
        type: item.type, // 'text' | 'file'
        content: item.content, // string content or URL
        fileName: item.fileName || null,
        fileType: item.fileType || null,
        fileSize: item.fileSize || null,
        createdAt: Date.now()
      };

      items.push(newItem);

      // Save back to Redis with a refreshed 15-minute TTL (900 seconds)
      await redis.set(key, JSON.stringify(items), { ex: 900 });

      // Broadcast to everyone in the room
      io.to(code).emit('room-data', { items, ttlRemaining: 900 });
      console.log(`Item added to room ${code}: ${newItem.type}`);
    } catch (error) {
      console.error('Socket send-item error:', error);
      socket.emit('error', 'Database write error adding item');
    }
  });

  // Event: Clear Session
  socket.on('clear-session', async ({ roomCode }) => {
    if (!roomCode) return;
    const code = roomCode.toUpperCase();
    const key = `room:${code}`;

    try {
      // Delete room from Redis
      await redis.del(key);
      console.log(`Room deleted from Redis: ${code}`);

      // Broadcast room cleared to all clients in the room
      io.to(code).emit('room-cleared');

      // Make all sockets in that room leave
      const sockets = await io.in(code).fetchSockets();
      sockets.forEach((s) => {
        s.leave(code);
      });
    } catch (error) {
      console.error('Socket clear-session error:', error);
      socket.emit('error', 'Database error deleting session');
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
