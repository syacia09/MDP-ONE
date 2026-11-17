import { el } from '../lib/dom.js';
import { DAY_NAMES, daysFromToday, relativeLabel, urgencyClass, isoOffset } from '../lib/format.js';
import { getDosenDashboard, getWeather } from '../api.js';
import { renderSchedule } from '../components/schedule.js';
import { createWeatherPanel } from '../components/weather.js';
import { avatarImg } from '../avatar.js';

const TYPE_LABEL = { krs: 'KRS', ta: 'Skripsi/TA', nilai: 'Input nilai' };
const byStart = (a, b) => a.start.localeCompare(b.start);
const btn = (text, cls = 'check-button') => Object.assign(el('button', cls, text), { type: 'button' });

function panel(eyebrow, title, tag) {
  const art = el('article', 'panel');
  const head = el('div', 'panel-heading');
  const t = el('div');
  t.append(el('p', 'eyebrow', eyebrow), el('h2', '', title));
  head.append(t);
  if (tag) head.append(el('span', 'mini-tag', tag));
  const body = el('div');
  art.append(head, body);
  return { art, body };
}

function grid(extra, ...children) {
  const g = el('div', `dashboard-grid ${extra}`.trim());
  g.append(...children);
  return g;
}

function stat(color, icon, label, value, meta) {
  const card = el('article', 'stat-card');
  const box = el('div');
  const strong = el('strong', '', String(value));
  box.append(el('span', 'stat-label', label), strong);
  card.append(el('span', `stat-icon ${color}`, icon), box, el('small', '', meta));
  return { card, set: (v) => { strong.textContent = String(v); } };
}

function nextClassMessage(schedule) {
  const today = new Date().getDay();
  for (let i = 1; i <= 7; i += 1) {
    const day = (today + i) % 7;
    const first = schedule.filter((s) => s.day === day).sort(byStart)[0];
    if (first) return ` Berikutnya: ${DAY_NAMES[day]}, ${first.start} — ${first.course} (${first.kelas}).`;
  }
  return '';
}

