// Mengisi akun demo + data dummy supaya dashboard dan AI langsung terlihat bagus saat presentasi.
//   npm run seed
// Login: demo@finai.test / demo123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');

const EMAIL = 'demo@finai.test';

function dateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max, step = 1000) => Math.round((min + Math.random() * (max - min)) / step) * step;

(async () => {
  const [cats] = await db.query('SELECT id, name, type FROM categories');
  const cat = (name, type) => cats.find((c) => c.name === name && c.type === type).id;

  let [u] = await db.query('SELECT id FROM users WHERE email = ?', [EMAIL]);
  let uid;
  if (u.length) {
    uid = u[0].id;
    await db.query('DELETE FROM transactions WHERE user_id = ?', [uid]);
    await db.query('DELETE FROM goals WHERE user_id = ?', [uid]);
    await db.query('DELETE FROM chat_history WHERE user_id = ?', [uid]);
  } else {
    const hash = await bcrypt.hash('demo123', 10);
    const [r] = await db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', ['Mahasiswa Demo', EMAIL, hash]);
    uid = r.insertId;
  }

  const rows = [];
  const today = new Date();
  const add = (d, type, category, amount, description) =>
    rows.push([uid, cat(category, type), type, amount, description, dateStr(d)]);

  // 3 bulan terakhir: bulan berjalan sampai hari ini, dua bulan sebelumnya penuh
  for (let m = 2; m >= 0; m--) {
    const first = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const last = m === 0 ? today : new Date(today.getFullYear(), today.getMonth() - m + 1, 0);

    add(new Date(first.getFullYear(), first.getMonth(), 1), 'income', 'Uang Saku', 2000000, 'Uang saku bulanan');
    if (m !== 2) add(new Date(first.getFullYear(), first.getMonth(), 12), 'income', 'Freelance', rand(300000, 700000), 'Proyek desain freelance');
    if (last.getDate() >= 3) add(new Date(first.getFullYear(), first.getMonth(), 3), 'expense', 'Tagihan & Kos', 700000, 'Bayar kos');

    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      add(d, 'expense', 'Makan & Minum', rand(15000, 40000), pick(['Makan siang', 'Makan malam', 'Sarapan', 'Kopi']));
      if (Math.random() < 0.55) add(d, 'expense', 'Transportasi', rand(5000, 25000), pick(['Bensin', 'Ojek online', 'Parkir']));
      if (Math.random() < 0.18) add(d, 'expense', 'Hiburan', rand(20000, 90000), pick(['Nonton bioskop', 'Top up game', 'Langganan streaming']));
      if (Math.random() < 0.12) add(d, 'expense', 'Belanja', rand(40000, 180000), pick(['Belanja online', 'Perlengkapan kos', 'Pakaian']));
      if (Math.random() < 0.06) add(d, 'expense', 'Pendidikan', rand(20000, 120000), pick(['Print dan fotokopi', 'Buku', 'Kuota internet']));
    }
  }

  await db.query('INSERT INTO transactions (user_id, category_id, type, amount, description, trx_date) VALUES ?', [rows]);

  const next6 = new Date(today.getFullYear(), today.getMonth() + 6, 1);
  const next3 = new Date(today.getFullYear(), today.getMonth() + 3, 1);
  await db.query('INSERT INTO goals (user_id, title, target_amount, saved_amount, deadline) VALUES ?', [[
    [uid, 'Laptop baru', 8000000, 2500000, dateStr(next6)],
    [uid, 'Dana darurat', 3000000, 900000, dateStr(next3)],
  ]]);

  console.log(`✓ Data demo siap (${rows.length} transaksi). Login: ${EMAIL} / demo123`);
  process.exit(0);
})().catch((e) => {
  console.error('✗ Gagal:', e.message);
  process.exit(1);
});
