const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Silakan login terlebih dahulu' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, name: payload.name };
    next();
  } catch {
    res.status(401).json({ error: 'Sesi berakhir, silakan login lagi' });
  }
};
