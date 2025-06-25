// controllers/authController.js
const { admin, db } = require('../firebase-config');
const jwt = require('jsonwebtoken');

// Helper function untuk menangani error
const handleError = (res, error) => {
    console.error('Authentication Error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server', error: error.message });
};

exports.googleLoginOrRegister = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: 'ID Token tidak ditemukan' });
    }

    try {
        // Verifikasi ID Token dari Google menggunakan Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { name, email, uid } = decodedToken;

        const userRef = db.collection('users').doc(email);
        const userDoc = await userRef.get();

        let userData;

        // Jika pengguna tidak ada di Firestore, buat pengguna baru (Registrasi)
        if (!userDoc.exists) {
            console.log(`Pengguna baru terdeteksi: ${email}. Membuat entri...`);
            const newUser = {
                fullName: name,
                email: email,
                firebaseUID: uid, // Simpan UID dari Firebase Auth
                level: 'Basic', // Level default untuk pengguna baru
                agency: '',
                industry: '',
                phone: '',
                notificationPref: false,
                createdAt: new Date().toISOString(),
            };
            await userRef.set(newUser);
            userData = newUser;
        } else {
            console.log(`Pengguna yang kembali: ${email}`);
            userData = userDoc.data();
            // Opsional: Update UID jika pengguna awalnya dibuat manual
            if (!userData.firebaseUID) {
                await userRef.update({ firebaseUID: uid });
            }
        }

        // Buat token sesi (JWT) untuk API Anda sendiri
        const sessionToken = jwt.sign(
            { email: userData.email, fullName: userData.fullName, uid: uid },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // Token berlaku selama 7 hari
        );

        res.status(200).json({
            message: 'Otentikasi berhasil',
            token: sessionToken,
            user: userData,
        });

    } catch (error) {
        handleError(res, error);
    }
};