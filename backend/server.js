// Simple Express proxy for Plant.id health_assessment
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.PLANT_ID_API_KEY;

const app = express();
app.use(cors());

// Serve static client files from the project root
app.use(express.static(path.join(__dirname)));

// Configure multer with more forgiving settings
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
    files: 1
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
    apiKeySet: !!API_KEY
  });
});

// Main POST endpoint with better error handling
app.post('/api/health', (req, res, next) => {
  // Log request for debugging
  console.log('📨 POST /api/health received');
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔑 API Key exists:', !!API_KEY);
  
  // Check API key early
  if (!API_KEY) {
    console.error('❌ Missing API key');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API key not configured'
    });
  }
  
  next();
}, upload.single('images'), async (req, res) => {
  try {
    console.log('📁 File upload attempt...');
    
    // Debug request
    console.log('📋 Request body:', req.body);
    console.log('📋 Request file:', req.file ? {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : 'No file');
    
    // Check for file
    if (!req.file) {
      console.error('❌ No file uploaded');
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please upload an image file'
      });
    }

    console.log(`✅ File received: ${req.file.originalname} (${req.file.size} bytes)`);

    // Prepare form data for Plant.id
    const form = new FormData();
    form.append('images', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype || 'image/jpeg',
    });
    form.append('health', 'true');

    console.log('📤 Sending to Plant.id API...');

    // Call Plant.id API
    const response = await fetch('https://plant.id/api/v3/health_assessment', {
      method: 'POST',
      headers: {
        'Api-Key': API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    });

    const text = await response.text();
    console.log(`📥 Plant.id response status: ${response.status}`);
    console.log(`📥 Response preview: ${text.substring(0, 200)}`);

    // Try to parse JSON
    try {
      const json = JSON.parse(text);
      return res.status(response.status).json(json);
    } catch (e) {
      console.error('❌ Failed to parse JSON:', e.message);
      return res.status(response.status).send(text);
    }
  } catch (err) {
    console.error('❌ Proxy error:', err);
    console.error('Stack:', err.stack);
    return res.status(500).json({ 
      error: 'Proxy error', 
      message: err.message,
      details: err.stack
    });
  }
});

// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer error:', err);
    return res.status(400).json({ 
      error: 'File upload error',
      message: err.message,
      code: err.code
    });
  }
  next(err);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Proxy server listening on http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  });
}

// Export for Vercel
module.exports = app;