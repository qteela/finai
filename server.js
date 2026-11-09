require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const auth = require('./middleware/auth');

if (!process.env.JWT_SECRET) {
  console.warn('⚠  JWT_SECRET belum diisi di .env, memakai nilai sementara (jangan dipakai di produksi).');
  process.env.JWT_SECRET = 'dev-only-secret-ganti-di-env';
}

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', auth, require('./routes/transactions'));
app.use('/api/dashboard', auth, require('./routes/dashboard'));
app.use('/api/goals', auth, require('./routes/goals'));
app.use('/api/ai', auth, require('./routes/ai'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`FinAI berjalan di http://localhost:${port}`);
  db.query('SELECT 1')
    .then(() => console.log('✓ Terhubung ke MySQL'))
    .catch((e) => console.error('✗ Gagal terhubung ke MySQL:', e.message, '\n  Periksa DB_* di file .env dan pastikan database sudah diimport.'));
  if (!process.env.OPENROUTER_API_KEY) console.warn('⚠  OPENROUTER_API_KEY belum diisi, fitur AI belum aktif.');
});
