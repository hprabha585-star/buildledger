const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'construction_app_secret_2024';
const sign = (u) => jwt.sign({ id: u._id, email: u.email }, JWT_SECRET, { expiresIn: '90d' });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, companyName: u.companyName });

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, companyName } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ error: 'An account with this email already exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, companyName: companyName || '' });
    res.json({ token: sign(user), user: pub(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid email or password' });
    res.json({ token: sign(user), user: pub(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
