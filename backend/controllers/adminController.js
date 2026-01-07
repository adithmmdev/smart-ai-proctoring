const User = require('../models/user');
const Exam = require('../models/exam');
const Submission = require('../models/submission');
const ProctoringLog = require('../models/proctorlog');
const bcrypt = require('bcrypt');

// Get admin profile
exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    res.json(admin);
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update admin profile
exports.updateAdminProfile = async (req, res) => {
  try {
    const { name, email, department, phone } = req.body;
    
    const admin = await User.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== admin.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Update fields
    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (department !== undefined) admin.department = department;
    if (phone !== undefined) admin.phone = phone;

    await admin.save();

    const updatedAdmin = await User.findById(req.user.id).select('-password');
    res.json(updatedAdmin);
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update admin password
exports.updateAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const admin = await User.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Verify current password
    const isPasswordMatch = await admin.matchPassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Upload avatar (accepts base64 image data)
exports.uploadAvatar = async (req, res) => {
  try {
    console.log('Upload avatar request received');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Avatar data type:', typeof req.body.avatar);
    console.log('Avatar data length:', req.body.avatar ? req.body.avatar.length : 0);
    console.log('Avatar data preview:', req.body.avatar ? req.body.avatar.substring(0, 50) : 'null');

    const { avatar } = req.body; // Expecting base64 image data

    if (!avatar) {
      console.error('No avatar data in request body');
      return res.status(400).json({ message: 'No avatar data provided' });
    }

    if (typeof avatar !== 'string') {
      console.error('Avatar is not a string:', typeof avatar);
      return res.status(400).json({ message: 'Avatar must be a string' });
    }

    const admin = await User.findById(req.user.id);
    
    if (!admin) {
      console.error('Admin not found:', req.user.id);
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.role !== 'admin') {
      console.error('User is not admin:', admin.role);
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Validate base64 image format
    if (!avatar.startsWith('data:image/')) {
      console.error('Invalid base64 format. Expected data:image/, got:', avatar.substring(0, 20));
      return res.status(400).json({ 
        message: 'Invalid image format. Please provide a valid base64 image.',
        received: avatar.substring(0, 50)
      });
    }

    // Check if base64 string is too large (MongoDB has document size limits)
    // Base64 is ~33% larger than original, so 3MB file becomes ~4MB base64
    if (avatar.length > 5 * 1024 * 1024) { // 5MB limit for base64
      console.error('Avatar too large:', avatar.length);
      return res.status(400).json({ 
        message: 'Avatar image is too large. Please use an image smaller than 3MB.',
        size: `${(avatar.length / 1024 / 1024).toFixed(2)}MB`
      });
    }

    console.log('Updating admin avatar, length:', avatar.length);
    
    // Update avatar (store as base64 data URL)
    admin.avatar = avatar;
    await admin.save();

    console.log('Avatar saved successfully');

    res.json({ 
      message: 'Avatar uploaded successfully',
      avatar: avatar 
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get admin statistics
exports.getAdminStats = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Get total exams created by this admin
    const totalExams = await Exam.countDocuments({ createdBy: adminId });

    // Get active exams (exams that haven't ended yet)
    // Active exams are those where current time is between exam date and exam end time
    const now = new Date();
    const allExams = await Exam.find({ createdBy: adminId });
    const activeExams = allExams.filter(exam => {
      const examDate = new Date(exam.date);
      const examEndTime = new Date(examDate.getTime() + (exam.duration * 60 * 1000));
      return now >= examDate && now <= examEndTime;
    }).length;

    // Get total submissions for exams created by this admin
    const examsCreatedByAdmin = await Exam.find({ createdBy: adminId }).select('_id');
    const examIds = examsCreatedByAdmin.map(exam => exam._id);
    const totalSubmissions = await Submission.countDocuments({
      exam: { $in: examIds }
    });

    // Get total suspicious flags for exams created by this admin
    const totalSuspiciousFlags = await ProctoringLog.countDocuments({
      exam: { $in: examIds }
    });

    res.json({
      totalExams,
      activeExams,
      totalSubmissions,
      totalSuspiciousFlags
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

