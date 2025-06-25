// index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Impor rute
const userRoutes = require('./routes/userRoutes');
const packageRoutes = require('./routes/packageRoutes');
const templateRoutes = require('./routes/templateRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const authRoutes = require('./routes/authRoutes');

// Inisialisasi aplikasi express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Mengizinkan permintaan dari domain lain (frontend Anda)
app.use(express.json()); // Mem-parsing body request JSON

// Menggunakan Rute
app.use('/api', userRoutes);
app.use('/api', packageRoutes);
app.use('/api', templateRoutes);
app.use('/api', surveyRoutes);
app.use('/api/auth', authRoutes);

// Rute dasar untuk cek kesehatan server
app.get('/', (req, res) => {
  res.send('API Admin Dashboard Berjalan!');
});

// Menjalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});