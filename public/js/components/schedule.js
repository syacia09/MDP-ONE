import { el } from '../lib/dom.js';
import { toMinutes } from '../lib/format.js';

/**
 * Daftar jadwal hari ini dengan status Selesai / Berlangsung / Berikutnya.
 * items: [{ start: 'HH:MM', end: 'HH:MM', title, meta }] — bisa dipakai mahasiswa maupun dosen.
 */
export function renderSchedule(list, items, emptyMessage) {
  list.replaceChildren();
  if (!items.length) { list.append(el('p', 'empty-state', emptyMessage)); return; }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let nextMarked = false;

  items.forEach((item) => {
    let status = 'Akan datang';
    let cls = 'is-upcoming';
    if (nowMin >= toMinutes(item.end)) { status = 'Selesai'; cls = 'is-past'; }
    else if (nowMin >= toMinutes(item.start)) { status = 'Berlangsung'; cls = 'is-live'; nextMarked = true; }
    else if (!nextMarked) { status = 'Berikutnya'; cls = 'is-next'; nextMarked = true; }

    const row = el('div', `schedule-item ${cls}`);
    const time = el('div', 'schedule-time');
    time.append(el('strong', '', item.start), el('small', '', item.end));
    const body = el('div', 'schedule-body');
    body.append(el('strong', '', item.title), el('small', '', item.meta));
    row.append(time, body, el('span', 'schedule-status', status));
    list.append(row);
  });
}