const express = require('express');
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin profile routes
router.get('/admin/profile', adminController.getAdminProfile);
router.put('/admin/profile', adminController.updateAdminProfile);
router.put('/admin/update-password', adminController.updateAdminPassword);
router.post('/admin/upload-avatar', adminController.uploadAvatar);
router.get('/admin/stats', adminController.getAdminStats);

module.exports = router;

