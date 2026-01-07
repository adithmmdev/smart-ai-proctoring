const express = require ('express');
const app = express();
const dotenv = require('dotenv');
const path = require('path');
const connectDatabase = require('./config/db');
dotenv.config({path: path.join(__dirname, 'config', 'config.env')})
connectDatabase();
const cors = require("cors");
// Allow common local dev ports (5173 = default Vite, 5174+ fallback)
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin/non-browser requests (like curl/Postman with no origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

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