const express = require('express');
const db = require('../db');
const wrap = require('../utils/wrap');
const { listGoals } = require('../services/finance');

const router = express.Router();

router.get('/', wrap(async (req, res) => {
  res.json({ goals: await listGoals(req.user.id) });
}));

router.post('/', wrap(async (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 120);
  const target = Number(req.body.target_amount);
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.deadline || '')) ? req.body.deadline : null;

  if (title.length < 2) return res.status(400).json({ error: 'Nama target minimal 2 karakter' });
  if (!Number.isFinite(target) || target <= 0) return res.status(400).json({ error: 'Nominal target harus lebih dari 0' });

  const [result] = await db.query(
    'INSERT INTO goals (user_id, title, target_amount, deadline) VALUES (?, ?, ?, ?)',
    [req.user.id, title, target, deadline]
  );
  res.status(201).json({ id: result.insertId });
}));

// Tambah tabungan ke target
router.patch('/:id/add', wrap(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Nominal harus lebih dari 0' });

  const [result] = await db.query(
    'UPDATE goals SET saved_amount = saved_amount + ? WHERE id = ? AND user_id = ?',
    [amount, req.params.id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Target tidak ditemukan' });
  res.json({ ok: true });
}));

router.delete('/:id', wrap(async (req, res) => {
  const [result] = await db.query('DELETE FROM goals WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Target tidak ditemukan' });
  res.json({ ok: true });
}));

module.exports = router;
