-- FinAI - Asisten Keuangan Pribadi
-- Cara pakai: import file ini lewat phpMyAdmin (tab Import) atau jalankan:
--   mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS finai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE finai;

-- 1. Pengguna
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Kategori (dipakai bersama oleh semua pengguna)
CREATE TABLE IF NOT EXISTS categories (
  id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(60)  NOT NULL,
  type  ENUM('income','expense') NOT NULL,
  icon  VARCHAR(10)  NOT NULL DEFAULT '💰',
  UNIQUE KEY uq_category (name, type)
) ENGINE=InnoDB;

-- 3. Transaksi pemasukan / pengeluaran
CREATE TABLE IF NOT EXISTS transactions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NOT NULL,
  category_id INT UNSIGNED  NOT NULL,
  type        ENUM('income','expense') NOT NULL,
  amount      DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  description VARCHAR(255)  NOT NULL DEFAULT '',
  trx_date    DATE          NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trx_user     FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_trx_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_trx_user_date (user_id, trx_date)
) ENGINE=InnoDB;

-- 4. Target tabungan
CREATE TABLE IF NOT EXISTS goals (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NOT NULL,
  title         VARCHAR(120)  NOT NULL,
  target_amount DECIMAL(15,2) NOT NULL CHECK (target_amount > 0),
  saved_amount  DECIMAL(15,2) NOT NULL DEFAULT 0,
  deadline      DATE NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_goal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Riwayat percakapan dengan asisten AI
CREATE TABLE IF NOT EXISTS chat_history (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  role       ENUM('user','assistant') NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_chat_user (user_id, id)
) ENGINE=InnoDB;

-- Data awal kategori
INSERT IGNORE INTO categories (name, type, icon) VALUES
  ('Makan & Minum',  'expense', '🍜'),
  ('Transportasi',   'expense', '🛵'),
  ('Belanja',        'expense', '🛍️'),
  ('Tagihan & Kos',  'expense', '🏠'),
  ('Hiburan',        'expense', '🎮'),
  ('Pendidikan',     'expense', '📚'),
  ('Kesehatan',      'expense', '💊'),
  ('Lainnya',        'expense', '📦'),
  ('Uang Saku',      'income',  '👪'),
  ('Freelance',      'income',  '💻'),
  ('Beasiswa',       'income',  '🎓'),
  ('Lainnya',        'income',  '💵');
