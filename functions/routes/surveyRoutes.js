const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
// Misal Anda punya middleware untuk cek autentikasi
// const { isAuthenticated } = require('../middleware/authMiddleware');

// === Rute Publik (Tanpa Autentikasi) ===
// Diletakkan di atas agar tidak tertangkap oleh rute dinamis yang butuh auth
// Rute untuk narasumber mengambil detail survei
router.get('/surveys/public/:id', surveyController.getPublicSurvey);

// === Rute untuk Dasbor Analisis (Butuh Autentikasi) ===
// PENTING: Tempatkan rute spesifik ini SEBELUM rute '/surveys/:id'
router.get('/surveys/:id/analysis', /* isAuthenticated, */ surveyController.getSurveyAnalysis);

// Rute untuk narasumber mengirim jawaban
router.post('/surveys/:id/responses', surveyController.submitSurveyResponse);


// === Rute Template (Butuh Autentikasi) ===
// Anggap saja semua rute di bawah ini memerlukan login (isAuthenticated)
router.get('/templates', /* isAuthenticated, */ surveyController.getTemplates);
router.post('/templates', /* isAuthenticated, */ surveyController.createTemplate);
router.put('/templates/:id', /* isAuthenticated, */ surveyController.updateTemplate);
router.delete('/templates/:id', /* isAuthenticated, */ surveyController.deleteTemplate);


// === Rute Survei untuk Peneliti (Butuh Autentikasi) ===
// Rute untuk peneliti mengambil semua data surveinya
router.get('/surveys', /* isAuthenticated, */ surveyController.getSurveys);

// Rute untuk peneliti membuat survei baru
router.post('/surveys', /* isAuthenticated, */ surveyController.createSurvey);

// PENTING: Rute dinamis '/surveys/:id' harus diletakkan di bawah rute statis/spesifik
// seperti '/surveys/public/:id' atau '/surveys/responses' untuk menghindari konflik.
// Rute untuk peneliti mengupdate survei
router.put('/surveys/:id', /* isAuthenticated, */ surveyController.updateSurvey);

// Rute untuk peneliti menghapus survei
router.delete('/surveys/:id', /* isAuthenticated, */ surveyController.deleteSurvey);


module.exports = router;