import * as api from './api.js';
import { avatarImg } from './avatar.js';
import { startChat } from './chat.js';

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x !== undefined) n.textContent = x; return n; };
const chips = (list) => { const d = el('div', 'chips'); (list || []).forEach((x) => d.append(el('span', 'chip', x))); return d; };
const section = (title, node) => { const s = el('div', 'detail-sec'); s.append(el('h4', '', title), node); return s; };
const lines = (items) => { const u = el('ul', 'detail-list'); items.forEach((t) => u.append(el('li', '', t))); return u; };
const when = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

/** Campus Connection: direktori dosen/mahasiswa (dengan profil lengkap), cari tim, dan chat. Semua dari MySQL. */
export function initConnection({ root, chatRoot, getUser, toast }) {
  function detail(p) {
    const d = el('div', 'dir-detail');
    if (p.role === 'dosen') {
      d.append(el('p', '', p.about || ''), section('Keahlian', chips(p.expertise)), section('Mata kuliah', chips(p.courses)),
        section('Publikasi', lines((p.publications || []).map((x) => `${x.title} — ${x.venue} (${x.year})`))), el('small', '', `✉ ${p.email || '-'}`));
    } else {
      d.append(el('p', '', p.about || ''), section('Skill', chips(p.skills)), section('Minat', chips(p.interests)));
      if (p.competitions?.length) d.append(section('Lomba', lines(p.competitions.map((x) => `${x.title} — ${x.result} (${x.year})`))));
      if (p.projects?.length) d.append(section('Proyek', lines(p.projects.map((x) => `${x.title}: ${x.desc}`))));
      if (p.certifications?.length) d.append(section('Sertifikasi', lines(p.certifications.map((x) => `${x.name} — ${x.issuer}`))));
      d.append(el('small', '', p.collaboration === 'open' ? '🟢 Terbuka untuk kolaborasi' : '⚪ Sedang tidak mencari tim'));
    }
    return d;
  }

  /* ---------- Modal detail profil ---------- */
  let modal;
  function closeModal() { modal?.remove(); modal = null; document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') closeModal(); }
  function openModal(p) {
    closeModal();
    modal = el('div', 'dir-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', `Profil ${p.name}`);
    const box = el('div', 'dir-modal-box');
    const head = el('div', 'dir-modal-head');
    const info = el('div');
    info.append(el('strong', '', p.name), el('small', '', p.role === 'dosen' ? p.title || 'Dosen' : `${p.prodi || ''} · Angkatan ${p.angkatan || '-'}`));
    if (p.headline) info.append(el('small', '', p.headline));
    const close = Object.assign(el('button', 'dir-modal-close', '×'), { type: 'button' });
    close.setAttribute('aria-label', 'Tutup');
    close.addEventListener('click', closeModal);
    head.append(avatarImg(p), info, close);
    const body = detail(p); body.hidden = false; body.classList.add('dir-modal-body');
    const foot = el('div', 'dir-modal-foot');
    const chat = Object.assign(el('button', 'primary-button', 'Chat'), { type: 'button' });
    chat.addEventListener('click', () => { closeModal(); startChat(p); });
    foot.append(chat);
    box.append(head, body, foot);
    modal.append(box);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', onKey);
    document.body.append(modal);
    chat.focus();
  }

  const MAX_CHIPS = 3;
  function chipRow(list) {
    const d = el('div', 'chips dir-chips');
    const items = list || [];
    items.slice(0, MAX_CHIPS).forEach((x) => d.append(el('span', 'chip', x)));
    if (items.length > MAX_CHIPS) d.append(el('span', 'chip chip-more', `+${items.length - MAX_CHIPS}`));
    return d;
  }

  let searchTimer;
  async function directory(role, q = '') {
    const isDosen = role === 'dosen';
    const haystack = (p) => [p.name, p.headline, p.about, p.prodi, p.title, ...(p.skills || []), ...(p.interests || []), ...(p.expertise || []), ...(p.courses || [])].join(' ').toLowerCase();
    const search = Object.assign(el('input', 'dir-search'), { type: 'search', value: q, placeholder: isDosen ? 'Cari nama, keahlian, atau mata kuliah…' : 'Cari nama, skill, minat, atau prodi…' });
    search.setAttribute('aria-label', 'Cari');
    const skillSel = el('select'); skillSel.setAttribute('aria-label', isDosen ? 'Keahlian' : 'Skill');
    const prodiSel = el('select'); prodiSel.setAttribute('aria-label', 'Prodi');
    const openBtn = Object.assign(el('button', 'filter-toggle', 'Terbuka kolaborasi'), { type: 'button' });
    const reset = Object.assign(el('button', 'filter-reset', 'Reset'), { type: 'button' });
    const count = el('span', 'filter-count');
    const bar = el('div', 'filter-bar');
    bar.append(search, skillSel, prodiSel, ...(isDosen ? [] : [openBtn]), reset, count);
    const grid = el('div', 'dir-grid');
    root.replaceChildren(bar, grid);
    let all = null, onlyOpen = false;
    const fill = (sel, label, values) => sel.replaceChildren(Object.assign(el('option'), { value: '', textContent: label }),
      ...[...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((v) => Object.assign(el('option'), { value: v, textContent: v })));
    const match = (p) => {
      if (p.id === getUser().id) return false;
      const tokens = search.value.toLowerCase().split(/\s+/).filter(Boolean);
      const tags = (isDosen ? p.expertise : p.skills) || [];
      return tokens.every((t) => haystack(p).includes(t)) && (!skillSel.value || tags.includes(skillSel.value))
        && (!prodiSel.value || (p.prodi || '') === prodiSel.value) && (!onlyOpen || p.collaboration === 'open');
    };

    async function load() {
      let people;
      try { people = all ??= await api.getPeople(role, ''); } catch (e) { grid.replaceChildren(el('p', 'empty-state', e.message)); return; }
      if (!skillSel.options.length) {
        fill(skillSel, isDosen ? 'Semua keahlian' : 'Semua skill', people.flatMap((p) => (isDosen ? p.expertise : p.skills) || []));
        fill(prodiSel, 'Semua prodi', people.map((p) => p.prodi));
      }
      grid.replaceChildren();
      people.filter(match).forEach((p) => {
        const card = el('article', 'dir-card');
        const top = el('div', 'dir-top');
        const info = el('div');
        info.append(el('strong', '', p.name),
          el('small', '', role === 'dosen' ? p.title || 'Dosen' : `${p.prodi || ''} · Angkatan ${p.angkatan || '-'}`));
        top.append(avatarImg(p), info);
        if (p.online) top.append(el('span', 'online-dot'));

        const summary = p.headline || p.about || '';
        const tags = role === 'dosen' ? p.expertise : p.skills;
        const body = el('div', 'dir-summary');
        if (summary) body.append(el('p', 'dir-clamp', summary));
        body.append(chipRow(tags));

        const foot = el('div', 'dir-foot');
        const more = Object.assign(el('button', 'dir-more', 'Lihat selengkapnya'), { type: 'button' });
        more.addEventListener('click', () => openModal(p));
        const chat = Object.assign(el('button', 'primary-button', 'Chat'), { type: 'button' });
        chat.addEventListener('click', () => startChat(p));
        foot.append(more, chat);

        card.append(top, body, foot);
        grid.append(card);
      });
      if (!grid.children.length) grid.append(el('p', 'empty-state', 'Tidak ada hasil. Coba kata kunci atau filter lain.'));
      count.textContent = `${grid.querySelectorAll('.dir-card').length} hasil`;
    }
    search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 150); });
    [skillSel, prodiSel].forEach((sel) => sel.addEventListener('change', load));
    openBtn.addEventListener('click', () => { onlyOpen = !onlyOpen; openBtn.classList.toggle('active', onlyOpen); load(); });
    reset.addEventListener('click', () => { search.value = ''; skillSel.value = ''; prodiSel.value = ''; onlyOpen = false; openBtn.classList.remove('active'); load(); });
    await load();
  }

  async function teams() {
    const me = getUser();
    let list;
    try { list = await api.getTeams(); } catch (e) { root.textContent = e.message; return; }
    const wrap = el('div', me.role === 'dosen' ? 'team-wrap team-wrap-dosen' : 'team-wrap');
    if (me.role === 'mahasiswa') {
      const f = el('form', 'team-form');
      const field = (name, ph) => Object.assign(el('input'), { name, placeholder: ph, required: name === 'title' });
      f.append(el('h3', '', 'Buka rekrutmen tim'), field('title', 'Judul lomba / proyek'), field('organizer', 'Penyelenggara'),
        Object.assign(field('deadline', ''), { type: 'date' }), field('roles', 'Peran dicari (pisahkan koma)'), field('skills', 'Skill (pisahkan koma)'),
        Object.assign(el('textarea'), { name: 'description', placeholder: 'Deskripsi singkat', rows: 3 }),
        Object.assign(el('button', 'primary-button', 'Terbitkan'), { type: 'submit' }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await api.createTeam(Object.fromEntries(new FormData(f))); toast('Tim diterbitkan.'); teams(); } catch (err) { toast(err.message); }
      });
      wrap.append(f);
    }
    const grid = el('div', 'team-grid');
    list.forEach((t) => {
      const card = el('article', `team-card${t.closed ? ' closed' : ''}`);
      card.append(el('h3', '', t.title), el('small', '', `${t.organizer || '-'} · Deadline ${when(t.deadline)} · oleh ${t.authorName}`),
        el('p', '', t.description || ''), section('Peran dicari', chips((t.roles || []).map((r) => r.role))), section('Skill', chips(t.skills)),
        el('small', '', `${t.applicants} peminat${t.closed ? ' · DITUTUP' : ''}`));
      if (me.role === 'mahasiswa') {
        const own = t.authorId === me.id;
        const label = own ? (t.closed ? 'Buka lagi' : 'Tutup rekrutmen') : t.closed ? 'Rekrutmen ditutup' : 'Chat untuk bergabung';
        const btn = Object.assign(el('button', 'primary-button', label), { type: 'button', disabled: !own && t.closed });
        btn.addEventListener('click', async () => {
          try {
            if (own) { await api.closeTeam(t.id, !t.closed); teams(); return; }
            if (!t.applied) { try { await api.joinTeam(t.id); t.applied = true; } catch { /* sudah tercatat / ditutup: tetap buka chat */ } }
            // Langsung ke chat dengan pembuat tim. Tidak ada pesan otomatis yang dikirim.
            startChat({ id: t.authorId, name: t.authorName, role: t.authorRole || 'mahasiswa', photo_url: t.authorPhoto });
          } catch (err) { toast(err.message); }
        });
        card.append(btn);
      }
      grid.append(card);
    });
    wrap.append(grid);
    root.replaceChildren(wrap);
  }

  return {
    show(tab) {
      chatRoot.hidden = tab !== 'chat';
      root.hidden = tab === 'chat';
      if (tab === 'lecturers') directory('dosen');
      else if (tab === 'students') directory('mahasiswa');
      else if (tab === 'teams') teams();
    }
  };
}