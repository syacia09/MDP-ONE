# MDP ONE

Portal kampus berbasis web untuk **mahasiswa**, **dosen**, dan **pemilik tenant kantin**: dashboard akademik, direktori dan chat antar-pengguna, pencarian tim lomba, serta reservasi makanan di kantin kampus.

> Data SPON/Simponi (jadwal, tugas, kehadiran, tagihan) dan data dashboard dosen masih **data contoh**. Akun, chat, profil, tim, tugas, dan kantin tersimpan di **MySQL**.

## Fitur per peran

| Peran | Yang bisa dilakukan |
|---|---|
| **Mahasiswa** | Dashboard (jadwal, tugas, kehadiran, tagihan, cuaca, kalender), Campus Connection (direktori, cari tim, chat, edit profil), kantin |
| **Dosen** | Dashboard mengajar (jadwal, presensi dan BAP, antrean validasi, ringkasan kelas, mahasiswa wali, cuaca), Campus Connection, kantin di Campus Services |
| **Tenant** | Pesanan masuk (diperbarui otomatis), ubah status pesanan, buka/tutup tenant, kelola menu |

## Teknologi

- **Frontend:** HTML, CSS, dan JavaScript murni (ES Modules). Tanpa framework dan tanpa proses build.
- **Backend:** Node.js + Express, autentikasi JWT di cookie `httpOnly`, password di-hash `bcrypt`.
- **Database:** MySQL 8 / MariaDB 10.5+.

## Struktur folder

```
mdp-one/
├── server.js            Server Express: API, autentikasi, file statis
├── setup.js             Membuat database, tabel, dan akun demo (npm run setup)
├── schema.sql           Skema database (dibaca setup.js)
├── seed-data.json       Data awal: dosen, mahasiswa, tim, tenant, menu
├── .env.example         Template konfigurasi (salin menjadi .env)
└── public/              Semua yang disajikan ke browser
    ├── index.html       Satu-satunya halaman (SPA sederhana)
    ├── css/
    │   ├── style.css        Dasar: token warna, layout, komponen umum
    │   ├── dashboard.css    Dashboard dan kalender
    │   ├── connection.css   Login, dropdown, avatar, tab Campus Connection
    │   ├── canteen.css      Kantin
    │   ├── chat-tenant.css  Chat, direktori, tim, dashboard tenant
    │   ├── theme.css        Tema "Maroon Academy" (warna dan tipografi)
    │   ├── cards.css        Kartu dan modal profil
    │   ├── dosen.css        Khusus halaman dosen
    │   └── filters.css      Bar filter pencarian (kantin dan direktori)
    ├── js/
    │   ├── app.js           Titik masuk: login, navigasi, pembagian per peran
    │   ├── api.js           Semua pemanggilan API (satu pintu ke server)
    │   ├── lib/             Helper bersama: dom.js (el, $, esc), format.js (tanggal, Rupiah)
    │   ├── components/      Komponen yang dipakai ulang: nav, schedule, weather
    │   ├── pages/           Halaman khusus peran: dosen-dashboard, dosen-services
    │   ├── dashboard.js     Dashboard mahasiswa
    │   ├── canteen.js       Kantin (dipakai mahasiswa dan dosen)
    │   ├── connection.js    Direktori, cari tim
    │   ├── chat.js          Chat dua panel
    │   ├── profile.js       Editor profil
    │   ├── tenant.js        Dashboard pemilik tenant
    │   ├── calendar.js      Kalender akademik
    │   ├── avatar.js        Foto profil dengan fallback inisial
    │   └── mock-data.js, mock-dosen.js   Data contoh (SPON/Simponi dan dosen)
    ├── img/             Gambar statis
    └── uploads/         Gambar yang diunggah lewat aplikasi (foto menu)
```

## Prasyarat

