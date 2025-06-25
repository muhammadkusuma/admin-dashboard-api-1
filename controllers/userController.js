// controllers/userController.js
const { db } = require('../firebase-config');

// Helper function untuk menangani error
const handleError = (res, error) => {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server', error: error.message });
};

// GET /api/summary (Hanya perlu mengubah 'name' menjadi 'fullName')
exports.getUserSummary = async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const transactionsSnapshot = await db.collection('transactions').get();

        const transactions = transactionsSnapshot.docs.map(doc => doc.data());

        const summary = usersSnapshot.docs.map(userDoc => {
            const user = userDoc.data();
            const userTransactions = transactions.filter(
                trx => trx.customerEmail === user.email && trx.status === 'Berhasil'
            );

            const totalSpending = userTransactions.reduce((sum, trx) => sum + (trx.amount || 0), 0);

            // DIUBAH: Menggunakan data pengguna yang lebih lengkap
            return {
                fullName: user.fullName, // DIUBAH
                email: user.email,
                level: user.level,
                agency: user.agency,
                industry: user.industry,
                phone: user.phone,
                notificationPref: user.notificationPref,
                totalTransactions: userTransactions.length,
                totalSpending,
            };
        }).sort((a, b) => b.totalSpending - a.totalSpending);

        res.status(200).json(summary);
    } catch (error) {
        handleError(res, error);
    }
};

// GET /api/transactions/:email (Tidak ada perubahan)
exports.getUserTransactions = async (req, res) => {
    try {
        const { email } = req.params;
        const transactionsSnapshot = await db.collection('transactions').where('customerEmail', '==', email).orderBy('date', 'desc').get();

        if (transactionsSnapshot.empty) {
            return res.status(200).json([]);
        }

        const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(transactions);
    } catch (error) {
        handleError(res, error);
    }
};

// POST /api/users (Diubah secara signifikan)
exports.createUser = async (req, res) => {
    try {
        // DIUBAH: Ambil semua data baru dari body
        const {
            fullName,
            email,
            level,
            agency,
            industry,
            phone,
            notificationPref
        } = req.body;

        // Validasi field yang wajib diisi
        if (!fullName || !email || !level) {
            return res.status(400).json({ message: 'Nama Lengkap, Email, dan Level wajib diisi' });
        }

        const userRef = db.collection('users').doc(email);
        const doc = await userRef.get();

        if (doc.exists) {
            return res.status(409).json({ message: 'Email sudah terdaftar' });
        }

        // BARU: Siapkan objek data pengguna yang lengkap
        const newUser = {
            fullName,
            email,
            level,
            agency: agency || '', // Default ke string kosong jika tidak ada
            industry: industry || '',
            phone: phone || '',
            notificationPref: notificationPref || false, // Default ke false
            createdAt: new Date().toISOString(),
        };

        await userRef.set(newUser);
        res.status(201).json({ message: 'Pengguna berhasil dibuat', data: newUser });
    } catch (error) {
        handleError(res, error);
    }
};

// PUT /api/users/:email (Diubah secara signifikan)
exports.updateUser = async (req, res) => {
    try {
        const { email } = req.params;

        // DIUBAH: Ambil semua data baru dari body
        const {
            fullName,
            level,
            agency,
            industry,
            phone,
            notificationPref
        } = req.body;

        // Validasi field yang wajib diisi
        if (!fullName || !level) {
            return res.status(400).json({ message: 'Nama Lengkap dan Level wajib diisi' });
        }

        const userRef = db.collection('users').doc(email);

        // BARU: Siapkan objek data yang akan diupdate
        const updatedData = {
            fullName,
            level,
            agency: agency || '',
            industry: industry || '',
            phone: phone || '',
            notificationPref: notificationPref === true, // Pastikan boolean
        };

        await userRef.update(updatedData);

        // Opsional: Update nama di semua transaksi terkait
        const batch = db.batch();
        const transactionsSnapshot = await db.collection('transactions').where('customerEmail', '==', email).get();
        transactionsSnapshot.docs.forEach(doc => {
            // DIUBAH: update customerName menjadi fullName
            batch.update(doc.ref, { customerName: fullName });
        });
        await batch.commit();

        res.status(200).json({ message: 'Pengguna berhasil diperbarui' });
    } catch (error) {
        handleError(res, error);
    }
};

// DELETE /api/users/:email (Tidak ada perubahan)
exports.deleteUser = async (req, res) => {
    try {
        const { email } = req.params;
        const batch = db.batch();

        const userRef = db.collection('users').doc(email);
        batch.delete(userRef);

        const transactionsSnapshot = await db.collection('transactions').where('customerEmail', '==', email).get();
        transactionsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        res.status(200).json({ message: 'Pengguna dan semua transaksinya berhasil dihapus' });
    } catch (error) {
        handleError(res, error);
    }
};