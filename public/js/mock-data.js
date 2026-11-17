/**
 * DATA DUMMY — meniru struktur SPON (Moodle) dan Simponi.
 * Nama dosen, tagihan, dan tanggal akademik adalah karangan.
 * Tanggal tugas dibuat relatif terhadap hari ini supaya dashboard selalu terlihat "hidup".
 */
const pad = (n) => String(n).padStart(2, "0");
const isoOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const unix = (isoDate, hhmm) =>
  Math.floor(new Date(`${isoDate}T${hhmm}:00`).getTime() / 1000);

export const SEMESTER = {
  label: "2026/2027 Ganjil",
  program: "Informatika",
  kelas: "IF11",
  semesterKe: 1,
  targetSks: 144,
};

const COURSES = {
  IF0001: { name: "Aljabar Linier", sks: 4, lecturer: "Budi Santoso, M.Si." },
  IF0002: { name: "Basis Data I", sks: 4, lecturer: "Citra Lestari, M.Kom." },
  IF0003: { name: "Kalkulus I", sks: 4, lecturer: "Andi Prakoso, M.Si." },
  IF0004: {
    name: "Pengantar Ilmu Komputer",
    sks: 2,
    lecturer: "Hendra Wijaya, M.Kom.",
  },
  IF0006: {
    name: "Pemrograman Dasar",
    sks: 3,
    lecturer: "Rina Marlina, M.Kom.",
  },
  IF0056: {
    name: "Pengantar Literasi Digital",
    sks: 3,
    lecturer: "Sari Kusuma, M.Kom.",
  },
};

const BUILDING = "Gedung IT Super Store";
// day: 0 = Minggu ... 6 = Sabtu. Durasi mengikuti pola 3 SKS = 90 menit.
const WEEKLY = [
  { day: 1, start: "17:10", end: "18:40", code: "IF0006", room: "Lab B605" },
  { day: 2, start: "17:10", end: "19:10", code: "IF0003", room: "R. B301" },
  { day: 3, start: "17:10", end: "19:10", code: "IF0002", room: "Lab B604" },
  { day: 4, start: "17:10", end: "19:10", code: "IF0001", room: "R. B302" },
  { day: 5, start: "17:10", end: "18:10", code: "IF0004", room: "R. B301" },
  { day: 5, start: "18:20", end: "19:50", code: "IF0056", room: "R. B303" },
];

const schedule = WEEKLY.map((w) => ({
  ...w,
  course: COURSES[w.code].name,
  sks: COURSES[w.code].sks,
  kelas: SEMESTER.kelas,
  building: BUILDING,
  lecturer: COURSES[w.code].lecturer,
}));

// H = hadir, I = izin, A = alpha, '-' = pertemuan belum berlangsung. 18 pertemuan.
const marks = (code, text) => ({
  code,
  course: COURSES[code].name,
  sks: COURSES[code].sks,
  kelas: SEMESTER.kelas,
  marks: text,
});

/* ---------------- SPON (Moodle) ----------------
 * Bentuk mengikuti event "action" Moodle: name, modulename, course{}, timesort (unix), action{}.
 */
const course = (id, code) => ({
  id,
  shortname: `${code}-${SEMESTER.kelas}`,
  fullname: COURSES[code].name,
});

export const SPON_DATA = {
  platform: "moodle",
  events: [
    {
      id: 4101,
      name: "Tugas 3: Query SQL Dasar jatuh tempo",
      modulename: "assign",
      course: course(12, "IF0002"),
      timesort: unix(isoOffset(-2), "23:59"),
      action: { name: "Lihat pengiriman", actionable: false },
      isDone: true,
    },
    {
      id: 4102,
      name: "Latihan Praktikum 7: Perulangan jatuh tempo",
      modulename: "assign",
      course: course(16, "IF0006"),
      timesort: unix(isoOffset(1), "23:59"),
      action: { name: "Tambah pengiriman", actionable: true },
      isDone: false,
    },
    {
      id: 4103,
      name: "Kuis 4: Model Entity Relationship ditutup",
      modulename: "quiz",
      course: course(12, "IF0002"),
      timesort: unix(isoOffset(2), "21:00"),
      action: { name: "Coba kuis sekarang", actionable: true },
      isDone: false,
    },
    {
      id: 4104,
      name: "Kuis 5: Limit dan Kekontinuan ditutup",
      modulename: "quiz",
      course: course(13, "IF0003"),
      timesort: unix(isoOffset(3), "23:59"),
      action: { name: "Coba kuis sekarang", actionable: true },
      isDone: false,
    },
    {
      id: 4105,
      name: "Tugas 6: Ruang Vektor jatuh tempo",
      modulename: "assign",
      course: course(11, "IF0001"),
      timesort: unix(isoOffset(4), "23:59"),
      action: { name: "Tambah pengiriman", actionable: true },
      isDone: false,
    },
    {
      id: 4106,
      name: "Refleksi Etika Bermedia Digital jatuh tempo",
      modulename: "assign",
      course: course(66, "IF0056"),
      timesort: unix(isoOffset(7), "23:59"),
      action: { name: "Tambah pengiriman", actionable: true },
      isDone: false,
    },
    {
      id: 4107,
      name: "Rangkuman Video Pembelajaran Bab 4 jatuh tempo",
      modulename: "assign",
      course: course(14, "IF0004"),
      timesort: unix(isoOffset(9), "23:59"),
      action: { name: "Tambah pengiriman", actionable: true },
      isDone: false,
    },
  ],
  announcements: [
    {
      id: "sp-news-1",
      source: "SPON",
      code: "IF0004",
      kelas: "IF11",
      course: "Pengantar Ilmu Komputer",
      author: "Hendra Wijaya, M.Kom.",
      postedAt: `${isoOffset(-1)}T10:20:00`,
      title: "Video pembelajaran Bab 4 tersedia",
      body: "Materi video Bab 4 sudah dapat diakses di SPON. Silakan simak sebelum pertemuan berikutnya.",
    },
  ],
};

