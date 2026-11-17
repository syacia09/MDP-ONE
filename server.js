// npm install   |   .env: lihat .env.example   |   Jalankan: npm start
import 'dotenv/config';
import dns from 'node:dns';
import express from 'express';
import compression from 'compression';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

dns.setDefaultResultOrder('ipv4first'); // hindari masalah IPv6 di sebagian jaringan

const { DB_HOST = 'localhost', DB_USER = 'root', DB_PASS = '', DB_NAME = 'mdp_one', JWT_SECRET, PORT = 3000, TRUST_PROXY = '0' } = process.env;
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET (>= 32 karakter) di .env');
const PROD = process.env.NODE_ENV === 'production';

const db = mysql.createPool({ host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME, connectionLimit: 10, dateStrings: true });
const q = async (sql, p = []) => (await db.query(sql, p))[0];

/* ---------------- APP ---------------- */
const app = express();
/* ---------------- Upload foto menu ---------------- */
const FOOD_UPLOAD_DIR = path.resolve('public/uploads/food');

fs.mkdirSync(FOOD_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FOOD_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    }[file.mimetype];

    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const foodUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Foto harus berformat JPG, PNG, atau WEBP.'));
    }

    cb(null, true);
  }
});

function removeFoodImage(url) {
  if (!url || !url.startsWith('/uploads/food/')) return;

  const filename = path.basename(url);
  const filepath = path.join(FOOD_UPLOAD_DIR, filename);

  fs.unlink(filepath, () => {});
}
if (TRUST_PROXY !== '0') app.set('trust proxy', Number(TRUST_PROXY) || 1);
app.use(helmet({
  hsts: PROD, crossOriginOpenerPolicy: false,
  contentSecurityPolicy: { directives: {
    upgradeInsecureRequests: PROD ? [] : null,
    defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], scriptSrc: ["'self'"] } }
}));
app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(express.static('public', { maxAge: PROD ? '1h' : 0 }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ message: msg });

/* Lapisan CSRF kedua: metode yang mengubah data harus berasal dari origin yang sama dan berformat JSON. */
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && new URL(origin).host !== req.get('host')) return bad(res, 'Origin tidak diizinkan.', 403);
  if (req.body && Object.keys(req.body).length && !req.is('application/json')) return bad(res, 'Content-Type harus JSON.', 415);
  next();
});

/* Pembatas laju sederhana di memori (dibersihkan berkala). */
function limiter(max, windowMs, keyFn = (req) => req.ip) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > windowMs) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const k = keyFn(req), now = Date.now();
    const h = hits.get(k);
    if (!h || now - h.t > windowMs) { hits.set(k, { n: 1, t: now }); return next(); }
    if (++h.n > max) return bad(res, 'Terlalu banyak permintaan. Coba lagi sebentar.', 429);
    next();
  };
}

app.get('/api/health', wrap(async (req, res) => {
  await q('SELECT 1');
  res.json({ db: 'ok' });
}));

/* ---------------- Auth: JWT di cookie httpOnly ---------------- */
const USER_COLS = 'id,role,login_id,name,prodi,semester,headline,photo_url';
function auth(...roles) {
  return wrap(async (req, res, next) => {
    let u;
    try {
      const { uid } = jwt.verify(req.cookies.session, JWT_SECRET);
      [u] = await q(`SELECT ${USER_COLS} FROM users WHERE id=?`, [uid]);
    } catch { u = null; }
    if (!u) return bad(res, 'Silakan masuk terlebih dahulu.', 401);
    if (roles.length && !roles.includes(u.role)) return bad(res, 'Akses ditolak.', 403);
    req.user = u;
    q('UPDATE users SET last_seen=NOW() WHERE id=?', [u.id]).catch(() => {});
    next();
  });
}
const guard = auth;

async function profileOf(u) {
  const [t] = await q('SELECT is_open FROM tenants WHERE owner_id=?', [u.id]);
  return { ...u, tenantOpen: t ? !!t.is_open : null };
}

const DUMMY_HASH = bcrypt.hashSync('dummy-password-untuk-waktu-seragam', 10);
const loginIp = limiter(30, 15 * 60e3);
const loginPair = limiter(5, 15 * 60e3, (req) => `${req.ip}|${String(req.body?.loginId || '').trim()}`);

app.post('/api/auth/login', loginIp, loginPair, wrap(async (req, res) => {
  const loginId = String(req.body.loginId || '').trim().slice(0, 60);
  const password = String(req.body.password || '').slice(0, 200);
  const [u] = await q('SELECT id,password_hash FROM users WHERE login_id=?', [loginId]);
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) return bad(res, 'ID atau password salah.', 401);
  const [user] = await q(`SELECT ${USER_COLS} FROM users WHERE id=?`, [u.id]);
  res.cookie('session', jwt.sign({ uid: u.id }, JWT_SECRET, { expiresIn: '8h' }),
    { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 8 * 3600e3 });
  res.json(await profileOf(user));
}));
app.post('/api/auth/logout', (req, res) => { res.clearCookie('session'); res.json({ ok: true }); });
app.get('/api/auth/me', guard(), wrap(async (req, res) => res.json(await profileOf(req.user))));

