// Semua perhitungan angka dilakukan di sini (lewat SQL), BUKAN oleh AI.
// AI hanya menerima hasil ringkasnya sebagai konteks.
const db = require('../db');

const pad = (n) => String(n).padStart(2, '0');

function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const currentMonth = () => todayStr().slice(0, 7);
const validMonth = (m) => (typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : null);

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
const monthRange = (ym) => [`${ym}-01`, `${shiftMonth(ym, 1)}-01`];

const rupiah = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');

// Total pemasukan, pengeluaran, dan saldo untuk satu bulan
async function monthSummary(uid, ym) {
  const [from, to] = monthRange(ym);
  const [rows] = await db.query(
    `SELECT type, SUM(amount) AS total, COUNT(*) AS n
       FROM transactions
      WHERE user_id = ? AND trx_date >= ? AND trx_date < ?
      GROUP BY type`,
    [uid, from, to]
  );
  const s = { income: 0, expense: 0, count: 0 };
  for (const r of rows) {
    s[r.type] = Number(r.total);
    s.count += Number(r.n);
  }
  s.balance = s.income - s.expense;
  return s;
}

// Total per kategori untuk satu bulan (urut dari terbesar)
async function categoryBreakdown(uid, ym, type = 'expense') {
  const [from, to] = monthRange(ym);
  const [rows] = await db.query(
    `SELECT c.name, c.icon, SUM(t.amount) AS total, COUNT(*) AS n
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.type = ? AND t.trx_date >= ? AND t.trx_date < ?
      GROUP BY c.id, c.name, c.icon
      ORDER BY total DESC`,
    [uid, type, from, to]
  );
  return rows.map((r) => ({ name: r.name, icon: r.icon, total: Number(r.total), count: Number(r.n) }));
}

// Tren pemasukan & pengeluaran beberapa bulan terakhir (berakhir di bulan terpilih)
async function trend(uid, endYm, months = 6) {
  const startYm = shiftMonth(endYm, -(months - 1));
  const [from] = monthRange(startYm);
  const [, to] = monthRange(endYm);
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(trx_date, '%Y-%m') AS ym, type, SUM(amount) AS total
       FROM transactions
      WHERE user_id = ? AND trx_date >= ? AND trx_date < ?
      GROUP BY ym, type`,
    [uid, from, to]
  );
  const map = {};
  for (let i = 0; i < months; i++) map[shiftMonth(startYm, i)] = { income: 0, expense: 0 };
  for (const r of rows) if (map[r.ym]) map[r.ym][r.type] = Number(r.total);
  return Object.entries(map).map(([ym, v]) => ({ month: ym, ...v }));
}

async function recentTransactions(uid, limit = 10) {
  const [rows] = await db.query(
    `SELECT t.id, t.type, t.amount, t.description, t.trx_date, c.name AS category, c.icon
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ?
      ORDER BY t.trx_date DESC, t.id DESC
      LIMIT ?`,
    [uid, limit]
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

async function listGoals(uid) {
  const [rows] = await db.query(
    'SELECT id, title, target_amount, saved_amount, deadline FROM goals WHERE user_id = ? ORDER BY id DESC',
    [uid]
  );
  return rows.map((g) => ({ ...g, target_amount: Number(g.target_amount), saved_amount: Number(g.saved_amount) }));
}

// Ringkasan keuangan dalam bentuk teks, dikirim ke AI sebagai konteks
async function buildAIContext(uid) {
  const now = currentMonth();
  const prev = shiftMonth(now, -1);
  const [cur, last, curCats, lastCats, goals, recent] = await Promise.all([
    monthSummary(uid, now),
    monthSummary(uid, prev),
    categoryBreakdown(uid, now),
    categoryBreakdown(uid, prev),
    listGoals(uid),
    recentTransactions(uid, 10),
  ]);

  const today = new Date();
  const dayOfMonth = today.getDate();
  const avgDaily = dayOfMonth > 0 ? cur.expense / dayOfMonth : 0;
  const lines = [];

  lines.push(`Tanggal hari ini: ${todayStr()}`);
  lines.push(`\n[Bulan ini ${now}]`);
  lines.push(`Pemasukan: ${rupiah(cur.income)} | Pengeluaran: ${rupiah(cur.expense)} | Selisih: ${rupiah(cur.balance)}`);
  lines.push(`Rata-rata pengeluaran per hari (sampai hari ini): ${rupiah(avgDaily)}`);
  lines.push('Pengeluaran per kategori: ' + (curCats.length ? curCats.map((c) => `${c.name} ${rupiah(c.total)}`).join('; ') : 'belum ada'));

  lines.push(`\n[Bulan lalu ${prev}]`);
  lines.push(`Pemasukan: ${rupiah(last.income)} | Pengeluaran: ${rupiah(last.expense)} | Selisih: ${rupiah(last.balance)}`);
  lines.push('Pengeluaran per kategori: ' + (lastCats.length ? lastCats.map((c) => `${c.name} ${rupiah(c.total)}`).join('; ') : 'belum ada'));

  lines.push('\n[Target tabungan]');
  if (goals.length) {
    for (const g of goals) {
      const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
      lines.push(`- ${g.title}: terkumpul ${rupiah(g.saved_amount)} dari ${rupiah(g.target_amount)} (${pct}%)` + (g.deadline ? `, tenggat ${g.deadline}` : ''));
    }
  } else lines.push('Belum ada target.');

  lines.push('\n[10 transaksi terakhir]');
  if (recent.length) {
    for (const t of recent) lines.push(`- ${t.trx_date} ${t.type === 'income' ? 'MASUK' : 'KELUAR'} ${rupiah(t.amount)} (${t.category}) ${t.description || ''}`.trim());
  } else lines.push('Belum ada transaksi.');

  return lines.join('\n');
}

module.exports = {
  todayStr, currentMonth, validMonth, shiftMonth, monthRange, rupiah,
  monthSummary, categoryBreakdown, trend, recentTransactions, listGoals, buildAIContext,
};
