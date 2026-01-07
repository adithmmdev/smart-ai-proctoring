const express = require ('express');
const app = express();
const dotenv = require('dotenv');
const path = require('path');
const connectDatabase = require('./config/db');
dotenv.config({path: path.join(__dirname, 'config', 'config.env')})
connectDatabase();
const cors = require("cors");

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://musical-blancmange-a5e37c.netlify.app"
  ],
  credentials: true
}));

app.options("*", cors()); // IMPORTANT

// Increase body size limit to handle large base64 images (50MB limit)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const exams = require('./routes/examroute');
const users = require('./routes/userroute');
const submissions = require('./routes/submissionRoute');
const proctor = require('./routes/proctorLogRoute');
const report = require('./routes/reportroute');
const student = require('./routes/studentRoute');
const admin = require('./routes/adminRoute');

app.use('/api/v1/',exams);
app.use('/api/v1/',users);
app.use('/api/v1/',submissions);
app.use('/api/v1/',proctor);
app.use('/api/v1/',report);
app.use('/api/v1/',student);
app.use('/api/v1/',admin);
const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>{
  console.log(`Listening to PORT ${PORT}`)
})