/* ---------------- Direktori ---------------- */
const pj = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return []; } };
const likeEscape = (s) => s.replace(/[\\%_]/g, '\\$&');

app.get('/api/people', guard(), wrap(async (req, res) => {
  const role = req.query.role === 'dosen' ? 'dosen' : 'mahasiswa';
  const like = `%${likeEscape(String(req.query.q || '').trim().slice(0, 60))}%`;
  const rows = await q(`SELECT id,role,name,prodi,semester,angkatan,title,email,headline,about,collaboration,photo_url,skills,interests,expertise,courses,publications,competitions,projects,certifications,
      (last_seen > NOW() - INTERVAL 60 SECOND) AS online
    FROM users WHERE role=? AND (is_public OR id=?) AND (name LIKE ? OR headline LIKE ? OR prodi LIKE ? OR CAST(skills AS CHAR) LIKE ? OR CAST(expertise AS CHAR) LIKE ?)
    ORDER BY name LIMIT 100`, [role, req.user.id, like, like, like, like, like]);
  const JSON_COLS = ['skills', 'interests', 'expertise', 'courses', 'publications', 'competitions', 'projects', 'certifications'];
  res.json(rows.map((r) => {
    const o = { ...r, online: !!r.online };
    JSON_COLS.forEach((c) => { if (c in o && o[c] != null) o[c] = pj(o[c]); });
    if (r.role !== 'dosen') o.email = null;
    return o;
  }));
}));

/* ---------------- Chat ---------------- */
const sendLimit = limiter(30, 60e3, (req) => `chat|${req.user?.id}`);
app.get('/api/chat/conversations', guard(), wrap(async (req, res) => {
  const me = req.user.id;
  res.json((await q(`SELECT u.id,u.name,u.role,u.photo_url, m.body AS last, m.created_at AS lastAt, m.sender_id AS lastFrom,
      (SELECT COUNT(*) FROM messages x WHERE x.sender_id=u.id AND x.receiver_id=? AND x.read_at IS NULL) AS unread,
      (u.last_seen > NOW() - INTERVAL 60 SECOND) AS online
    FROM users u JOIN messages m ON m.id=(SELECT MAX(id) FROM messages
      WHERE (sender_id=? AND receiver_id=u.id) OR (sender_id=u.id AND receiver_id=?))
    WHERE u.id<>? ORDER BY m.id DESC LIMIT 100`, [me, me, me, me])).map((c) => ({ ...c, online: !!c.online })));
}));
app.get('/api/chat/:peer', guard(), wrap(async (req, res) => {
  const me = req.user.id, peer = Number(req.params.peer), after = Number(req.query.after) || 0;
  if (!Number.isInteger(peer)) return bad(res, 'Lawan bicara tidak valid.');
  const rows = await q(`SELECT id,sender_id AS \`from\`,body,created_at AS at FROM messages
    WHERE id>? AND ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) ORDER BY id LIMIT 200`, [after, me, peer, peer, me]);
  if (rows.length) await q('UPDATE messages SET read_at=NOW() WHERE sender_id=? AND receiver_id=? AND read_at IS NULL', [peer, me]);
  res.json(rows);
}));
app.post('/api/chat/:peer', guard(), sendLimit, wrap(async (req, res) => {
  const peer = Number(req.params.peer), body = String(req.body.body || '').trim().slice(0, 1000);
  if (!body) return bad(res, 'Pesan kosong.');
  if (!Number.isInteger(peer) || peer === req.user.id) return bad(res, 'Penerima tidak valid.');
  if (!(await q('SELECT 1 FROM users WHERE id=? AND role<>"tenant"', [peer])).length) return bad(res, 'Penerima tidak ditemukan.', 404);
  const r = await q('INSERT INTO messages (sender_id,receiver_id,body) VALUES (?,?,?)', [req.user.id, peer, body]);
  res.status(201).json({ id: r.insertId });
}));

/* ---------------- Tugas pribadi ---------------- */
app.get('/api/tasks', guard('mahasiswa'), wrap(async (req, res) =>
  res.json((await q('SELECT id,title,course,due_date AS dueDate,is_done AS isDone FROM tasks WHERE user_id=? ORDER BY is_done, due_date IS NULL, due_date', [req.user.id])).map((t) => ({ ...t, isDone: !!t.isDone })))));
