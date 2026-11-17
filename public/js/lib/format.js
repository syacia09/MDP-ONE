/** Helper format tanggal, waktu, dan mata uang bersama. */
export const pad2 = (n) => String(n).padStart(2, '0');
export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export function isoOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function daysFromToday(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${dateString}T00:00:00`) - today) / 86400000);
}

export function relativeLabel(days) {
  if (days < 0) return 'Terlambat';
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  return `${days} hari lagi`;
}

export function urgencyClass(days) {
  if (days < 0) return 'urgency-overdue';
  if (days === 0) return 'urgency-today';
  if (days <= 3) return 'urgency-soon';
  return 'urgency-calm';
}

/** Format angka ke Rupiah; nilai tidak valid dianggap 0. */
export const formatRupiah = (v) => rupiah.format(Number(v) || 0);