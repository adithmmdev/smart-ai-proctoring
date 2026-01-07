const express = require('express');
const { createExam, getAllExams, getExamById, updateExam, deleteExam, getExamDetails } = require('../controllers/examController'); 
const { protect, adminOnly } = require("../middleware/authMiddleware");
const router = express.Router();

router.route('/exam').post(protect, adminOnly, createExam);
router.route('/exam/get').get(protect, getAllExams);
router.route('/exam/get/:id').get(protect, getExamById);
router.route('/exam/details/:id').get(protect, adminOnly, getExamDetails);
router.route('/exam/update/:id').put(protect, adminOnly, updateExam);
router.route('/exam/delete/:id').delete(protect, adminOnly, deleteExam);
module.exports = router;
