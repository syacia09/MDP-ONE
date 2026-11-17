import * as api from './api.js';
  import { initDashboard } from './dashboard.js';
  import { initChat, startChat } from './chat.js';
  import { initTenantDashboard } from './tenant.js';
  import { initCanteen } from './canteen.js';
  import { avatarImg } from './avatar.js';
  import { openProfileEditor } from './profile.js';
  import { initConnection } from './connection.js';
import { initDosenDashboard } from './pages/dosen-dashboard.js';
import { initDosenServices } from './pages/dosen-services.js';
import { $, el } from './lib/dom.js';
import { renderNav, PAGE_LABELS } from './components/nav.js';
  let user = null, toastTimer;
  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); };

  const theme = () => localStorage.getItem('mdpTheme') || 'light';
  const applyTheme = () => document.body.classList.toggle('dark', theme() === 'dark');
  $('#themeToggle').addEventListener('click', () => { localStorage.setItem('mdpTheme', theme() === 'dark' ? 'light' : 'dark'); applyTheme(); });
  function showPage(name) {
    const page = PAGE_LABELS[name] ? name : 'dashboard';
    const sectionId = user?.role === 'dosen' && (page === 'dashboard' || page === 'services') ? `dosen-${page}` : page;
    document.querySelectorAll('.page-section').forEach((s) => { const on = s.id === `page-${sectionId}`; s.classList.toggle('active', on); s.hidden = !on; });
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.dataset.page === page));
    $('#currentPageLabel').textContent = PAGE_LABELS[page];
    $('#sidebar').classList.remove('open');
  }
  renderNav($('.main-nav'));
  document.querySelectorAll('.nav-link').forEach((l) => l.addEventListener('click', () => showPage(l.dataset.page)));
  $('#mobileMenuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) showPage(g.dataset.go); });

  async function submitLogin(id, pw) {
    $('#loginMessage').textContent = '';
    try { enterApp(await api.login(id, pw)); } catch (e) { $('#loginMessage').textContent = e.message; }
  }
  $('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); submitLogin($('#loginNpm').value, $('#loginPassword').value); });
  async function doLogout() { try { await api.logout(); } finally { location.reload(); } }
  $('#menuLogout').addEventListener('click', doLogout);
  const closeMenu = () => { $('#userMenu').hidden = true; $('#userButton').setAttribute('aria-expanded', 'false'); };
  $('#userButton').addEventListener('click', () => { const open = $('#userMenu').hidden; $('#userMenu').hidden = !open; $('#userButton').setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', (e) => { if (!$('#userWrap').contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  const fmtDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Belum ditentukan');
  async function refreshTasks() {
    const box = $('#fullTaskList');
    if (!box) return;
    try {
      const tasks = await api.getTasks();
      box.replaceChildren(...(tasks.length ? tasks.map((t) => {
        const row = el('div', `full-task-row${t.isDone ? ' is-done' : ''}`);
        const info = el('div', 'task-info'); info.append(el('strong', '', t.title), el('small', '', `${t.course} · Deadline: ${fmtDate(t.dueDate)}`));
        const done = Object.assign(el('button', 'check-button', t.isDone ? 'Batalkan' : 'Tandai selesai'), { type: 'button' });
        const del = Object.assign(el('button', 'delete-button', 'Hapus'), { type: 'button' });
        done.addEventListener('click', async () => { await api.toggleTask(t.id).catch((e) => toast(e.message)); refreshTasks(); });
        del.addEventListener('click', async () => { if (confirm(`Hapus tugas "${t.title}"?`)) { await api.deleteTask(t.id).catch((e) => toast(e.message)); refreshTasks(); } });
        row.append(info, done, del); return row;
      }) : [el('p', 'empty-state', 'Belum ada tugas.')]));
    } catch (e) { box.textContent = e.message; }
  }
  $('#taskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#taskFormMessage');
    try {
      await api.createTask({ title: $('#taskTitle').value, course: $('#taskCourse').value || 'Umum', dueDate: $('#taskDueDate').value });
      e.target.reset(); msg.textContent = 'Tugas tersimpan.'; msg.classList.remove('error'); refreshTasks();
    } catch (err) { msg.textContent = err.message; msg.classList.add('error'); }
  });
  const conn = initConnection({ root: $('#connRoot'), chatRoot: $('#chatRoot'), getUser: () => user, toast });
  const showTab = (t) => { document.querySelectorAll('.conn-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t)); conn.show(t); };
  /* DROPDOWN PESAN TOPBAR */
const inboxWrap = $('#inboxWrap');
const inboxButton = $('#inboxButton');
const inboxMenu = $('#inboxMenu');
const inboxMenuList = $('#inboxMenuList');
const inboxBadge = $('#inboxBadge');

function renderInbox(conversations) {
  inboxMenuList.replaceChildren();

  if (!conversations.length) {
    inboxMenuList.append(
      el('p', 'empty-state', 'Belum ada percakapan.')
    );
    return;
  }

  conversations.slice(0, 5).forEach((c) => {
    const item = el('button', 'inbox-item');
    item.type = 'button';

    const body = el('span', 'inbox-item-body');
    body.append(
      el('strong', '', c.name),
      el(
        'small',
        '',
        `${c.lastFrom === user.id ? 'Kamu: ' : ''}${c.last || 'Belum ada pesan'}`
      )
    );

    item.append(avatarImg(c, 'sm'), body);

    if (c.unread > 0) {
      item.append(
        el('span', 'inbox-item-unread', String(c.unread))
      );
    }

    item.addEventListener('click', () => {
      inboxMenu.hidden = true;
      inboxButton.setAttribute('aria-expanded', 'false');

      showPage('connection');
      showTab('chat');
      startChat(c);
    });

    inboxMenuList.append(item);
  });
}

inboxButton.addEventListener('click', () => {
  const opening = inboxMenu.hidden;

  inboxMenu.hidden = !opening;
  inboxButton.setAttribute('aria-expanded', String(opening));
});

$('#inboxOpenAll').addEventListener('click', () => {
  inboxMenu.hidden = true;
  inboxButton.setAttribute('aria-expanded', 'false');

  showPage('connection');
  showTab('chat');
});

document.addEventListener('click', (e) => {
  if (!inboxWrap.contains(e.target)) {
    inboxMenu.hidden = true;
    inboxButton.setAttribute('aria-expanded', 'false');
  }
});
  document.querySelectorAll('.conn-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  window.addEventListener('open-chat', () => showTab('chat'));

  /* Avatar di bar atas dan di menu akun (dipanggil saat masuk dan setelah profil/foto diubah) */
  function paintUser() {
    $('#userAvatar').replaceWith(Object.assign(avatarImg(user, 'sm'), { id: 'userAvatar' }));
    $('#userMenuAvatar').replaceWith(Object.assign(avatarImg(user), { id: 'userMenuAvatar' }));
  }
  $('#menuProfile').addEventListener('click', () => {
    closeMenu();
    openProfileEditor({
      toast,
      onSaved: async () => {
        user = await api.me();
        paintUser();
        const active = document.querySelector('.conn-tab.active')?.dataset.tab;
        if (active && active !== 'chat') showTab(active);
      }
    });
  });

  function enterApp(u) {
    user = u;
    $('#loginGate').hidden = true;
    $('#loginPassword').value = '';
    if (u.role === 'tenant') {
      const box = el('main'); const out = Object.assign(el('button', 'primary-button', 'Keluar'), { type: 'button' });
      out.style.cssText = 'position:fixed;top:14px;right:18px'; out.addEventListener('click', doLogout);
      document.body.append(box, out);
      initTenantDashboard(box, u, u.tenantOpen !== false);
      return;
    }
    $('#appShell').hidden = false;
    paintUser();
    $('#userMenuName').textContent = u.name;
    $('#userMenuMeta').textContent = u.role === 'dosen' ? 'Dosen' : `${u.login_id} · ${u.prodi || ''} · Semester ${u.semester || '-'}`;
    $('.user-menu .role-tag').textContent = u.role === 'dosen' ? 'Dosen' : 'Mahasiswa';
    $('#displayName').textContent = u.name.split(' ')[0];
    $('#todayDate').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    inboxWrap.hidden = false;

    initChat($('#chatRoot'), u, {
      onUnread: (n) => {
        inboxBadge.textContent = n;
        inboxBadge.hidden = n === 0;
        ['#chatTabBadge', '#navChatBadge'].forEach((sel) => {
          $(sel).textContent = n;
          $(sel).hidden = n === 0;
        });
      },
      onConversations: (conversations) => renderInbox(conversations)
    });
    showTab(u.role === 'dosen' ? 'students' : 'lecturers');
    if (u.role === 'dosen') {
      initDosenDashboard($('#page-dosen-dashboard'), u, { toast });
      initDosenServices($('#page-dosen-services'), { user: u });
      showPage('dashboard');
      return;
    }
    initDashboard(); refreshTasks(); initCanteen($('#smartCanteenApp'), u);
  }

  applyTheme();
  api.me().then(enterApp).catch(() => {});