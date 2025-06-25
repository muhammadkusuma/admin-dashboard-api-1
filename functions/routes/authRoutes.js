// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rute untuk menangani login/register dengan Google
router.post('/google', authController.googleLoginOrRegister);

module.exports = router;