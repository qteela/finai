// Membungkus handler async agar error otomatis diteruskan ke error handler Express
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
