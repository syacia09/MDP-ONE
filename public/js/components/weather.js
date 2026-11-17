import { el } from '../lib/dom.js';

/* ---------- Cuaca ---------- */
const WEATHER_CODES = [
  { codes: [0], label: 'Cerah', icon: '☀️' },
  { codes: [1, 2], label: 'Cerah berawan', icon: '⛅' },
  { codes: [3], label: 'Berawan', icon: '☁️' },
  { codes: [45, 48], label: 'Berkabut', icon: '🌫️' },
  { codes: [51, 53, 55, 56, 57], label: 'Gerimis', icon: '🌦️' },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: 'Hujan', icon: '🌧️' },
  { codes: [95, 96, 99], label: 'Hujan petir', icon: '⛈️' }
];
const describeWeather = (code) => WEATHER_CODES.find((entry) => entry.codes.includes(code)) || { label: 'Tidak diketahui', icon: '🌡️' };

function weatherAdvice(code, rainChance) {
  if ([95, 96, 99].includes(code)) return 'Ada potensi petir. Hindari berteduh di area terbuka.';
  if (rainChance >= 60 || [61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Bawa payung atau jas hujan ke kampus.';
  if (code === 0 || code === 1) return 'Cuaca mendukung. Jangan lupa membawa air minum.';
  return 'Cuaca relatif aman untuk beraktivitas.';
}

export function renderWeather(data, nowEl, stripEl) {
  const { current, daily } = data;
  const now = describeWeather(current.weather_code);

  const box = nowEl;
  box.replaceChildren();
  const main = el('div', 'weather-main');
  main.append(el('span', 'weather-icon', now.icon));
  const temp = el('div');
  temp.append(el('strong', 'weather-temp', `${Math.round(current.temperature_2m)}°C`), el('small', '', now.label));
  main.append(temp);

  const facts = el('div', 'weather-facts');
  [`Terasa ${Math.round(current.apparent_temperature)}°C`, `Lembap ${current.relative_humidity_2m}%`, `Angin ${Math.round(current.wind_speed_10m)} km/j`]
    .forEach((text) => facts.append(el('span', 'mini-tag', text)));
  box.append(main, facts, el('p', 'weather-advice', weatherAdvice(current.weather_code, daily.precipitation_probability_max[0] ?? 0)));

  const forecast = stripEl;
  forecast.replaceChildren();
  daily.time.forEach((day, i) => {
    const info = describeWeather(daily.weather_code[i]);
    const label = i === 0 ? 'Hari ini' : new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(new Date(`${day}T00:00:00`));
    const cell = el('div', 'forecast-day');
    cell.append(
      el('small', '', label),
      el('span', 'forecast-icon', info.icon),
      el('strong', '', `${Math.round(daily.temperature_2m_max[i])}°`),
      el('small', '', `${Math.round(daily.temperature_2m_min[i])}°`),
      el('small', 'rain-chance', `${daily.precipitation_probability_max[i] ?? 0}%`)
    );
    forecast.append(cell);
  });
}

/** Panel cuaca siap pakai (markup sama dengan dashboard mahasiswa). */
export function createWeatherPanel(fetchWeather) {
  const panel = el('article', 'panel weather-panel');
  const head = el('div', 'panel-heading');
  const title = el('div');
  title.append(el('p', 'eyebrow', 'PALEMBANG'), el('h2', '', 'Cuaca'));
  head.append(title, el('span', 'mini-tag', 'Open-Meteo'));
  const now = el('div');
  now.append(el('p', 'empty-state', 'Memuat cuaca...'));
  const strip = el('div', 'forecast-strip');
  panel.append(head, now, strip);
  fetchWeather().then((data) => renderWeather(data, now, strip)).catch(() => {
    now.replaceChildren(el('p', 'empty-state', 'Cuaca tidak dapat dimuat. Periksa koneksi internet.'));
    strip.replaceChildren();
  });
  return panel;
}