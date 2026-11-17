import { el } from '../lib/dom.js';

/** Konfigurasi menu sidebar (satu sumber untuk markup dan label halaman). */
export const NAV_ITEMS = [
  { page: 'dashboard', icon: '▦', label: 'Dashboard' },
  { page: 'connection', icon: '♧', label: 'Campus Connection', badgeId: 'navChatBadge' },
  { page: 'services', icon: '⌂', label: 'Campus Services' }
];

export const PAGE_LABELS = Object.fromEntries(NAV_ITEMS.map((item) => [item.page, item.label]));

/** Markup identik dengan versi statis sebelumnya. */
export function renderNav(nav, items = NAV_ITEMS) {
  nav.replaceChildren(...items.map((item, index) => {
    const button = Object.assign(el('button', `nav-link${index === 0 ? ' active' : ''}`), { type: 'button' });
    button.dataset.page = item.page;
    button.append(el('span', '', item.icon), ` ${item.label}`);
    if (item.badgeId) button.append(' ', Object.assign(el('em', 'nav-badge', '0'), { id: item.badgeId, hidden: true }));
    return button;
  }));
}