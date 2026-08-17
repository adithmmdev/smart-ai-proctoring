const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

const connectDatabase = require('./config/db');

const app = express();
dotenv.config({ path: path.join(__dirname, 'config', 'config.env') });
connectDatabase();

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
}

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Camera/proctoring snapshots can be large; keep this explicit and bounded.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const exams = require('./routes/examroute');
const users = require('./routes/userroute');
const submissions = require('./routes/submissionRoute');
const proctor = require('./routes/proctorLogRoute');
const report = require('./routes/reportroute');
const student = require('./routes/studentRoute');
const admin = require('./routes/adminRoute');

app.use('/api/v1/', exams);
app.use('/api/v1/', users);
app.use('/api/v1/', submissions);
app.use('/api/v1/', proctor);
app.use('/api/v1/', report);
app.use('/api/v1/', student);
app.use('/api/v1/', admin);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
