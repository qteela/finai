require('dotenv').config();
const mysql = require('mysql2/promise');

// Pool koneksi MySQL yang dipakai seluruh aplikasi
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'finai',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // kolom DATE dikembalikan sebagai teks 'YYYY-MM-DD'
  charset: 'utf8mb4',
});

module.exports = pool;
