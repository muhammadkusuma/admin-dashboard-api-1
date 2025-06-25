// firebase-config.js
const admin = require('firebase-admin');
require('dotenv').config();

// Ambil kredensial dari environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Inisialisasi Firebase Admin SDK hanya jika belum ada
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Ekspor instance Firestore untuk digunakan di file lain
const db = admin.firestore();

module.exports = { db };