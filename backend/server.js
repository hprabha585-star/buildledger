const express = require('express');
const cors = require('cors');
const path = require('path');
const { connect } = require('./db/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/owners', require('./routes/owners'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/finance', require('./routes/finance'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

const PORT = process.env.PORT || 5000;
connect().then(() => {
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
});
