const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const wrap = require('../utils/wrap');

const router = express.Router();

const sign = (user) =>
  jwt.sign({ id: user.id, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Nama minimal 2 karakter' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Format email tidak valid' });
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

  const [exist] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exist.length) return res.status(409).json({ error: 'Email sudah terdaftar' });

  const hash = await bcrypt.hash(password, 10);
  const [result] = await db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash]);
  const user = { id: result.insertId, name };
  res.status(201).json({ token: sign(user), user: { id: user.id, name, email } });
}));

router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const [rows] = await db.query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }
  res.json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email } });
}));

router.get('/me', auth, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, email FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length) return res.status(401).json({ error: 'Akun tidak ditemukan' });
  res.json({ user: rows[0] });
}));

module.exports = router;
