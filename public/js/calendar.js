/** Kalender akademik bergaya Google Calendar: grid bulanan, daftar kalender, agenda harian. */
export const CALENDARS = [
  { id: 'kuliah', label: 'Jadwal kuliah', color: '#4285f4' },
  { id: 'spon', label: 'Tenggat SPON', color: '#0b8043' },
  { id: 'akademik', label: 'Kalender akademik', color: '#f09300' },
  { id: 'libur', label: 'Hari libur nasional', color: '#d93025' }
];

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => new Date(`${s}T00:00:00`);

function eachDay(startISO, endISO = startISO) {
  const out = [];
  const d = parseISO(startISO);
  const end = parseISO(endISO);
  while (d <= end) {
    out.push(toISO(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const rangeText = (a, b) => {
  const f = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
  return b ? `${f.format(parseISO(a))} – ${f.format(parseISO(b))}` : '';
};

export function buildEvents({ spon, simponi, holidays = [] }) {
  const events = [];
  const add = (e) => events.push(e);

  holidays.forEach((h) => add({ date: h.date, title: h.name, detail: 'Hari libur nasional', cal: 'libur' }));
  const holidayDays = new Set(holidays.map((h) => h.date));

  if (simponi) {
    const examDays = new Set();
    simponi.academicEvents.forEach((ev) => {
      const days = eachDay(ev.date, ev.endDate);
      if (ev.exam) days.forEach((d) => examDays.add(d));
      days.forEach((d) => add({ date: d, title: ev.title, detail: rangeText(ev.date, ev.endDate), cal: 'akademik' }));
    });

    eachDay(simponi.semesterPeriod.start, simponi.semesterPeriod.end).forEach((day) => {
      if (examDays.has(day) || holidayDays.has(day)) return;
      const dow = parseISO(day).getDay();
      simponi.schedule.filter((s) => s.day === dow).forEach((s) => add({
        date: day, time: s.start, endTime: s.end, title: s.course,
        detail: `${s.room} · ${s.building} · ${s.lecturer}`, cal: 'kuliah'
      }));
    });
  }

  if (spon) {
    spon.events.forEach((e) => {
      const due = new Date(e.timesort * 1000);
      add({
        date: toISO(due), time: `${pad(due.getHours())}:${pad(due.getMinutes())}`, title: e.name,
        detail: `${e.course.fullname} · ${e.course.shortname}`, cal: 'spon', done: e.isDone
      });
    });
  }
  return events;
}

const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const longDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const colorOf = (id) => CALENDARS.find((c) => c.id === id).color;

export function createCalendar(root) {
  const now = new Date();
  let view = new Date(now.getFullYear(), now.getMonth(), 1);
  let selected = toISO(now);
  let events = [];
  const enabled = new Set(CALENDARS.map((c) => c.id));

  function groupByDate() {
    const map = new Map();
    events.filter((e) => enabled.has(e.cal)).forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    });
    map.forEach((list) => list.sort((a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || (a.time || '').localeCompare(b.time || '')));
    return map;
  }

  function pill(e) {
    const p = el('span', `cal-pill ${e.time ? 'timed' : 'allday'}${e.done ? ' done' : ''}`);
    p.style.setProperty('--c', colorOf(e.cal));
    p.title = e.title;
    if (e.time) p.append(el('i', 'cal-dot'));
    p.append(el('span', 'cal-pill-text', e.time ? `${e.time} ${e.title}` : e.title));
    return p;
  }

  function render() {
    const map = groupByDate();
    root.replaceChildren();

    const bar = el('div', 'cal-toolbar');
    const todayBtn = el('button', 'cal-btn', 'Hari ini');
    todayBtn.type = 'button';
    todayBtn.addEventListener('click', () => {
      const t = new Date();
      view = new Date(t.getFullYear(), t.getMonth(), 1);
      selected = toISO(t);
      render();
    });
    const shift = (delta) => () => { view = new Date(view.getFullYear(), view.getMonth() + delta, 1); render(); };
    const prev = el('button', 'cal-icon', '‹');
    const next = el('button', 'cal-icon', '›');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Bulan sebelumnya');
    next.setAttribute('aria-label', 'Bulan berikutnya');
    prev.addEventListener('click', shift(-1));
    next.addEventListener('click', shift(1));
    bar.append(todayBtn, prev, next, el('h3', 'cal-title', monthFmt.format(view)));

    const grid = el('div', 'cal-grid');
    grid.setAttribute('role', 'grid');
    DOW.forEach((d) => grid.append(el('div', 'cal-dow', d)));

    const offset = view.getDay();
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const todayISO = toISO(new Date());

    for (let i = 0; i < cells; i += 1) {
      const date = new Date(view.getFullYear(), view.getMonth(), 1 - offset + i);
      const iso = toISO(date);
      const cell = el('button', 'cal-cell');
      cell.type = 'button';
      if (date.getMonth() !== view.getMonth()) cell.classList.add('other');
      if (iso === todayISO) cell.classList.add('today');
      if (iso === selected) cell.classList.add('selected');

      cell.append(el('span', 'cal-daynum', String(date.getDate())));
      const list = map.get(iso) || [];
      list.slice(0, 3).forEach((e) => cell.append(pill(e)));
      if (list.length > 3) cell.append(el('span', 'cal-more', `+${list.length - 3} lainnya`));

      cell.addEventListener('click', () => {
        selected = iso;
        if (date.getMonth() !== view.getMonth()) view = new Date(date.getFullYear(), date.getMonth(), 1);
        render();
      });
      grid.append(cell);
    }

    const side = el('aside', 'cal-side');
    side.append(el('h4', '', 'Kalender saya'));
    CALENDARS.forEach((c) => {
      const label = el('label', 'cal-check');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = enabled.has(c.id);
      input.style.accentColor = c.color;
      input.addEventListener('change', () => {
        if (input.checked) enabled.add(c.id); else enabled.delete(c.id);
        render();
      });
      label.append(input, el('span', '', c.label));
      side.append(label);
    });

    side.append(el('h4', 'cal-agenda-title', longDay.format(parseISO(selected))));
    const items = map.get(selected) || [];
    if (items.length === 0) side.append(el('p', 'empty-state', 'Tidak ada agenda.'));
    items.forEach((e) => {
      const row = el('div', `cal-agenda-item${e.done ? ' done' : ''}`);
      row.style.setProperty('--c', colorOf(e.cal));
      const when = e.time ? `${e.time}${e.endTime ? ` – ${e.endTime}` : ''}` : 'Sepanjang hari';
      row.append(el('strong', '', e.title), el('small', '', `${when}${e.detail ? ` · ${e.detail}` : ''}`));
      side.append(row);
    });

    const layout = el('div', 'cal-layout');
    layout.append(grid, side);
    root.append(bar, layout);
  }

  render();
  return { setEvents(list) { events = list; render(); } };
}