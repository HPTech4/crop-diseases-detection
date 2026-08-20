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

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/health', upload.single('images'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!API_KEY) return res.status(500).json({ error: 'Server missing API key' });

    const form = new FormData();
    form.append('images', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('health', 'true');

    const response = await fetch('https://plant.id/api/v3/health_assessment', {
      method: 'POST',
      headers: {
        'Api-Key': API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    });
    const text = await response.text();
    console.log('[proxy] upstream status:', response.status, 'body-snippet:', text && text.toString().slice(0,300));
    // Try to parse JSON, fall back to raw text
    try {
      const json = JSON.parse(text);
      return res.status(response.status).json(json);
    } catch (e) {
      return res.status(response.status).send(text);
    }
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});
app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
