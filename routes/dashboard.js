const express = require('express');
const wrap = require('../utils/wrap');
const f = require('../services/finance');

const router = express.Router();

// Data untuk kartu ringkasan + grafik (?month=YYYY-MM)
router.get('/', wrap(async (req, res) => {
  const ym = f.validMonth(req.query.month) || f.currentMonth();
  const uid = req.user.id;

  const [summary, previous, expenseByCategory, trend] = await Promise.all([
    f.monthSummary(uid, ym),
    f.monthSummary(uid, f.shiftMonth(ym, -1)),
    f.categoryBreakdown(uid, ym, 'expense'),
    f.trend(uid, ym, 6),
  ]);

  res.json({ month: ym, summary, previous, expenseByCategory, trend });
}));

module.exports = router;
