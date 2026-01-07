const express = require('express');
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { getOverviewStats, getExamReport, getStudentReport, getAllSuspiciousActivities } = require('../controllers/reportController');

const router = express.Router();

router.route('/report/overview').get(protect, adminOnly, getOverviewStats);
router.route('/report/activities').get(protect, adminOnly, getAllSuspiciousActivities);
router.route('/report/exam/:examId').get(protect ,adminOnly,getExamReport);
router.route('/report/student/:studentId').get(protect,adminOnly,getStudentReport);

module.exports = router; 

