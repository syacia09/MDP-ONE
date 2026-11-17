/**
 * Avatar ilustrasi yang dibuat otomatis dari nama (deterministik, tanpa gambar eksternal),
 * plus pengolah foto unggahan. Dosen digambar berblazer, mahasiswa berkaos.
 * Jika person.photo ada (data URL hasil unggahan), foto itu yang dipakai.
 */
const SKIN = ['#f3d2b3', '#e7b58d', '#d19b6e', '#b57a4f', '#8f5a38'];
const HAIR = ['#17120f', '#2a1d14', '#3d2a1a', '#6b4a2b', '#0f0d0c'];
const STUDENT_BG = [['#cfe3ff', '#8db8f5'], ['#d9f3ec', '#8fd6c3'], ['#efe3ff', '#bda2f0'], ['#ffe9d2', '#f5bd8a'], ['#dff1ff', '#9fd0f2']];
const LECTURER_BG = [['#e4defa', '#9a8de0'], ['#dbe3f2', '#8197c4'], ['#efe6cf', '#d6bb7a']];
const SHIRT = ['#2563c9', '#14867a', '#7856c8', '#d98233', '#c4475a', '#3b4a63'];
const BLAZER = ['#232a4a', '#2f3b52', '#3a2f4d', '#1f3a3a'];
const TIE = ['#b4472f', '#d9a441', '#3c6fb5', '#6b2d5c'];

function hash(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function seeded(seed) {
  let s = seed || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export const roleOf = (person) => (person?.role === 'dosen' || person?.role === 'mahasiswa' ? person.role : person && person.expertise ? 'dosen' : 'mahasiswa');

const cache = new Map();

function buildSvg(name, role) {
  const rand = seeded(hash(`${role}:${name}`));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const skin = pick(SKIN);
  const hair = pick(HAIR);
  const [bg1, bg2] = pick(role === 'dosen' ? LECTURER_BG : STUDENT_BG);
  const style = pick(['short', 'side', 'long', 'bun', 'curly']);
  const glasses = rand() < (role === 'dosen' ? 0.55 : 0.3);
  const id = `g${hash(name + role).toString(36)}`;

  const back = style === 'long'
    ? `<path d="M34 56C30 24 48 14 60 14C74 14 90 24 86 56L90 100L30 100Z" fill="${hair}"/>`
    : style === 'bun' ? `<circle cx="60" cy="16" r="10" fill="${hair}"/>` : '';

  const front = {
    short: `<path d="M38 52C34 28 50 20 61 20C76 20 88 30 82 52C80 42 74 36 60 36C48 36 41 42 38 52Z" fill="${hair}"/>`,
    bun: `<path d="M38 52C34 28 50 20 61 20C76 20 88 30 82 52C80 42 74 36 60 36C48 36 41 42 38 52Z" fill="${hair}"/>`,
    side: `<path d="M38 54C34 26 52 18 62 18C78 18 88 32 82 52C74 40 56 34 44 38C41 42 39 48 38 54Z" fill="${hair}"/>`,
    long: `<path d="M38 52C38 30 52 22 62 22C76 22 84 32 82 52C74 42 66 36 58 34C50 38 42 42 38 52Z" fill="${hair}"/>`,
    curly: [[42, 34], [52, 26], [64, 24], [75, 29], [82, 40], [38, 44], [84, 50]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${hair}"/>`).join('')
  }[style];

  let clothes;
  if (role === 'dosen') {
    const blazer = pick(BLAZER);
    const tie = pick(TIE);
    clothes = `<path d="M8 120C8 94 34 86 60 86C86 86 112 94 112 120Z" fill="${blazer}"/>
      <path d="M48 86L60 108L72 86Z" fill="#fff"/>
      <path d="M46 86L56 114L38 120L36 98Z M74 86L64 114L82 120L84 98Z" fill="rgba(255,255,255,.12)"/>
      ${rand() < 0.6 ? `<path d="M58 94H62L64 112L60 118L56 112Z" fill="${tie}"/>` : ''}`;
  } else {
    clothes = `<path d="M8 120C8 94 34 86 60 86C86 86 112 94 112 120Z" fill="${pick(SHIRT)}"/>
      <path d="M47 87Q60 102 73 87Z" fill="rgba(0,0,0,.2)"/>`;
  }

  const eyes = glasses
    ? `<g fill="rgba(255,255,255,.35)" stroke="#2b2f3a" stroke-width="1.8"><circle cx="51" cy="54" r="7"/><circle cx="69" cy="54" r="7"/><path d="M58 54H62" fill="none"/></g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
    <rect width="120" height="120" fill="url(#${id})"/>
    ${back}
    <rect x="51" y="70" width="18" height="22" rx="8" fill="${skin}"/>
    <rect x="51" y="70" width="18" height="22" rx="8" fill="rgba(0,0,0,.14)"/>
    ${clothes}
    <circle cx="39" cy="54" r="4" fill="${skin}"/><circle cx="81" cy="54" r="4" fill="${skin}"/>
    <ellipse cx="60" cy="52" rx="21" ry="25" fill="${skin}"/>
    ${front}
    <circle cx="51" cy="54" r="2.3" fill="#2a2220"/><circle cx="69" cy="54" r="2.3" fill="#2a2220"/>
    <path d="M46 48Q51 45 56 48M64 48Q69 45 74 48" stroke="${hair}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M60 56Q57 62 61 62" stroke="rgba(0,0,0,.22)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M52 66Q60 72 68 66" stroke="#9a4a3c" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${eyes}
  </svg>`;
}

/** URL gambar avatar: foto unggahan jika ada, selain itu ilustrasi otomatis. */
export function avatarUrl(person) {
  const photo = person?.photo || person?.photo_url;
  if (photo) return photo;
  const role = roleOf(person);
  const key = `${role}:${person?.name || '?'}`;
  if (!cache.has(key)) cache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSvg(person?.name || '?', role))}`);
  return cache.get(key);
}

export function avatarImg(person, extra = '') {
  const img = document.createElement('img');
  img.className = `avatar-img ${roleOf(person)} ${extra}`.trim();
  img.src = avatarUrl(person);
  img.alt = '';
  return img;
}

/** Potong persegi dari tengah, kecilkan ke 256px, simpan sebagai JPEG data URL. */
export function fileToAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('File harus berupa gambar.')); return; }
    if (file.size > 8 * 1024 * 1024) { reject(new Error('Ukuran foto maksimal 8 MB.')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak dapat dibaca.')); };
    img.src = url;
  });
}