app.post('/api/tasks', guard('mahasiswa'), wrap(async (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 100);
  if (!title) return bad(res, 'Nama tugas wajib diisi.');
  const due = /^\d{4}-\d{2}-\d{2}$/.test(req.body.dueDate) ? req.body.dueDate : null;
  const r = await q('INSERT INTO tasks (user_id,title,course,due_date) VALUES (?,?,?,?)', [req.user.id, title, String(req.body.course || 'Umum').slice(0, 60), due]);
  res.status(201).json({ id: r.insertId });
}));
app.patch('/api/tasks/:id/toggle', guard('mahasiswa'), wrap(async (req, res) => {
  await q('UPDATE tasks SET is_done = NOT is_done WHERE id=? AND user_id=?', [req.params.id, req.user.id]); res.json({ ok: true }); }));
app.delete('/api/tasks/:id', guard('mahasiswa'), wrap(async (req, res) => {
  await q('DELETE FROM tasks WHERE id=? AND user_id=?', [req.params.id, req.user.id]); res.json({ ok: true }); }));

/* ---------------- Kantin ---------------- */
const PICKUPS = ['Secepatnya', '10 menit lagi', '15 menit lagi', '20 menit lagi', '30 menit lagi'];

app.get('/api/canteen', guard(), wrap(async (req, res) => {
  const tenants = await q('SELECT id,name,category,location,description,image_url AS image,is_open AS open FROM tenants');
  const menus = await q('SELECT id,tenant_id AS tenantId,name,description AS `desc`,price,image_url AS image,available FROM menus');
  res.json(tenants.map((t) => ({ ...t, open: !!t.open, menus: menus.filter((m) => m.tenantId === t.id).map((m) => ({ ...m, available: !!m.available })) })));
}));

