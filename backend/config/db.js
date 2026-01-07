const mongoose = require('mongoose');

const connectDatabase = () => {
  mongoose.connect(process.env.MONGO_URI)
    .then((con) => {
      console.log('MongoDB connected to host: ' + con.connection.host);
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err.message);
      console.error('Please make sure MongoDB is running on:', process.env.MONGO_URI);
      process.exit(1);
    });
};

module.exports = connectDatabase;