/* ---------------- Simponi ---------------- */
export const SIMPONI_DATA = {
  semester: SEMESTER,
  schedule,
  attendance: [
    marks("IF0001", "HHHHHHHHHHHHHHHHH-"),
    marks("IF0002", "HHHHHHHHHHHHHHHHH-"),
    marks("IF0003", "HHHHHHHHIHHHHHH---"),
    marks("IF0006", "HHHHHHHHHHHHHHHHHH"),
    marks("IF0004", "HHHHHHHHH---------"),
    marks("IF0056", "HHHHHHHHHHHHHHHHH-"),
  ],
  attendanceMinimum: 75,
  sks: {
    passed: 0,
    target: SEMESTER.targetSks,
    taken: schedule.reduce(
      (sum, s, i, arr) =>
        arr.findIndex((x) => x.code === s.code) === i ? sum + s.sks : sum,
      0,
    ),
  },
  payment: {
    label: "Cicilan 2 — Semester Ganjil",
    amount: 3250000,
    dueDate: isoOffset(5),
    status: "Belum dibayar",
  },
  announcements: [
    {
      id: "sm-1",
      source: "Simponi",
      code: "IF0056",
      kelas: "IF11",
      course: "Pengantar Literasi Digital",
      author: "Sari Kusuma, M.Kom.",
      postedAt: `${isoOffset(-2)}T16:10:00`,
      title: "Grup komunikasi kelas",
      body: "Silakan bergabung ke grup WhatsApp kelas untuk memudahkan komunikasi terkait perkuliahan.",
    },
    {
      id: "sm-2",
      source: "Simponi",
      code: "IF0002",
      kelas: "IF11",
      course: "Basis Data I",
      author: "Citra Lestari, M.Kom.",
      postedAt: `${isoOffset(-3)}T13:10:00`,
      title: "Persiapan praktikum",
      body: "Mohon membawa laptop dengan DBMS terpasang pada pertemuan praktikum berikutnya.",
    },
    {
      id: "sm-3",
      source: "Simponi",
      code: "IF0003",
      kelas: "IF11",
      course: "Kalkulus I",
      author: "Andi Prakoso, M.Si.",
      postedAt: `${isoOffset(-4)}T09:40:00`,
      title: "Pembahasan soal latihan",
      body: "Pembahasan soal latihan limit akan dilakukan di awal pertemuan Selasa.",
    },
  ],
  // Periode perkuliahan & kalender akademik (karangan, untuk demo kalender)
  semesterPeriod: { start: "2026-08-24", end: "2026-12-12" },
  academicEvents: [
    { date: "2026-08-10", endDate: "2026-08-21", title: "Pengisian KRS" },
    { date: "2026-08-24", title: "Awal perkuliahan semester ganjil" },
    { date: "2026-08-31", endDate: "2026-09-04", title: "Masa perubahan KRS" },
    {
      date: "2026-10-12",
      endDate: "2026-10-17",
      title: "Ujian Tengah Semester (UTS)",
      exam: true,
    },
    { date: "2026-12-12", title: "Akhir perkuliahan" },
    {
      date: "2026-12-14",
      endDate: "2026-12-19",
      title: "Ujian Akhir Semester (UAS)",
      exam: true,
    },
    { date: "2027-01-08", title: "Pengumuman nilai semester ganjil" },
    { date: "2026-08-14", title: "Batas pembayaran cicilan 1" },
    { date: isoOffset(5), title: "Batas pembayaran cicilan 2" },
  ],
};