export async function initDosenDashboard(root, user, { toast }) {
  root.replaceChildren(el('p', 'empty-state', 'Memuat dashboard dosen...'));
  let data;
  try { data = await getDosenDashboard(); } catch { root.replaceChildren(el('p', 'empty-state', 'Data dashboard tidak dapat dimuat.')); return; }

  const todays = data.schedule.filter((s) => s.day === new Date().getDay()).sort(byStart);
  const pending = () => data.todos.filter((t) => !t.done);
  const firstName = user.name.replace(/^(Dr\.|Prof\.|Ir\.)\s*/i, '').split(/[\s,]/)[0];

  /* Sapaan */
  const welcome = el('div', 'welcome-row');
  const intro = el('div');
  const h1 = el('h1');
  h1.append('Selamat datang, ', Object.assign(el('span'), { id: 'dosenDisplayName', textContent: firstName }), '!');
  intro.append(el('p', 'eyebrow', 'SATU PINTU UNTUK AKTIVITAS MENGAJAR'), h1,
    el('p', 'muted', 'Jadwal mengajar, presensi, antrean validasi, dan mahasiswa wali dalam satu layar.'));
  welcome.append(intro, el('div', 'date-chip', new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })));

  /* Statistik */
  const sClasses = stat('blue', '▤', 'Kelas aktif', data.classes.length, `${data.semester.label}`);
  const sToday = stat('teal', '◒', 'Mengajar hari ini', todays.length, 'sesi tatap muka');
  const sTodo = stat('orange', '★', 'Antrean validasi', pending().length, 'perlu tindakanmu');
  const sPa = stat('purple', '♧', 'Mahasiswa wali', data.advisees.length, `${data.advisees.filter((a) => a.status !== 'Aktif').length} perlu perhatian`);
  const stats = el('div', 'stats-grid four');
  stats.append(sClasses.card, sToday.card, sTodo.card, sPa.card);

  /* Jadwal mengajar + cuaca */
  const sched = panel('HARI INI', 'Jadwal mengajar', 'Data contoh');
  const paintSchedule = () => renderSchedule(sched.body,
    todays.map((s) => ({ start: s.start, end: s.end, title: `${s.course} · ${s.kelas}`, meta: `${s.room} · ${s.building} · ${s.students} mahasiswa` })),
    `Tidak ada jadwal mengajar hari ini.${nextClassMessage(data.schedule)}`);
  paintSchedule();
  setInterval(paintSchedule, 60000);
  sched.body.className = 'schedule-list';

  /* Presensi & BAP */
  const pres = panel('PRESENSI & BAP', 'Sesi perkuliahan', 'Data contoh');
  const sessions = el('div', 'compact-task-list');
  const openCodes = new Map();
  if (!todays.length) sessions.append(el('p', 'empty-state', 'Tidak ada sesi hari ini. Kamu tetap bisa mengisi BAP untuk pertemuan yang terlewat.'));
  todays.forEach((s) => {
    const key = `${s.code}-${s.kelas}`;
    const row = el('div', 'compact-task');
    const body = el('div');
    const info = el('small');
    const toggle = btn('Buka presensi', 'check-button row-action');
    const paint = () => {
      const code = openCodes.get(key);
      info.textContent = code ? `Presensi dibuka · kode ${code}` : `${s.kelas} · ${s.start}–${s.end} · ${s.room}`;
      toggle.textContent = code ? 'Tutup presensi' : 'Buka presensi';
    };
    body.append(el('strong', '', s.course), info);
    toggle.addEventListener('click', () => {
      if (openCodes.has(key)) { openCodes.delete(key); toast(`Presensi ${s.course} ${s.kelas} ditutup.`); }
      else { openCodes.set(key, String(100000 + Math.floor(Math.random() * 900000))); toast(`Presensi ${s.course} ${s.kelas} dibuka.`); }
      paint();
    });
    paint();
    row.append(el('span', 'task-marker'), body, toggle);
    sessions.append(row);
  });
  const bapLog = el('div', 'bap-log');
  const paintBap = () => {
    bapLog.replaceChildren(el('strong', '', 'Riwayat BAP terakhir'));
    data.bap.slice(0, 3).forEach((b) => bapLog.append(el('span', '', `${b.dateOffset === 0 ? 'Hari ini' : relativeLabel(b.dateOffset) === 'Terlambat' ? `${Math.abs(b.dateOffset)} hari lalu` : isoOffset(b.dateOffset)} · ${b.course} ${b.kelas} — ${b.topic} (${b.metode})`)));
  };
  paintBap();
  const foot = el('div', 'panel-foot');
  const addBap = btn('＋ Isi Berita Acara', 'primary-button');
  foot.append(addBap);
  pres.body.append(sessions, bapLog, foot);

  /* Dialog BAP */
  const dlg = el('dialog', 'bap-dialog');
  const form = el('form', 'form-stack');
  const field = (label, control) => { const w = el('div'); w.append(el('label', '', label), control); return w; };
  const kelas = el('select');
  data.classes.forEach((c, i) => kelas.append(Object.assign(el('option'), { value: i, textContent: `${c.course} — ${c.kelas}` })));
  const topic = Object.assign(el('input'), { type: 'text', required: true, maxLength: 120, placeholder: 'Contoh: Join antar tabel' });
  const metode = el('select');
  ['Tatap muka', 'Daring', 'Hybrid'].forEach((m) => metode.append(Object.assign(el('option'), { value: m, textContent: m })));
  const note = Object.assign(el('textarea'), { rows: 3, maxLength: 300, placeholder: 'Catatan (opsional)' });
  const actions = el('div', 'dialog-actions');
  const cancel = btn('Batal', 'secondary-button');
  const save = Object.assign(el('button', 'primary-button', 'Simpan BAP'), { type: 'submit' });
  actions.append(cancel, save);
  form.append(el('h3', '', 'Berita Acara Perkuliahan'), field('Kelas', kelas), field('Materi yang diajarkan', topic), field('Metode', metode), field('Catatan', note), actions);
  dlg.append(form);
  addBap.addEventListener('click', () => dlg.showModal());
  cancel.addEventListener('click', () => dlg.close());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = data.classes[Number(kelas.value)];
    data.bap.unshift({ dateOffset: 0, course: c.course, kelas: c.kelas, topic: topic.value.trim(), metode: metode.value });
    paintBap(); form.reset(); dlg.close();
    toast('BAP tersimpan (data contoh).');
  });

  /* Antrean validasi */
  const todo = panel('PERLU TINDAKAN', 'Antrean validasi', 'Data contoh');
  const todoList = el('div', 'compact-task-list');
  const paintTodos = () => {
    todoList.replaceChildren();
    const rows = pending().map((t) => ({ ...t, days: daysFromToday(isoOffset(t.dueOffset)) })).sort((a, b) => a.days - b.days);
    sTodo.set(rows.length);
    if (!rows.length) { todoList.append(el('p', 'empty-state', 'Semua antrean sudah ditangani.')); return; }
    rows.forEach((t) => {
      const row = el('div', 'compact-task');
      const body = el('div');
      body.append(el('strong', '', t.title), el('small', '', `${TYPE_LABEL[t.type]} · ${t.detail}`));
      const act = btn('Proses', 'check-button');
      act.addEventListener('click', () => { data.todos.find((x) => x.id === t.id).done = true; toast(`${t.title} diproses (data contoh).`); paintTodos(); });
      row.append(el('span', 'task-marker'), body, el('span', `urgency-badge ${urgencyClass(t.days)}`, relativeLabel(t.days)), act);
      todoList.append(row);
    });
  };
  paintTodos();
  todo.body.append(todoList);

  /* Ringkasan kelas */
  const cls = panel('RINGKASAN KELAS', 'Kelas yang diampu', 'Data contoh');
  const clsList = el('div', 'attendance-list');
  data.classes.forEach((c) => {
    const row = el('div', 'attendance-row');
    const head = el('div', 'attendance-head');
    const name = el('div');
    name.append(el('strong', '', `${c.course} · ${c.kelas}`), el('small', '', `${c.code} · ${c.students} mahasiswa · pertemuan ${c.meeting}/${data.semester.totalMeetings}`));
    head.append(name, el('span', `percent-pill${c.attendance < 80 ? ' warn' : ''}`, `${c.attendance}%`));
    const bar = el('div', 'progress');
    const fill = el('span', 'progress-fill');
    fill.style.width = `${Math.round((c.meeting / data.semester.totalMeetings) * 100)}%`;
    bar.append(fill);
    row.append(head, bar);
    clsList.append(row);
  });
  cls.body.append(clsList);

  /* Mahasiswa wali */
  const pa = panel('PERWALIAN AKADEMIK', 'Mahasiswa wali', 'Data contoh');
  const paList = el('div', 'gateway-list');
  data.advisees.forEach((a) => {
    const row = el('div', 'gateway-item');
    const info = el('div');
    info.append(el('strong', '', a.name), el('small', '', `${a.prodi} · Semester ${a.semester} · ${a.status}`));
    row.append(avatarImg({ name: a.name, role: 'mahasiswa' }, 'sm'), info, el('span', `percent-pill${a.ipk < 2.75 ? ' warn' : ''}`, `IPK ${a.ipk.toFixed(2)}`));
    paList.append(row);
  });
  pa.body.append(paList);

  /* Catatan data contoh */
  const banner = el('div', 'info-banner');
  const text = el('div');
  text.append(el('strong', '', 'Data dosen pada halaman ini adalah data contoh.'),
    el('p', '', 'Integrasi resmi memerlukan akses ke sistem akademik kampus. Cuaca diambil dari API publik.'));
  banner.append(el('span', 'banner-icon', '✦'), text);

  root.replaceChildren(welcome, stats, grid('', sched.art, createWeatherPanel(getWeather)), grid('second', pres.art, todo.art), grid('second', cls.art, pa.art), banner, dlg);
}