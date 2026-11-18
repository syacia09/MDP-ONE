import {
  getSponDashboard,
  getSimponiDashboard,
  getWeather,
  getHolidays,
} from "./api.js";
import { createCalendar, buildEvents, toISO } from "./calendar.js";
import { $, el } from "./lib/dom.js";
import {
  rupiah,
  pad2,
  DAY_NAMES,
  daysFromToday,
  relativeLabel,
  urgencyClass,
} from "./lib/format.js";
import { renderSchedule as renderScheduleList } from "./components/schedule.js";
import { renderWeather } from "./components/weather.js";

const MODULE_LABEL = { assign: "Tugas", quiz: "Kuis", forum: "Forum" };

const emptyState = (message) => el("p", "empty-state", message);

const formatShort = (dateString) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));

const sourceTag = (source) =>
  el("span", `source-tag ${source.toLowerCase()}`, source);

/** Format tanggal seperti di Simponi: "09 October 2026 | 13:10" */
function formatPosted(iso) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
  return `${date} | ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ---------- SPON (Moodle): tugas & kuis ---------- */
function renderTasks(spon) {
  const list = $("#dashboardTaskList");
  list.replaceChildren();
  const pending = spon.events
    .filter((e) => !e.isDone)
    .sort((a, b) => a.timesort - b.timesort);

  $("#statTasks").textContent = String(pending.length);
  $("#statTasksMeta").textContent =
    `${pending.filter((e) => daysFromToday(toISO(new Date(e.timesort * 1000))) <= 3).length} jatuh tempo ≤ 3 hari`;

  if (pending.length === 0) {
    list.append(emptyState("Semua tugas sudah selesai."));
    return;
  }

  pending.slice(0, 5).forEach((e) => {
    const due = new Date(e.timesort * 1000);
    const days = daysFromToday(toISO(due));
    const when = new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(due);

    const row = el("div", "compact-task");
    row.append(el("span", "task-marker"));
    const body = el("div");
    body.append(
      el("strong", "", e.name),
      el(
        "small",
        "",
        `${e.course.fullname} · ${MODULE_LABEL[e.modulename] || "Aktivitas"} · ${when}, ${pad2(due.getHours())}:${pad2(due.getMinutes())}`,
      ),
    );
    row.append(
      body,
      el("span", `urgency-badge ${urgencyClass(days)}`, relativeLabel(days)),
      sourceTag("SPON"),
    );
    list.append(row);
  });
}

/* ---------- Simponi: jadwal ---------- */
function renderSchedule(simponi) {
  const now = new Date();
  const byStart = (a, b) => a.start.localeCompare(b.start);
  const today = simponi.schedule
    .filter((s) => s.day === now.getDay())
    .sort(byStart);
  let message = "Tidak ada kuliah hari ini.";
  if (!today.length) {
    for (let i = 1; i <= 7; i += 1) {
      const day = (now.getDay() + i) % 7;
      const next = simponi.schedule
        .filter((s) => s.day === day)
        .sort(byStart)[0];
      if (next) {
        message += ` Berikutnya: ${DAY_NAMES[day]}, ${next.start} — ${next.course}.`;
        break;
      }
    }
  }
  renderScheduleList(
    $("#scheduleList"),
    today.map((item) => ({
      start: item.start,
      end: item.end,
      title: item.course,
      meta: `${item.room} · ${item.lecturer}`,
    })),
    message,
  );
}

/* ---------- Simponi: kehadiran, SKS, pembayaran ---------- */
function attendanceStats(item) {
  const counted = [...item.marks].filter((m) => m !== "-");
  const present = counted.filter((m) => m === "H").length;
  return {
    present,
    counted: counted.length,
    percent: counted.length
      ? Math.round((present / counted.length) * 1000) / 10
      : 0,
  };
}

function renderAttendance(simponi) {
  const list = $("#attendanceList");
  list.replaceChildren();
  const markClass = { H: "h", I: "i", A: "a", "-": "n" };
  let sum = 0;
  let below = 0;

  simponi.attendance.forEach((item) => {
    const stats = attendanceStats(item);
    sum += stats.percent;
    if (stats.percent < simponi.attendanceMinimum) below += 1;

    const row = el("div", "attendance-row");
    const head = el("div", "attendance-head");
    const name = el("div");
    name.append(
      el("strong", "", item.course),
      el("small", "", `${item.code} · ${item.kelas} · ${item.sks} SKS`),
    );
    head.append(
      name,
      el(
        "span",
        `percent-pill${stats.percent < simponi.attendanceMinimum ? " warn" : ""}`,
        `${stats.percent}%`,
      ),
    );

    const dots = el("div", "meeting-dots");
    [...item.marks].forEach((m, i) => {
      const dot = el("span", `meeting-dot ${markClass[m]}`);
      dot.title = `Pertemuan ${i + 1}: ${m === "-" ? "belum berlangsung" : m}`;
      dots.append(dot);
    });

    row.append(head, dots);
    list.append(row);
  });

  const avg = sum / simponi.attendance.length;
  $("#statAttendance").textContent = `${avg.toFixed(1)}%`;
  $("#attendanceSummary").textContent =
    below === 0
      ? `Semester ${simponi.semester.label} · Semua memenuhi syarat UAS (≥ ${simponi.attendanceMinimum}%)`
      : `Semester ${simponi.semester.label} · ${below} mata kuliah di bawah ${simponi.attendanceMinimum}%`;

  $("#statSks").textContent = `${simponi.sks.passed} / ${simponi.sks.target}`;
  $("#statSksMeta").textContent =
    `${simponi.sks.taken} SKS diambil semester ini`;
}

function renderPayment(simponi) {
  const { payment } = simponi;
  const days = daysFromToday(payment.dueDate);
  $("#statPayment").textContent = rupiah.format(payment.amount);
  $("#statPaymentMeta").textContent =
    `Jatuh tempo ${formatShort(payment.dueDate)}`;

  const banner = $("#paymentBanner");
  banner.replaceChildren();
  banner.hidden = days > 7;
  if (days > 7) return;

  const text = el("div");
  text.append(
    el("strong", "", `${payment.label} — ${relativeLabel(days).toLowerCase()}`),
    el(
      "p",
      "",
      `${rupiah.format(payment.amount)} · ${payment.status}. Data contoh dari Simponi.`,
    ),
  );
  banner.append(el("span", "banner-icon", "!"), text, sourceTag("Simponi"));
}

function renderAnnouncements(spon, simponi) {
  const list = $("#announcementList");
  list.replaceChildren();
  [...simponi.announcements, ...spon.announcements]
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .slice(0, 4)
    .forEach((item) => {
      const row = el("div", "announcement");
      const body = el("div");
      const chips = el("div", "announcement-chips");
      chips.append(
        el("span", "code-chip", item.kelas),
        el("span", "code-chip", item.code),
      );
      body.append(
        chips,
        el("strong", "", `${item.course} — ${item.title}`),
        el("p", "announcement-body", item.body),
        el("small", "", `${item.author} · ${formatPosted(item.postedAt)}`),
      );
      row.append(sourceTag(item.source), body);
      list.append(row);
    });
}

/* ---------- Hari libur ---------- */
function renderHolidays({ source, holidays }) {
  const list = $("#holidayList");
  list.replaceChildren();
  const upcoming = holidays
    .filter((h) => daysFromToday(h.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  $("#holidaySource").textContent =
    source === "api" ? "Libur nasional" : "Data cadangan";

  if (upcoming.length === 0) {
    list.append(emptyState("Tidak ada hari libur nasional yang akan datang."));
    return;
  }

  upcoming.forEach((holiday) => {
    const date = new Date(`${holiday.date}T00:00:00`);
    const row = el("div", "holiday-item");
    const badge = el("div", "holiday-date");
    badge.append(
      el("strong", "", String(date.getDate())),
      el(
        "small",
        "",
        new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date),
      ),
    );
    const body = el("div");
    body.append(
      el("strong", "", holiday.name),
      el(
        "small",
        "",
        `${DAY_NAMES[date.getDay()]} · ${relativeLabel(daysFromToday(holiday.date)).toLowerCase()}`,
      ),
    );
    row.append(badge, body);
    list.append(row);
  });

  if (source === "fallback") {
    list.append(
      el(
        "p",
        "helper-text",
        "API hari libur tidak dapat dijangkau. Hanya libur bertanggal tetap yang ditampilkan.",
      ),
    );
  }
}

/* ---------- Init ---------- */
const failPanel = (selector, message) =>
  $(selector).replaceChildren(emptyState(message));
const state = { spon: null, simponi: null, holidays: [] };
let calendar;

function refreshCalendar() {
  if (!calendar) calendar = createCalendar($("#academicCalendar"));
  calendar.setEvents(buildEvents(state));
}

export async function initDashboard() {
  await Promise.all([
    Promise.all([getSponDashboard(), getSimponiDashboard()])
      .then(([spon, simponi]) => {
        state.spon = spon;
        state.simponi = simponi;
        renderTasks(spon);
        renderSchedule(simponi);
        renderAttendance(simponi);
        renderPayment(simponi);
        renderAnnouncements(spon, simponi);
        refreshCalendar();
      })
      .catch((error) => {
        console.warn("Data SPON/Simponi gagal dimuat:", error);
        [
          "#dashboardTaskList",
          "#scheduleList",
          "#attendanceList",
          "#announcementList",
        ].forEach((s) => failPanel(s, "Data tidak dapat dimuat."));
      }),
    getWeather()
      .then((data) =>
        renderWeather(data, $("#weatherNow"), $("#weatherForecast")),
      )
      .catch((error) => {
        console.warn("Cuaca gagal dimuat:", error);
        failPanel(
          "#weatherNow",
          "Cuaca tidak dapat dimuat. Periksa koneksi internet.",
        );
        $("#weatherForecast").replaceChildren();
      }),
    getHolidays().then((result) => {
      renderHolidays(result);
      state.holidays = result.holidays;
      refreshCalendar();
    }),
  ]);

  setInterval(async () => renderSchedule(await getSimponiDashboard()), 60000);
}