// Harga SELALU dihitung server dari tabel menus, bukan dari kiriman klien.
app.post('/api/orders', guard('mahasiswa', 'dosen'), wrap(async (req, res) => {
  const { items = [], pickupTime = '', note = '' } = req.body;
  if (!Array.isArray(items) || !items.length || items.length > 20) return bad(res, 'Data reservasi tidak lengkap.');
  if (!PICKUPS.includes(pickupTime)) return bad(res, 'Jadwal pengambilan tidak valid.');

  const qty = new Map();
  for (const i of items) {
    const id = Number(i.menuId), n = parseInt(i.quantity, 10);
    if (!Number.isInteger(id) || !(n >= 1)) return bad(res, 'Item reservasi tidak valid.');
    qty.set(id, Math.min((qty.get(id) || 0) + n, 20));
  }
  const ids = [...qty.keys()];
  const menus = await q('SELECT m.*,t.is_open FROM menus m JOIN tenants t ON t.id=m.tenant_id WHERE m.id IN (?)', [ids]);
  if (menus.length !== ids.length) return bad(res, 'Ada menu yang tidak valid.');
  if (new Set(menus.map((m) => m.tenant_id)).size !== 1) return bad(res, 'Satu reservasi hanya untuk satu tenant.');
  if (!menus[0].is_open || menus.some((m) => !m.available)) return bad(res, 'Tenant tutup atau menu habis.', 409);
  const lines = menus.map((m) => ({ m, qty: qty.get(m.id) }));
  const total = lines.reduce((s, l) => s + l.m.price * l.qty, 0);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let code;
    for (let i = 0; i < 5; i += 1) {
      code = 'MDP-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const [dupe] = await conn.query('SELECT 1 FROM orders WHERE code=?', [code]);
      if (!dupe.length) break;
    }
    const [o] = await conn.query('INSERT INTO orders (code,user_id,tenant_id,pickup_time,note,total) VALUES (?,?,?,?,?,?)',
      [code, req.user.id, menus[0].tenant_id, pickupTime, String(note).slice(0, 100), total]);
    await conn.query('INSERT INTO order_items (order_id,menu_id,name,price,qty) VALUES ?', [lines.map((l) => [o.insertId, l.m.id, l.m.name, l.m.price, l.qty])]);
    await conn.commit();
    res.status(201).json({ id: o.insertId, code, total });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

async function withItems(orders) {
  if (!orders.length) return orders;
  const items = await q('SELECT order_id,name,qty,price FROM order_items WHERE order_id IN (?)', [orders.map((o) => o.id)]);
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
}
app.get('/api/orders', guard('mahasiswa', 'dosen'), wrap(async (req, res) => res.json(await withItems(await q(
  `SELECT o.id,o.code,o.pickup_time AS pickupTime,o.note,o.total,o.status,o.created_at AS createdAt,t.name AS tenantName
   FROM orders o JOIN tenants t ON t.id=o.tenant_id WHERE o.user_id=? ORDER BY o.id DESC LIMIT 50`, [req.user.id])))));
app.get('/api/tenant/orders', guard('tenant'), wrap(async (req, res) => res.json(await withItems(await q(
  `SELECT o.id,o.code,o.pickup_time AS pickupTime,o.note,o.total,o.status,o.created_at AS createdAt,u.name AS customer
   FROM orders o JOIN tenants t ON t.id=o.tenant_id JOIN users u ON u.id=o.user_id
   WHERE t.owner_id=? AND o.status IN ('reserved','preparing','ready') ORDER BY o.id`, [req.user.id])))));

app.get('/api/tenant/summary', guard('tenant'), wrap(async (req, res) => {
  const [s] = await q(`SELECT
      SUM(o.status IN ('reserved','preparing','ready')) AS active,
      SUM(o.status='done' AND o.created_at >= CURDATE()) AS doneToday,
      COALESCE(SUM(CASE WHEN o.status='done' AND o.created_at >= CURDATE() THEN o.total END),0) AS revenueToday
    FROM orders o JOIN tenants t ON t.id=o.tenant_id WHERE t.owner_id=?`, [req.user.id]);
  res.json({ active: Number(s.active) || 0, doneToday: Number(s.doneToday) || 0, revenueToday: Number(s.revenueToday) || 0 });
}));

/* ---------------- Laporan penjualan tenant ---------------- */

app.get('/api/tenant/reports', guard('tenant'), wrap(async (req, res) => {
  const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

  const today = new Date().toISOString().slice(0, 10);
  const from = validDate(req.query.from) ? req.query.from : today.slice(0, 8) + '01';
  const to = validDate(req.query.to) ? req.query.to : today;

  if (from > to) return bad(res, 'Tanggal awal tidak boleh melewati tanggal akhir.');

  const [summary] = await q(`
    SELECT
      COUNT(*) AS orders,
      COALESCE(SUM(total), 0) AS revenue
    FROM orders o
    JOIN tenants t ON t.id = o.tenant_id
    WHERE t.owner_id = ?
      AND o.status = 'done'
      AND o.created_at >= ?
      AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
  `, [req.user.id, from, to]);

  const [items] = await q(`
    SELECT COALESCE(SUM(oi.qty), 0) AS sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN tenants t ON t.id = o.tenant_id
    WHERE t.owner_id = ?
      AND o.status = 'done'
      AND o.created_at >= ?
      AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
  `, [req.user.id, from, to]);

  const topMenus = await q(`
    SELECT
      oi.name,
      SUM(oi.qty) AS quantity,
      SUM(oi.qty * oi.price) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN tenants t ON t.id = o.tenant_id
    WHERE t.owner_id = ?
      AND o.status = 'done'
      AND o.created_at >= ?
      AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
    GROUP BY oi.menu_id, oi.name
    ORDER BY quantity DESC
    LIMIT 5
  `, [req.user.id, from, to]);

  const transactions = await q(`
    SELECT
      o.id,
      o.code,
      o.total,
      o.created_at AS createdAt,
      u.name AS customer
    FROM orders o
    JOIN tenants t ON t.id = o.tenant_id
    JOIN users u ON u.id = o.user_id
    WHERE t.owner_id = ?
      AND o.status = 'done'
      AND o.created_at >= ?
      AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
    ORDER BY o.created_at DESC
    LIMIT 100
  `, [req.user.id, from, to]);

  res.json({
    from,
    to,
    summary: {
      orders: Number(summary.orders) || 0,
      revenue: Number(summary.revenue) || 0,
      sold: Number(items.sold) || 0
    },
    topMenus,
    transactions
  });
}));

const NEXT = { reserved: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['done', 'cancelled'] };
app.patch('/api/orders/:id/status', guard('mahasiswa', 'dosen', 'tenant'), wrap(async (req, res) => {
  const [o] = await q('SELECT o.id,o.status,o.user_id,t.owner_id FROM orders o JOIN tenants t ON t.id=o.tenant_id WHERE o.id=?', [req.params.id]);
  const to = req.body.status;
  if (!o) return bad(res, 'Reservasi tidak ditemukan.', 404);
  const isOwner = req.user.role === 'tenant' && o.owner_id === req.user.id;
  const isBuyer = ['mahasiswa', 'dosen'].includes(req.user.role) && o.user_id === req.user.id;
  const allowed = isOwner ? (NEXT[o.status] || []) : isBuyer && o.status === 'reserved' ? ['cancelled'] : [];
  if (!allowed.includes(to)) return bad(res, 'Perubahan status tidak diizinkan.', 403);
  const r = await q('UPDATE orders SET status=? WHERE id=? AND status=?', [to, o.id, o.status]);
  if (!r.affectedRows) return bad(res, 'Status sudah berubah. Muat ulang.', 409);
  res.json({ ok: true });
}));
app.patch('/api/tenant/open', guard('tenant'), wrap(async (req, res) => {
  await q('UPDATE tenants SET is_open=? WHERE owner_id=?', [req.body.open ? 1 : 0, req.user.id]); res.json({ ok: true }); }));
/* ---------------- Foto profil (dosen & mahasiswa) ---------------- */
const AVATAR_DIR = path.resolve('public/uploads/avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });
const IMG_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (r, f, cb) => cb(null, AVATAR_DIR),
    filename: (r, f, cb) => cb(null, `${crypto.randomUUID()}${IMG_EXT[f.mimetype]}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (r, f, cb) => (IMG_EXT[f.mimetype] ? cb(null, true) : cb(new Error('Foto harus berformat JPG, PNG, atau WEBP.')))
});
const removeAvatarFile = (url) => { if (url && url.startsWith('/uploads/avatars/')) fs.unlink(path.join(AVATAR_DIR, path.basename(url)), () => {}); };
/* ---------------- Profil, tim lomba, kelola menu ---------------- */
const arr = (v) => JSON.stringify((Array.isArray(v) ? v : []).map((x) => String(x).slice(0, 60)).slice(0, 20));
const PROFILE_COLS = 'id,role,login_id,name,prodi,semester,angkatan,title,email,headline,about,collaboration,is_public,photo_url,skills,interests,expertise,courses,publications,competitions,projects,certifications';
const PROFILE_JSON = ['skills', 'interests', 'expertise', 'courses', 'publications', 'competitions', 'projects', 'certifications'];
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const yearOf = (v) => { const n = parseInt(v, 10); return n >= 1900 && n <= 2100 ? n : null; };
const rows = (v, max, shape) => (Array.isArray(v) ? v : []).slice(0, max).map(shape).filter((o) => Object.values(o).some(Boolean));

app.get('/api/profile', guard('mahasiswa', 'dosen'), wrap(async (req, res) => {
  const [u] = await q(`SELECT ${PROFILE_COLS} FROM users WHERE id=?`, [req.user.id]);
  PROFILE_JSON.forEach((c) => { u[c] = u[c] == null ? [] : pj(u[c]); });
  res.json({ ...u, isPublic: !!u.is_public });
}));

app.put('/api/profile', guard('mahasiswa', 'dosen'), wrap(async (req, res) => {
  const b = req.body || {};
  const common = [str(b.headline, 160), str(b.about, 2000)];
  if (req.user.role === 'dosen') {
    const email = str(b.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Format email tidak valid.');
    await q('UPDATE users SET headline=?,about=?,title=?,email=?,expertise=?,courses=?,publications=? WHERE id=?',
      [...common, str(b.title, 120), email || null, arr(b.expertise), arr(b.courses),
       JSON.stringify(rows(b.publications, 20, (p) => ({ title: str(p?.title, 200), venue: str(p?.venue, 150), year: yearOf(p?.year) }))), req.user.id]);
  } else {
    await q('UPDATE users SET headline=?,about=?,skills=?,interests=?,collaboration=?,is_public=?,competitions=?,projects=?,certifications=? WHERE id=?',
      [...common, arr(b.skills), arr(b.interests), b.collaboration === 'closed' ? 'closed' : 'open', b.isPublic === false ? 0 : 1,
       JSON.stringify(rows(b.competitions, 10, (c) => ({ title: str(c?.title, 150), result: str(c?.result, 80), year: yearOf(c?.year) }))),
       JSON.stringify(rows(b.projects, 10, (p) => ({ title: str(p?.title, 120), desc: str(p?.desc, 300) }))),
       JSON.stringify(rows(b.certifications, 10, (c) => ({ name: str(c?.name, 120), issuer: str(c?.issuer, 100) }))), req.user.id]);
  }
  res.json({ ok: true });
}));

app.post('/api/profile/photo', guard('mahasiswa', 'dosen'), avatarUpload.single('photo'), wrap(async (req, res) => {
  if (!req.file) return bad(res, 'Pilih foto terlebih dahulu.');
  const [old] = await q('SELECT photo_url FROM users WHERE id=?', [req.user.id]);
  const url = `/uploads/avatars/${req.file.filename}`;
  await q('UPDATE users SET photo_url=? WHERE id=?', [url, req.user.id]);
  removeAvatarFile(old?.photo_url);
  res.json({ ok: true, photo_url: url });
}));
app.delete('/api/profile/photo', guard('mahasiswa', 'dosen'), wrap(async (req, res) => {
  const [old] = await q('SELECT photo_url FROM users WHERE id=?', [req.user.id]);
  await q('UPDATE users SET photo_url=NULL WHERE id=?', [req.user.id]);
  removeAvatarFile(old?.photo_url);
  res.json({ ok: true });
}));
app.get('/api/teams', guard('mahasiswa', 'dosen'), wrap(async (req, res) => {
  const rows = await q(`SELECT t.id,t.title,t.organizer,t.deadline,t.description,t.roles,t.skills,t.closed,t.author_id AS authorId,u.name AS authorName,u.role AS authorRole,u.photo_url AS authorPhoto,
    (SELECT COUNT(*) FROM team_applicants a WHERE a.team_id=t.id) AS applicants,
    EXISTS(SELECT 1 FROM team_applicants a WHERE a.team_id=t.id AND a.user_id=?) AS applied
    FROM teams t JOIN users u ON u.id=t.author_id ORDER BY t.id DESC`, [req.user.id]);
  res.json(rows.map((t) => ({ ...t, roles: pj(t.roles), skills: pj(t.skills), closed: !!t.closed, applied: !!t.applied })));
}));
app.post('/api/teams', guard('mahasiswa'), wrap(async (req, res) => {
  const b = req.body, title = String(b.title || '').trim().slice(0, 120);
  if (!title) return bad(res, 'Judul tim wajib diisi.');
  const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const r = await q('INSERT INTO teams (author_id,title,organizer,deadline,description,roles,skills) VALUES (?,?,?,?,?,?,?)',
    [req.user.id, title, String(b.organizer || '').slice(0, 120), /^\d{4}-\d{2}-\d{2}$/.test(b.deadline) ? b.deadline : null, String(b.description || '').slice(0, 1500),
     JSON.stringify(list(b.roles).slice(0, 10).map((role) => ({ role: role.slice(0, 60), count: 1 }))), arr(list(b.skills))]);
  await q('INSERT INTO team_members VALUES (?,?)', [r.insertId, req.user.id]);
  res.status(201).json({ id: r.insertId });
}));
app.post('/api/teams/:id/join', guard('mahasiswa'), wrap(async (req, res) => {
  const [t] = await q('SELECT id,title,author_id,closed FROM teams WHERE id=?', [req.params.id]);
  if (!t || t.closed) return bad(res, 'Rekrutmen tim ini sudah ditutup.', 409);
  if (t.author_id === req.user.id) return bad(res, 'Ini tim kamu sendiri.');
  if ((await q('SELECT 1 FROM team_applicants WHERE team_id=? AND user_id=?', [t.id, req.user.id])).length) return bad(res, 'Kamu sudah mengajukan bergabung.', 409);
  await q('INSERT INTO team_applicants VALUES (?,?)', [t.id, req.user.id]);
  res.json({ ok: true });
}));
app.patch('/api/teams/:id/close', guard('mahasiswa'), wrap(async (req, res) => {
  await q('UPDATE teams SET closed=? WHERE id=? AND author_id=?', [req.body.closed ? 1 : 0, req.params.id, req.user.id]); res.json({ ok: true }); }));

/* ---------------- Kelola menu tenant ---------------- */

// Ambil semua menu milik tenant yang sedang login
app.get('/api/tenant/menus', guard('tenant'), wrap(async (req, res) => {
  const menus = await q(`
    SELECT
      m.id,
      m.name,
      m.description,
      m.price,
      m.image_url AS image,
      m.available
    FROM menus m
    JOIN tenants t ON t.id = m.tenant_id
    WHERE t.owner_id = ?
    ORDER BY m.id DESC
  `, [req.user.id]);

  res.json(menus.map(m => ({
    ...m,
    available: !!m.available
  })));
}));

// Tambah menu baru
app.post('/api/tenant/menus', guard('tenant'), wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const description = String(req.body.description || '').trim().slice(0, 200);
  const price = Math.round(Number(req.body.price));

  if (!name) return bad(res, 'Nama menu wajib diisi.');
  if (!Number.isFinite(price) || price < 1000 || price > 1000000) {
    return bad(res, 'Harga harus antara Rp1.000 dan Rp1.000.000.');
  }

  const result = await q(`
    INSERT INTO menus (tenant_id, name, description, price)
    SELECT id, ?, ?, ?
    FROM tenants
    WHERE owner_id = ?
  `, [name, description || null, price, req.user.id]);

  if (!result.affectedRows) {
    return bad(res, 'Data tenant tidak ditemukan.', 404);
  }

  res.status(201).json({ ok: true, id: result.insertId });
}));

// Edit nama, deskripsi, harga, atau ketersediaan
app.patch('/api/tenant/menus/:id', guard('tenant'), wrap(async (req, res) => {
  const sets = [];
  const vals = [];
  const b = req.body;

  if ('name' in b) {
    const name = String(b.name || '').trim().slice(0, 80);
    if (!name) return bad(res, 'Nama menu wajib diisi.');
    sets.push('m.name = ?');
    vals.push(name);
  }

  if ('description' in b) {
    sets.push('m.description = ?');
    vals.push(String(b.description || '').trim().slice(0, 200) || null);
  }

  if ('price' in b) {
    const price = Math.round(Number(b.price));
    if (!Number.isFinite(price) || price < 1000 || price > 1000000) {
      return bad(res, 'Harga harus antara Rp1.000 dan Rp1.000.000.');
    }
    sets.push('m.price = ?');
    vals.push(price);
  }

  if ('available' in b) {
    sets.push('m.available = ?');
    vals.push(b.available ? 1 : 0);
  }

  if (!sets.length) return bad(res, 'Tidak ada perubahan.');

  const result = await q(`
    UPDATE menus m
    JOIN tenants t ON t.id = m.tenant_id
    SET ${sets.join(', ')}
    WHERE m.id = ? AND t.owner_id = ?
  `, [...vals, req.params.id, req.user.id]);

  if (!result.affectedRows) {
    return bad(res, 'Menu tidak ditemukan.', 404);
  }

  res.json({ ok: true });
}));

// Hapus menu
app.delete('/api/tenant/menus/:id', guard('tenant'), wrap(async (req, res) => {
  const [menu] = await q(`
    SELECT m.id, m.image_url
    FROM menus m
    JOIN tenants t ON t.id = m.tenant_id
    WHERE m.id = ? AND t.owner_id = ?
  `, [req.params.id, req.user.id]);

  if (!menu) return bad(res, 'Menu tidak ditemukan.', 404);

  await q('DELETE FROM menus WHERE id = ?', [menu.id]);
  removeFoodImage(menu.image_url);

  res.json({ ok: true });
}));

// Upload atau ganti foto menu
app.post(
  '/api/tenant/menus/:id/image',
  guard('tenant'),
  foodUpload.single('image'),
  wrap(async (req, res) => {
    if (!req.file) return bad(res, 'Pilih foto terlebih dahulu.');

    const [menu] = await q(`
      SELECT m.id, m.image_url
      FROM menus m
      JOIN tenants t ON t.id = m.tenant_id
      WHERE m.id = ? AND t.owner_id = ?
    `, [req.params.id, req.user.id]);

    if (!menu) {
      fs.unlink(req.file.path, () => {});
      return bad(res, 'Menu tidak ditemukan.', 404);
    }

    const imageUrl = `/uploads/food/${req.file.filename}`;

    await q(
      'UPDATE menus SET image_url = ? WHERE id = ?',
      [imageUrl, menu.id]
    );

    removeFoodImage(menu.image_url);

    res.json({ ok: true, image: imageUrl });
  })
);

/* ---------------- Cuaca & libur (retry + cache + fallback) ---------------- */
const cache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry(url, {
  headers = {},
  timeout = 15000,
  retries = 2,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const error = new Error(`upstream ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      // Ulangi hanya untuk gangguan sementara. 402/403/404 tidak di-retry.
      const retryable = !error.status ||
        [408, 425, 429, 500, 502, 503, 504].includes(error.status);

      if (!retryable || attempt === retries) break;
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError;
}

async function cached(key, ttl, url, options = {}) {
  const hit = cache.get(key);

  if (hit && Date.now() - hit.t < ttl) {
    return hit.data;
  }

  try {
    const data = await fetchJsonWithRetry(url, options);
    cache.set(key, { t: Date.now(), data });
    return data;
  } catch (error) {
    // Jika API sedang gagal, gunakan data terakhir yang pernah berhasil.
    if (hit) {
      console.warn(`[cache] Menggunakan data lama untuk ${key}:`, error.message);
      return hit.data;
    }
    throw error;
  }
}

/* MET Norway meminta User-Agent yang mengidentifikasi aplikasi.
   Isi MET_CONTACT_EMAIL di .env dengan alamat kontak yang valid. */
const MET_UA = {
  'User-Agent': `MDP-ONE/1.5 (${process.env.MET_CONTACT_EMAIL || 'contact-not-configured'})`,
};

const metCode = (s = '') => {
  const b = s.replace(/_(day|night|polartwilight)$/, '');
  if (b.includes('thunder')) return 95;
  if (b.includes('heavyrain')) return 65;
  if (b.includes('rain') || b.includes('sleet') || b.includes('snow')) {
    return b.includes('light') ? 51 : 63;
  }
  if (b === 'fog') return 45;
  if (b === 'clearsky') return 0;
  if (b === 'fair') return 1;
  if (b === 'partlycloudy') return 2;
  return 3;
};

const SEV = { 95: 5, 65: 4, 63: 3, 51: 2 };

async function weatherFromMet() {
  const j = await cached(
    'met',
    10 * 60e3,
    'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=-2.9761&lon=104.7754',
    { headers: MET_UA, timeout: 15000, retries: 1 },
  );

  const ts = j?.properties?.timeseries;
  if (!Array.isArray(ts) || !ts.length) {
    throw new Error('Format respons MET Norway tidak sesuai.');
  }

  const first = ts[0].data;
  const sym = first.next_1_hours?.summary?.symbol_code ||
    first.next_6_hours?.summary?.symbol_code;
  const days = new Map();

  for (const t of ts) {
    const day = new Date(new Date(t.time).getTime() + 7 * 3600e3)
      .toISOString().slice(0, 10);
    const d = t.data;
    const code = metCode(
      d.next_1_hours?.summary?.symbol_code ||
      d.next_6_hours?.summary?.symbol_code,
    );
    const rain = d.next_1_hours?.details?.precipitation_amount ??
      d.next_6_hours?.details?.precipitation_amount ?? 0;
    const a = days.get(day) || { temps: [], codes: [], wet: 0, n: 0 };
    a.temps.push(d.instant.details.air_temperature);
    a.codes.push(code);
    a.n += 1;
    if (rain > 0.1) a.wet += 1;
    days.set(day, a);
  }

  const list = [...days.entries()].slice(0, 5);
  const pickCode = (codes) => {
    const wet = codes.filter((c) => c >= 51 && c !== 45);
    if (wet.length >= 2) {
      return wet.sort((x, y) => (SEV[y] || 0) - (SEV[x] || 0))[0];
    }
    const freq = new Map();
    codes.forEach((c) => freq.set(c, (freq.get(c) || 0) + 1));
    return [...freq.entries()].sort((x, y) => y[1] - x[1])[0][0];
  };

  const now = first.instant.details;
  return {
    source: 'met.no',
    current: {
      temperature_2m: now.air_temperature,
      apparent_temperature: now.air_temperature,
      relative_humidity_2m: Math.round(now.relative_humidity ?? 0),
      weather_code: metCode(sym),
      wind_speed_10m: (now.wind_speed ?? 0) * 3.6,
    },
    daily: {
      time: list.map(([d]) => d),
      weather_code: list.map(([, a]) => pickCode(a.codes)),
      temperature_2m_max: list.map(([, a]) => Math.max(...a.temps)),
      temperature_2m_min: list.map(([, a]) => Math.min(...a.temps)),
      precipitation_probability_max: list.map(([, a]) =>
        Math.round((100 * a.wet) / a.n)),
    },
  };
}

let openMeteoDownUntil = 0;
const extLimit = limiter(60, 60e3);

app.get('/api/weather', guard(), extLimit, wrap(async (req, res) => {
  const p = new URLSearchParams({
    latitude: '-2.9761',
    longitude: '104.7754',
    timezone: 'Asia/Jakarta',
    forecast_days: '5',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  });

  if (Date.now() > openMeteoDownUntil) {
    try {
      const data = await cached(
        'wx',
        10 * 60e3,
        `https://api.open-meteo.com/v1/forecast?${p}`,
        { timeout: 15000, retries: 2 },
      );
      return res.json(data);
    } catch (error) {
      console.error('[weather] Open-Meteo gagal:', error.cause?.code || error.message);
      // Jeda 2 menit sebelum mencoba Open-Meteo lagi.
      openMeteoDownUntil = Date.now() + 2 * 60e3;
    }
  }

  try {
    return res.json(await weatherFromMet());
  } catch (error) {
    console.error('[weather] MET gagal:', error.cause?.code || error.message);
    return bad(res, 'Layanan cuaca sementara tidak tersedia.', 502);
  }
}));

app.get('/api/holidays', guard(), extLimit, wrap(async (req, res) => {
  const y = Math.min(
    Math.max(Number(req.query.year) || new Date().getFullYear(), 2020),
    2100,
  );

  try {
    // Nager.Date API v3: kode negara Indonesia = ID.
    const rows = await cached(
      `holidays-ID-${y}`,
      24 * 3600e3,
      `https://date.nager.at/api/v3/PublicHolidays/${y}/ID`,
      { timeout: 15000, retries: 2 },
    );

    if (!Array.isArray(rows)) {
      throw new Error('Format respons hari libur tidak sesuai.');
    }

    // Sertakan alias agar frontend yang memakai nama field umum tetap mudah disesuaikan.
    const normalized = rows.map((h) => ({
      date: h.date,
      localName: h.localName || h.name || '',
      name: h.name || h.localName || '',
      countryCode: h.countryCode || 'ID',
      types: h.types || [],
      global: Boolean(h.global),
      holiday_date: h.date,
      holiday_name: h.localName || h.name || '',
      is_national_holiday: Boolean(h.global),
    }));

    return res.json(normalized);
  } catch (error) {
    console.error('[holidays] Gagal mengambil hari libur:', error.cause?.code || error.message);
    return bad(res, 'Layanan hari libur sementara tidak tersedia.', 502);
  }
}));

/* ---------------- Error handler terpusat ---------------- */
app.use('/api', (req, res) => bad(res, 'Endpoint tidak ditemukan.', 404));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (res.headersSent) return;
  if (err instanceof multer.MulterError) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return bad(res, 'Ukuran foto maksimal 5 MB.', 413);
  }
  return bad(res, 'Upload foto gagal.');
}

if (err.message?.startsWith('Foto harus')) {
  return bad(res, err.message, 400);
}
  if (err.type === 'entity.parse.failed') return bad(res, 'JSON tidak valid.');
  if (err.type === 'entity.too.large') return bad(res, 'Data terlalu besar.', 413);
  res.status(500).json({ message: 'Terjadi kesalahan server.', ...(PROD ? {} : { detail: err.code || err.message }) });
});

app.listen(PORT, () => console.log(`MDP ONE di http://localhost:${PORT}`));