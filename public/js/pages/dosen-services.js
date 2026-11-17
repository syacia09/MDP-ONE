// import { el } from '../lib/dom.js';
// import { SERVICES_DOSEN } from '../mock-dosen.js';
// import { initCanteen } from '../canteen.js';

// /** Campus Services dosen: katalog layanan per kelompok. Item ber-`go` membuka fitur yang sudah ada. */
// export function initDosenServices(root, { toast, user }) {
//   const heading = el('div', 'page-heading');
//   heading.append(el('p', 'eyebrow', 'CAMPUS SERVICES'), el('h1', '', 'Campus Services'),
//     el('p', 'muted', 'Layanan akademik, kepegawaian, penelitian, dan sarana untuk dosen.'));

//   const layout = el('div', 'two-column-layout');
//   SERVICES_DOSEN.forEach((group, index) => {
//     const panel = el('article', 'panel');
//     const head = el('div', 'panel-heading');
//     const title = el('div');
//     title.append(el('p', 'eyebrow', group.eyebrow), el('h2', '', group.title));
//     head.append(title);
//     const list = el('div', 'gateway-list');
//     group.items.forEach((item) => {
//       const row = el('div', 'gateway-item');
//       row.dataset.service = item.id;
//       if (item.go) row.dataset.go = item.go;
//       const info = el('div');
//       info.append(el('strong', '', item.name), el('small', '', item.desc));
//       row.append(el('span', `gateway-logo ${index % 2 ? 'simponi' : 'spon'}`, item.name[0]), info,
//         el('span', item.go ? 'mini-tag' : 'planned-tag', item.go ? 'Buka' : 'Rancangan'));
//       list.append(row);
//     });
//     panel.append(head, list);
//     layout.append(panel);
//   });

//   const banner = el('div', 'info-banner');
//   const text = el('div');
//   text.append(el('strong', '', 'Sebagian layanan masih berupa rancangan.'),
//     el('p', '', 'Integrasi dengan sistem kepegawaian, LPPM, dan sarana kampus memerlukan koordinasi dengan pengelolanya.'));
//   banner.append(el('span', 'banner-icon', 'i'), text);

//   const canteen = el('section', 'dosen-canteen');
//   const canteenHead = el('div', 'page-heading');
//   canteenHead.append(el('p', 'eyebrow', 'KANTIN'), el('h2', '', 'Kantin kampus'), el('p', 'muted', 'Reservasi makanan dan minuman, lalu bayar di kasir tenant.'));
//   const canteenHost = el('div');
//   canteen.append(canteenHead, canteenHost);

//   root.replaceChildren(heading, canteen, layout, banner);
//   initCanteen(canteenHost, user);
//   root.addEventListener('click', (e) => {
//     const row = e.target.closest('[data-service]');
//     if (row && !row.dataset.go) toast(`${row.querySelector('strong').textContent}: modul masih berupa rancangan.`);
//   });
// }\
import { el } from '../lib/dom.js';
import { initCanteen } from '../canteen.js';

/** Campus Services dosen: hanya kantin kampus. */
export function initDosenServices(root, { user }) {
  const heading = el('div', 'page-heading');
  heading.append(el('p', 'eyebrow', 'CAMPUS SERVICES'), el('h1', '', 'Campus Services'),
    el('p', 'muted', 'Reservasi makanan dan minuman di kantin kampus, lalu bayar di kasir tenant.'));
  const host = el('div', 'dosen-canteen');
  root.replaceChildren(heading, host);
  initCanteen(host, user);
}