# FinAI: Asisten Keuangan Pribadi Berbasis AI

Website pencatat keuangan untuk mahasiswa yang terintegrasi dengan database MySQL dan asisten AI (OpenRouter).
Tugas mata kuliah Sistem Informasi Berbasis Kecerdasan Buatan.

**Teknologi:** Node.js + Express, MySQL, HTML/CSS/JavaScript, Chart.js, OpenRouter (model gratis)

---

## 1. Cara menjalankan (dari nol)

### a. Siapkan alat
- **Node.js** versi 18 atau lebih baru (cek: `node -v`)
- **MySQL** (paling mudah lewat **XAMPP**: nyalakan modul *MySQL* di XAMPP Control Panel)

### b. Import database
Pilih salah satu:
- **phpMyAdmin** (`http://localhost/phpmyadmin`): klik tab **Import**, pilih file `database/schema.sql`, klik **Go**.
- **Terminal:** `mysql -u root -p < database/schema.sql`

Hasilnya: database `finai` dengan 5 tabel dan 12 kategori awal.

### c. Install dan atur .env
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
```
Buka file `.env`, lalu isi:
- `DB_PASSWORD`: kosongkan kalau pakai XAMPP bawaan, isi kalau MySQL-mu ada passwordnya
- `JWT_SECRET`: ganti dengan teks acak yang panjang
- `OPENROUTER_API_KEY`: lihat bagian 2

### d. (Opsional tapi disarankan) isi data demo
```bash
npm run seed
```
Membuat akun **demo@finai.test / demo123** berisi transaksi 3 bulan dan 2 target tabungan, jadi dashboard dan AI langsung terlihat bagus saat presentasi.

### e. Jalankan
```bash
npm start
```
Buka **http://localhost:3000**. Di terminal harus muncul `✓ Terhubung ke MySQL`.

---

## 2. Cara mendapat API key OpenRouter

Key bawaan ("Default") di OpenRouter tidak bisa disalin ulang karena nilainya hanya ditampilkan sekali saat dibuat. Solusinya, buat key baru:

1. Login ke https://openrouter.ai
2. Buka https://openrouter.ai/settings/keys
3. Klik **Create API Key**, beri nama (misal `finai`)
4. **Langsung salin** key yang muncul (awalan `sk-or-v1-...`), karena tidak akan ditampilkan lagi
5. Tempel ke `.env`: `OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx`
6. Restart server (`Ctrl+C`, lalu `npm start`)

Kalau key hilang, tinggal buat yang baru. Jangan upload `.env` ke GitHub atau kirim key lewat chat/screenshot.

### Soal model gratis
`OPENROUTER_MODELS=openrouter/free` memakai router resmi OpenRouter yang otomatis memilih model gratis yang sedang tersedia. Daftar model gratis berubah-ubah, jadi kalau mau memilih sendiri, lihat https://openrouter.ai/models?pricing=free lalu salin nama modelnya (berakhiran `:free`). Beberapa model bisa dipisah koma dan akan dicoba berurutan:

```
OPENROUTER_MODELS=openrouter/free,nama-model-lain:free
```

Model gratis punya batas permintaan harian dan kadang antre. Saat presentasi, coba sekali dulu sebelum mulai.

---

## 2b. Menjalankan dengan Docker (tanpa install Node.js dan MySQL)

Cukup install **Docker Desktop**, lalu:

```bash
cp .env.example .env          # Windows: copy .env.example .env
# isi OPENROUTER_API_KEY dan JWT_SECRET di .env (DB_PASSWORD boleh dikosongkan, otomatis finai_root)
docker compose up -d --build
docker compose exec app npm run seed     # opsional: data demo
```

Buka **http://localhost:3000**. Perintah berguna:

| Perintah | Fungsi |
|---|---|
| `docker compose logs -f app` | Lihat log aplikasi (cek `✓ Terhubung ke MySQL`) |
| `docker compose restart app` | Restart setelah mengubah `.env` |
| `docker compose down` | Matikan (data database tetap aman di volume) |
| `docker compose down -v` | Matikan **dan hapus data** database (mulai dari nol) |

Catatan: `schema.sql` hanya dijalankan otomatis saat volume database pertama kali dibuat. Kalau kamu mengubah skema, jalankan `docker compose down -v` lalu `up` lagi. Database juga bisa dibuka dari DBeaver/Workbench di `localhost:3307` (user `root`).

---

## 2c. Kerja berdua lewat GitHub

- **Jangan pernah commit `.env`** (sudah ada di `.gitignore`). Setiap orang punya `.env` sendiri; Abi memakai API key OpenRouter miliknya.
- Pembagian aman supaya tidak bentrok: website (`public/`, `routes/`) dikerjakan satu orang, sedangkan pengaturan AI (`services/openrouter.js`, `SYSTEM_RULES` dan prompt di `routes/ai.js`, `OPENROUTER_MODELS`) dikerjakan orang lainnya.
- Alur harian: `git pull` sebelum mulai, kerja di branch sendiri (`git checkout -b fitur-ai`), `git push -u origin fitur-ai`, lalu buka Pull Request di GitHub.

---

## 3. Struktur proyek

```
finai/
├── server.js              # titik masuk Express
├── db.js                  # koneksi MySQL
├── database/schema.sql    # skema tabel + kategori awal
├── routes/                # auth, transactions, dashboard, goals, ai
├── services/
│   ├── finance.js         # semua perhitungan angka (SQL) + penyusun konteks AI
│   └── openrouter.js      # pemanggil API OpenRouter + fallback model
├── middleware/auth.js     # verifikasi JWT
├── scripts/seed-demo.js   # data demo
└── public/                # frontend (login.html, index.html, css, js)
```

### Tabel database (ERD singkat)
```
users 1───* transactions *───1 categories
users 1───* goals
users 1───* chat_history
```

---

## 4. Penjelasan AI (bahan presentasi)

**Prinsip utama: AI tidak menghitung, AI hanya menjelaskan.**

1. Pengguna bertanya di panel chat.
2. Backend menghitung ringkasan keuangan lewat **SQL** (total bulan ini dan bulan lalu, pengeluaran per kategori, target tabungan, 10 transaksi terakhir).
3. Ringkasan itu disisipkan ke **system prompt** bersama aturan perilaku, lalu dikirim ke OpenRouter bersama 8 pesan terakhir sebagai memori percakapan.
4. Jawaban AI disimpan di tabel `chat_history` dan ditampilkan.

Dengan begitu angka selalu benar (berasal dari database) dan risiko halusinasi berkurang.

**Tiga fitur AI:**
| Fitur | Endpoint | Cara kerja |
|---|---|---|
| Chat asisten | `POST /api/ai/chat` | Pertanyaan + konteks data dari database |
| Saran hemat | `POST /api/ai/insight` | Prompt tetap yang membandingkan bulan ini vs bulan lalu |
| Catat cepat | `POST /api/ai/parse` | Kalimat biasa diubah AI menjadi JSON transaksi (*information extraction*), divalidasi server, lalu ditampilkan sebagai draf yang dikonfirmasi pengguna sebelum disimpan |

**Keamanan dan ketahanan yang diterapkan:**
- Password di-hash (bcrypt), sesi memakai JWT, semua query memakai parameter (anti SQL injection)
- API key hanya ada di server (`.env`), tidak pernah dikirim ke browser
- Keluaran AI di browser di-escape (anti XSS), isi data di prompt ditandai sebagai data bukan perintah
- Fallback antar model dan pesan error ramah saat batas gratis tercapai
- Hasil parsing AI divalidasi (tipe, nominal, kategori) sebelum dipakai

---

## 5. Alur demo yang disarankan (±5 menit)

1. Login dengan akun demo, tunjukkan dashboard dan grafik 6 bulan.
2. **Catat cepat:** ketik `tadi beli bensin 20 ribu`, klik *Isi otomatis*, lalu simpan. Angka dan grafik langsung berubah.
3. Tanya AI: **"Bulan ini paling boros di mana?"** lalu **"Bandingkan dengan bulan lalu"**.
4. Klik **💡 Saran hemat**.
5. Tambah tabungan ke target "Laptop baru" dan tunjukkan progresnya.
6. Buka phpMyAdmin dan tunjukkan datanya benar-benar tersimpan di MySQL.

---

## 6. Masalah umum

| Gejala | Penyebab / solusi |
|---|---|
| `✗ Gagal terhubung ke MySQL` | MySQL belum menyala, atau `DB_*` di `.env` salah, atau `schema.sql` belum diimport |
| AI membalas "API key tidak valid" | Key salah salin, atau lupa restart server setelah mengedit `.env` |
| AI membalas "Batas pemakaian ... penuh" | Kuota model gratis habis atau penuh, tunggu sebentar atau ganti `OPENROUTER_MODELS` |
| Jawaban AI lambat | Normal untuk model gratis (antre), tunggu sampai 45 detik |
| `Cannot find module` | Belum menjalankan `npm install` |
| Port 3000 terpakai | Ubah `PORT` di `.env` |
