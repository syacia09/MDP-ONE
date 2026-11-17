import 'dotenv/config';
import fs from 'fs';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const { DB_HOST = 'localhost', DB_USER = 'root', DB_PASS = '', DB_NAME = 'mdp_one', DEMO_PASSWORD = 'mdp12345' } = process.env;
const c = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASS, multipleStatements: true });
await c.query(fs.readFileSync('schema.sql', 'utf8'));
await c.changeUser({ database: DB_NAME });

const D = JSON.parse(fs.readFileSync('seed-data.json', 'utf8'));
const password_hash = await bcrypt.hash(DEMO_PASSWORD, 10);
const J = (v) => JSON.stringify(v ?? []);
const strip = (list) => (list || []).map(({ id, ...rest }) => rest);
const slug = (s) => s.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const byNpm = {}, accounts = [];
const addUser = async (u) => (await c.query('INSERT INTO users SET ?', [{ password_hash, ...u }]))[0].insertId;

for (const [i, l] of D.lecturers.entries()) {
  const login = '00112233' + String(44 + i).padStart(2, '0');       // dosen pertama = 0011223344
  await addUser({ role: 'dosen', login_id: login, name: l.name, title: l.title, prodi: l.title.split('·')[1]?.trim(), email: l.email,
    headline: l.expertise.slice(0, 3).join(' · '), about: l.interests, expertise: J(l.expertise), courses: J(l.courses), publications: J(l.publications) });
  accounts.push(['dosen', login, l.name]);
}
for (const s of D.students) {
  byNpm[s.npm] = await addUser({ role: 'mahasiswa', login_id: s.npm, name: s.name, prodi: s.prodi, semester: s.semester, angkatan: s.angkatan,
    headline: s.headline, about: s.about, collaboration: s.collaboration, is_public: s.isPublic ? 1 : 0, skills: J(s.skills), interests: J(s.interests),
    competitions: J(strip(s.competitions)), projects: J(strip(s.projects)), certifications: J(strip(s.certifications)) });
  accounts.push(['mahasiswa', s.npm, s.name]);
}
for (const t of D.tenants) {
  const login = slug(t.name);
  const owner = await addUser({ role: 'tenant', login_id: login, name: `Pemilik ${t.name}` });
  const tid = (await c.query('INSERT INTO tenants SET ?', [{ owner_id: owner, name: t.name, category: t.category, location: t.location, description: t.description, is_open: t.open ? 1 : 0 }]))[0].insertId;
  await c.query('INSERT INTO menus (tenant_id,name,description,price) VALUES ?', [t.menus.map((m) => [tid, m.name, m.desc, m.price])]);
  accounts.push(['tenant', login, t.name + (t.open ? '' : ' (tutup)')]);
}
for (const t of D.teams) {
  const tid = (await c.query('INSERT INTO teams SET ?', [{ author_id: byNpm[t.authorNpm], title: t.title, organizer: t.organizer, deadline: t.deadline, description: t.description, roles: J(t.roles), skills: J(t.skills) }]))[0].insertId;
  await c.query('INSERT INTO team_members VALUES (?,?)', [tid, byNpm[t.authorNpm]]);
}
for (const [key, chat] of Object.entries(D.chats))
  for (const m of chat.messages) {
    const to = key.split('|').find((n) => n !== m.from);
    await c.query('INSERT INTO messages (sender_id,receiver_id,body,created_at) VALUES (?,?,?,NOW() - INTERVAL 1 HOUR)', [byNpm[m.from], byNpm[to], m.text]);
  }

console.log(`\nSelesai. Password SEMUA akun: ${DEMO_PASSWORD}\n`);
console.table(accounts.map(([role, id, name]) => ({ role, 'ID login': id, nama: name })));
await c.end();