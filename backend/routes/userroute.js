const express = require('express');
const {registerUser, loginUser, getUserProfile} = require("../controllers/userLogin");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

router.route('/auth/register').post(registerUser);
router.route('/auth/login').post(loginUser);
router.route('/auth/me').get(protect , getUserProfile);
module.exports = router; 
