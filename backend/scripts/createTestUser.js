const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/user');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const createTestUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_URL);
    console.log('MongoDB connected');

    // Check if users already exist
    const existingAdmin = await User.findOne({ email: 'admin@test.com' });
    const existingStudent = await User.findOne({ email: 'student@test.com' });

    if (!existingAdmin) {
      const admin = await User.create({
        name: 'Test Admin',
        email: 'admin@test.com',
        password: 'admin123',
        role: 'admin'
      });
      console.log('✅ Admin user created:', admin.email);
    } else {
      console.log('ℹ️  Admin user already exists:', existingAdmin.email);
    }

    if (!existingStudent) {
      const student = await User.create({
        name: 'Test Student',
        email: 'student@test.com',
        password: 'student123',
        role: 'student'
      });
      console.log('✅ Student user created:', student.email);
    } else {
      console.log('ℹ️  Student user already exists:', existingStudent.email);
    }

    console.log('\n📝 Test Credentials:');
    console.log('Admin - Email: admin@test.com, Password: admin123');
    console.log('Student - Email: student@test.com, Password: student123');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
};

createTestUsers();

