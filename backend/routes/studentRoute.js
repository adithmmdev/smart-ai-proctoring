const express = require('express');
const { protect } = require("../middleware/authMiddleware");
const { getStudentDashboardStats, getStudentSubmissions } = require('../controllers/studentController');
const router = express.Router();

router.route('/student/dashboard').get(protect, getStudentDashboardStats);
router.route('/student/submissions').get(protect, getStudentSubmissions);

module.exports = router;

