const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const scheduleRoutes = require('./routes/schedules');
const recurringRoutes = require('./routes/recurring');
const attendanceRoutes = require('./routes/attendance');
const paymentRoutes = require('./routes/payments');
const ledgerRoutes = require('./routes/ledger');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/students', ledgerRoutes);  // handles /:id/ledger — does not conflict with studentRoutes

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;
