const express = require('express');
const db = require('../db');
const wrap = require('../utils/wrap');
const { validMonth, monthRange } = require('../services/finance');

const router = express.Router();

router.get('/categories', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, type, icon FROM categories ORDER BY type, id');
  res.json({ categories: rows });
}));

// Daftar transaksi (opsional filter ?month=YYYY-MM&type=income|expense)
router.get('/', wrap(async (req, res) => {
  const params = [req.user.id];
  let sql = `SELECT t.id, t.type, t.amount, t.description, t.trx_date, t.category_id, c.name AS category, c.icon
               FROM transactions t JOIN categories c ON c.id = t.category_id
              WHERE t.user_id = ?`;

  const ym = validMonth(req.query.month);
  if (ym) {
    const [from, to] = monthRange(ym);
    sql += ' AND t.trx_date >= ? AND t.trx_date < ?';
    params.push(from, to);
  }
  if (req.query.type === 'income' || req.query.type === 'expense') {
    sql += ' AND t.type = ?';
    params.push(req.query.type);
  }
  sql += ' ORDER BY t.trx_date DESC, t.id DESC LIMIT 200';

  const [rows] = await db.query(sql, params);
  res.json({ transactions: rows.map((r) => ({ ...r, amount: Number(r.amount) })) });
}));

router.post('/', wrap(async (req, res) => {
  const { category_id, type, description, trx_date } = req.body;
  const amount = Number(req.body.amount);

  if (type !== 'income' && type !== 'expense') return res.status(400).json({ error: 'Tipe harus income atau expense' });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) return res.status(400).json({ error: 'Nominal harus lebih dari 0' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(trx_date || ''))) return res.status(400).json({ error: 'Tanggal tidak valid' });

  const [cat] = await db.query('SELECT id FROM categories WHERE id = ? AND type = ?', [category_id, type]);
  if (!cat.length) return res.status(400).json({ error: 'Kategori tidak cocok dengan tipe transaksi' });

  const [result] = await db.query(
    'INSERT INTO transactions (user_id, category_id, type, amount, description, trx_date) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, category_id, type, amount, String(description || '').trim().slice(0, 255), trx_date]
  );
  res.status(201).json({ id: result.insertId });
}));

router.delete('/:id', wrap(async (req, res) => {
  const [result] = await db.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
  res.json({ ok: true });
}));

module.exports = router;
