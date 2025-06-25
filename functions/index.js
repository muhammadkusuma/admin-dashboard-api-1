const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');

const app = express();

// ✅ Middleware CORS: mengizinkan semua domain dan semua metode
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Middleware umum
app.use(express.json());

// ✅ Routes
const userRoutes = require('./routes/userRoutes');
const packageRoutes = require('./routes/packageRoutes');
const templateRoutes = require('./routes/templateRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const authRoutes = require('./routes/authRoutes');

app.use('/api', userRoutes);
app.use('/api', packageRoutes);
app.use('/api', templateRoutes);
app.use('/api', surveyRoutes);
app.use('/api/auth', authRoutes);

// ✅ Handle OPTIONS secara eksplisit (penting untuk CORS preflight)
app.options('*', cors());

// ✅ Health check
app.get('/', (req, res) => {
  res.status(200).send('API Firebase berjalan!');
});

// ✅ Export Firebase Function (tanpa region khusus dulu)
exports.api = functions.https.onRequest(app);
