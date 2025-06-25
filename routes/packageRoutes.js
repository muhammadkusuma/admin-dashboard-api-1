const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');

// Middleware to check admin role (example implementation)
const adminAuth = (req, res, next) => {
    // Assume Firebase UID or JWT is available in req.user from authentication middleware
    const user = req.user;
    // if (!user || user.role !== 'admin') {
    //     return res.status(403).json({ error: 'Admin access required' });
    // }
    next();
};

// Routes
router.get('/packages', adminAuth, packageController.getPackages);
router.post('/packages', adminAuth, packageController.createPackage);
router.put('/packages/:id', adminAuth, packageController.updatePackage);
router.delete('/packages/:id', adminAuth, packageController.deletePackage);

module.exports = router;