- [Node.js](https://nodejs.org) **18 atau lebih baru** (`node -v`)
- **MySQL 8** atau MariaDB 10.5+ yang sedang berjalan
- Git

## Instalasi

```bash
# 1. Ambil kode
git clone <url-repository>
cd mdp-one

# 2. Pasang dependensi
npm install

# 3. Buat file konfigurasi, lalu isi nilainya
cp .env.example .env          # Windows (cmd): copy .env.example .env
```

Isi `.env`:

| Variabel | Keterangan |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` | Koneksi MySQL (`DB_NAME` bawaan: `mdp_one`) |
| `JWT_SECRET` | String acak, minimal 32 karakter |
| `DEMO_PASSWORD` | Password untuk semua akun demo |
| `PORT` | Port server (bawaan 3000) |
| `MET_CONTACT_EMAIL` | Email kontak yang dikirim ke API cuaca |

```bash
# 4. Buat database, tabel, dan akun demo
npm run setup

# 5. Jalankan server
npm start
```

Buka **http://localhost:3000**.

> ⚠️ `npm run setup` **menghapus dan membuat ulang semua tabel**. Pakai hanya di lingkungan pengembangan.
> ⚠️ Jangan memakai `NODE_ENV=production` di `http://localhost`: cookie login tidak akan tersimpan.

## Akun demo

Password semua akun adalah nilai `DEMO_PASSWORD` di `.env`. Daftar lengkap juga dicetak di terminal setelah `npm run setup`.

| Peran | ID login |
|---|---|
| Dosen (9 akun) | `0011223344` (Dr. Fajar Nugraha) sampai `0011223352` |
| Mahasiswa (8 akun) | `2026310001` (Alya), `2024310012`, `2024310027`, `2023310008`, `2025310019`, `2024310033`, `2023310021`, `2025310004` |
| Tenant (10 akun) | `dapur.nusantara`, `mie.corner`, `ayam.crispy.88`, `bebek.co`, `kedai.pempek`, `fresh.drink`, `roti.toast`, `rice.bowl.lab`, `seblak.nyess`, `coffee.break` |

**Mencoba alur lengkap:** login sebagai mahasiswa (`2026310001`), pesan makanan dari "Kedai Pempek". Di jendela incognito, login sebagai `kedai.pempek` dan ubah status pesanannya. Status di sisi mahasiswa ikut berubah dalam beberapa detik. Untuk chat, login sebagai dua akun berbeda di dua browser.

## Panduan kontribusi

### Penamaan
- File JS dan CSS: `kebab-case` (`dosen-dashboard.js`).
- Class CSS: `kebab-case`. ID elemen: `camelCase`. Fungsi: `camelCase`. Konstanta: `UPPER_SNAKE_CASE`.
- Satu file satu tanggung jawab. Halaman khusus peran diberi awalan peran (`dosen-…`).

### Aturan kode
- **Satu sumber untuk helper.** Jangan menulis ulang `el()`, `rupiah`, atau format tanggal. Impor dari `js/lib/`.
- **Komponen yang dipakai di dua tempat** (misalnya widget cuaca) ditaruh di `js/components/`.
- **Semua pemanggilan server lewat `api.js`**, jangan memanggil `fetch` langsung dari halaman.
- **Jangan menyisipkan teks pengguna ke `innerHTML`** tanpa `esc()` (dari `lib/dom.js`). Pakai `textContent` bila bisa.
- **CSS:** pakai variabel warna (`var(--primary)`, `var(--surface)`, dan seterusnya). Jangan menulis warna mentah. Urutan `<link>` CSS di `index.html` menentukan siapa yang menang. Tambahkan gaya baru di file yang sesuai, jangan menimpa selector yang sama di file lain.

### Menambah halaman baru
1. Tambahkan satu entri di `NAV_ITEMS` pada `js/components/nav.js` (`page`, `icon`, `label`).
2. Tambahkan `<section class="page-section" id="page-<nama>" hidden></section>` di `index.html`. Untuk halaman khusus peran, pakai `page-<peran>-<nama>` dan petakan di `showPage` pada `app.js`.
3. Buat `js/pages/<nama>.js` yang mengekspor `init…(root, user, { toast })` dan mengisi `root`.
4. Panggil fungsi itu dari `enterApp` di `app.js` sesuai peran.
5. Butuh data baru? Tambahkan endpoint di `server.js` (dengan pembatasan peran) dan fungsi pemanggilnya di `api.js`.

### Sebelum push
- Cek syntax: `for f in $(git ls-files 'public/js/*.js'); do node --input-type=module --check < $f; done`
- Pastikan `.env` tidak ikut ter-commit.
- Uji tampilan di tiga peran (mahasiswa, dosen, tenant) dan di mode terang maupun gelap.

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| `Access denied for user` | `DB_PASS` di `.env` salah |
| `Unknown database` / `Table doesn't exist` | Jalankan `npm run setup` |
| `ECONNREFUSED` | MySQL belum menyala |
| `EADDRINUSE` | Port dipakai program lain. Ganti `PORT` di `.env` |
| "ID atau password salah" | `npm run setup` belum jalan, atau `DEMO_PASSWORD` berbeda dari saat setup |
| Login berhasil lalu kembali ke halaman login | Ada `NODE_ENV=production` di `.env` saat memakai `http` |
| Cuaca tidak muncul | Server tidak punya akses internet, atau `MET_CONTACT_EMAIL` belum diisi |
| Tombol "Masuk" tidak bereaksi | Buka Console (F12) dan lihat error merahnya |