const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');

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
router.get('/templates', adminAuth, templateController.getTemplates);
router.post('/templates', adminAuth, templateController.createTemplate);
router.put('/templates/:id', adminAuth, templateController.updateTemplate);
router.delete('/templates/:id', adminAuth, templateController.deleteTemplate);

module.exports = router;