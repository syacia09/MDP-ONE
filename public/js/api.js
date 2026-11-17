import { SPON_DATA, SIMPONI_DATA } from './mock-data.js';
import { DOSEN_DATA } from './mock-dosen.js';

async function req(url, opt = {}) {
  const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opt });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && !url.includes('/auth/')) location.reload(); // sesi habis → kembali ke login
    throw new Error(d.message || `Request gagal (${r.status}).`);
  }
  return d;
}
const send = (method, data) => ({ method, body: JSON.stringify(data) });

/* Auth */
export const login = (loginId, password) => req('/api/auth/login', send('POST', { loginId, password }));
export const logout = () => req('/api/auth/logout', { method: 'POST' });
export const me = () => req('/api/auth/me');

/* Direktori & chat */
export const getPeople = (role, q = '') => req(`/api/people?role=${role}&q=${encodeURIComponent(q)}`);
export const getConversations = () => req('/api/chat/conversations');
export const getMessages = (peer, after = 0) => req(`/api/chat/${peer}?after=${after}`);
export const sendMessage = (peer, body) => req(`/api/chat/${peer}`, send('POST', { body }));

/* Tugas */
export const getTasks = () => req('/api/tasks');
export const createTask = (t) => req('/api/tasks', send('POST', t));
export const toggleTask = (id) => req(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
export const deleteTask = (id) => req(`/api/tasks/${id}`, { method: 'DELETE' });

/* Kantin */
export const getCanteen = () => req('/api/canteen');
export const createOrder = (o) => req('/api/orders', send('POST', o));
export const getMyOrders = () => req('/api/orders');
export const getTenantOrders = () => req('/api/tenant/orders');
export const setOrderStatus = (id, status) => req(`/api/orders/${id}/status`, send('PATCH', { status }));
export const setTenantOpen = (open) => req('/api/tenant/open', send('PATCH', { open }));

/* SPON & Simponi: masih data contoh */
const fake = (d, ms) => new Promise((ok) => setTimeout(() => ok(structuredClone(d)), ms));
export const getSponDashboard = () => fake(SPON_DATA, 350);
export const getSimponiDashboard = () => fake(SIMPONI_DATA, 500);

/* Cuaca & libur lewat proxy server (tidak diblokir CSP/CORS) */
export const getWeather = () => req('/api/weather');

const FIXED = [[1, 1, 'Tahun Baru Masehi'], [5, 1, 'Hari Buruh Internasional'], [6, 1, 'Hari Lahir Pancasila'], [8, 17, 'Hari Kemerdekaan RI'], [12, 25, 'Hari Raya Natal']];
const pad = (n) => String(n).padStart(2, '0');
const norm = (s) => { const [y, m, d] = String(s).split('-').map(Number); return `${y}-${pad(m)}-${pad(d)}`; };

export async function getHolidays() {
  const y = new Date().getFullYear();
  try {
    const one = async (yr) => (await req(`/api/holidays?year=${yr}`)).filter((r) => r.is_national_holiday)
      .map((r) => ({ date: norm(r.holiday_date), name: r.holiday_name }));
    const [a, b] = await Promise.all([one(y), one(y + 1).catch(() => [])]);
    return { source: 'api', holidays: [...a, ...b] };
  } catch {
    return { source: 'fallback', holidays: [y, y + 1].flatMap((yr) => FIXED.map(([m, d, name]) => ({ date: `${yr}-${pad(m)}-${pad(d)}`, name }))) };
  }
}

/* Profil, tim, kelola menu */
export const getMyProfile = () => req('/api/profile');
export const updateProfile = (p) => req('/api/profile', send('PUT', p));
export const deletePhoto = () => req('/api/profile/photo', { method: 'DELETE' });
export async function uploadPhoto(blob) {
  const fd = new FormData();
  fd.append('photo', blob, 'avatar.jpg');
  const r = await fetch('/api/profile/photo', { method: 'POST', body: fd, credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || `Upload gagal (${r.status}).`);
  return d;
}
export const getTeams = () => req('/api/teams');
export const createTeam = (t) => req('/api/teams', send('POST', t));
export const joinTeam = (id) => req(`/api/teams/${id}/join`, { method: 'POST' });
export const closeTeam = (id, closed) => req(`/api/teams/${id}/close`, send('PATCH', { closed }));
/* Tenant dashboard */
export const getTenantMenus = () => req('/api/tenant/menus');

export const getTenantSummary = () => req('/api/tenant/summary');

export const getTenantReports = (from, to) =>
  req(`/api/tenant/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

export const createMenu = (menu) =>
  req('/api/tenant/menus', send('POST', menu));

export const updateMenu = (id, menu) =>
  req(`/api/tenant/menus/${id}`, send('PATCH', menu));

export const deleteMenu = (id) =>
  req(`/api/tenant/menus/${id}`, { method: 'DELETE' });

export const uploadMenuImage = async (id, file) => {
  const form = new FormData();
  form.append('image', file);

  // Jangan menetapkan Content-Type JSON untuk FormData.
  const r = await fetch(`/api/tenant/menus/${id}/image`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form
  });

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    if (r.status === 401) location.reload();
    throw new Error(d.message || `Upload gagal (${r.status}).`);
  }

  return d;
};

/* Dosen: data contoh (ganti dengan fetch('/api/dosen/dashboard') saat backend siap) */
export const getDosenDashboard = () => fake(DOSEN_DATA, 400);