import * as api from './api.js';
import { avatarImg } from './avatar.js';

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x !== undefined) n.textContent = x; return n; };
const hhmm = (s) => new Date(s.replace(' ', 'T')).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/** Chat dua panel (desktop). Semua pesan berasal dari akun pengguna lain lewat MySQL; polling tiap 3 detik. */
export function initChat(
  root,
  user,
  {
    onUnread = () => {},
    onConversations = () => {}
  } = {}
) {
  let peer = null, lastId = 0, convs = [];
  const list = el('aside', 'chat-list');
  const pane = el('section', 'chat-pane');
  root.className = 'chat-layout';
  root.replaceChildren(list, pane);

  const empty = (t) => el('p', 'empty-state', t);
  pane.append(empty('Pilih percakapan, atau mulai dari tab Dosen / Mahasiswa.'));

  function renderList() {
    list.replaceChildren(el('h3', '', 'Percakapan'));
    if (!convs.length) list.append(empty('Belum ada pesan.'));
    convs.forEach((c) => {
      const b = el('button', `chat-row${peer?.id === c.id ? ' active' : ''}`);
      b.type = 'button';
      const body = el('span', 'body');
      body.append(el('strong', '', c.name), el('small', '', `${c.lastFrom === user.id ? 'Kamu: ' : ''}${c.last}`));
      b.append(avatarImg(c, 'sm'), body);
      if (c.online) b.append(el('i', 'online-dot'));
      if (c.unread) b.append(el('span', 'unread-dot', String(c.unread)));
      b.addEventListener('click', () => open(c));
      list.append(b);
    });
  }

  function bubble(m) {
    const mine = m.from === user.id;
    const d = el('div', `bubble ${mine ? 'mine' : 'theirs'}`);
    d.dataset.id = m.id;
    d.append(el('span', '', m.body), el('time', '', hhmm(m.at)));
    return d;
  }

  async function open(p) {
    peer = p; lastId = 0;
    const head = el('header', 'chat-head');
    head.append(avatarImg(p, 'sm'), el('strong', '', p.name));
    const thread = el('div', 'chat-thread'); thread.id = 'chatThread';
    const form = el('form', 'chat-form');
    const input = Object.assign(el('input'), { type: 'text', maxLength: 1000, placeholder: `Tulis pesan untuk ${p.name.split(' ')[0]}…`, autocomplete: 'off', required: true });
    const btn = Object.assign(el('button', 'primary-button', 'Kirim'), { type: 'submit' });
    form.append(input, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      btn.disabled = true;
      try { await api.sendMessage(p.id, text); input.value = ''; await tick(); } catch (err) { alert(err.message); }
      btn.disabled = false; input.focus();
    });
    pane.replaceChildren(head, thread, form);
    renderList();
    await tick(); input.focus();
  }

  async function tick() {
    if (document.hidden) return;
    try {
convs = await api.getConversations();

onUnread(convs.reduce((s, c) => s + c.unread, 0));
onConversations(convs);
      if (peer) {
        const fresh = await api.getMessages(peer.id, lastId);
        const thread = document.getElementById('chatThread');
        if (thread && fresh.length) {
          const stick = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80 || !lastId;
          fresh.forEach((m) => thread.append(bubble(m)));
          lastId = fresh[fresh.length - 1].id;
          if (stick) thread.scrollTop = thread.scrollHeight;
        }
        if (!lastId && thread && !thread.children.length) thread.append(empty('Belum ada pesan. Sapa duluan!'));
      }
      renderList();
    } catch (e) { console.warn('Chat:', e.message); }
  }

  window.addEventListener('open-chat', (e) => open(e.detail));
  const timer = setInterval(tick, 3000);
  tick();
  return { open, tick, stop: () => clearInterval(timer) };
}

/** Dipanggil dari tombol "Chat" pada kartu dosen/mahasiswa. */
export const startChat = (person) => window.dispatchEvent(new CustomEvent('open-chat', { detail: person }));