const express = require('express');

const { protect, adminOnly } = require("../middleware/authMiddleware");
const { submitAnswers, getSubmission, getAllSubmissionsForExam, getAllSubmissions, getSubmissionDetails } = require('../controllers/submissioncontroller');
const router = express.Router();

router.route('/submission/:examId').post(protect , submitAnswers);
router.route('/submission/:examId').get(protect,getSubmission);
router.route('/submission/admin/all').get(protect , adminOnly , getAllSubmissions);
router.route('/submission/admin/:examId').get(protect , adminOnly , getAllSubmissionsForExam);
router.route('/submission/details/:submissionId').get(protect , adminOnly , getSubmissionDetails);
module.exports = router; 
