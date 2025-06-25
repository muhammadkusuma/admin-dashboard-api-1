// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Rute untuk mendapatkan ringkasan data pengguna dan transaksi
router.get('/summary', userController.getUserSummary);

// Rute untuk mendapatkan riwayat transaksi seorang pengguna
router.get('/transactions/:email', userController.getUserTransactions);

// Rute untuk CRUD Pengguna
router.post('/users', userController.createUser);
router.put('/users/:email', userController.updateUser);
router.delete('/users/:email', userController.deleteUser);

module.exports = router;