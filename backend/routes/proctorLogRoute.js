const express = require('express');

const { protect, adminOnly } = require("../middleware/authMiddleware");
const { storeCameraData, getProctoringLogs, storeProctoringFlag } = require('../controllers/proctoringLogController');

const router = express.Router();
router.route('/proctor/store').post(protect , storeCameraData);
router.route('/proctor/flag').post(protect , storeProctoringFlag);
router.route('/proctor/:examId').get(protect,adminOnly,getProctoringLogs);
module.exports = router; 
