import * as api from "./api.js";
import { avatarImg, avatarUrl, fileToAvatar } from "./avatar.js";

const el = (t, c, x) => {
  const n = document.createElement(t);
  if (c) n.className = c;
  if (x !== undefined) n.textContent = x;
  return n;
};
const csv = (s) =>
  String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function dataUrlToBlob(dataUrl) {
  // fetch(data:) diblokir CSP, jadi diubah manual
  const [head, b64] = dataUrl.split(",");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: head.match(/:(.*?);/)[1] });
}

const field = (label, node, hint) => {
  const w = el("label", "pf-field");
  w.append(el("span", "pf-label", label), node);
  if (hint) w.append(el("small", "pf-hint", hint));
  return w;
};
const textInput = (value, placeholder, extra = {}) =>
  Object.assign(el("input"), {
    type: "text",
    value: value ?? "",
    placeholder: placeholder || "",
    maxLength: 200,
    ...extra,
  });
const textArea = (value, placeholder, rows = 4, max = 2000) =>
  Object.assign(el("textarea"), {
    value: value ?? "",
    placeholder,
    rows,
    maxLength: max,
  });
const check = (label, checked) => {
  const w = el("label", "pf-check");
  const cb = Object.assign(el("input"), { type: "checkbox", checked });
  w.append(cb, el("span", "", label));
  return { node: w, cb };
};

/** Daftar baris yang bisa ditambah/dihapus (lomba, proyek, publikasi, dsb.). */
function repeater(title, items, cols, addLabel) {
  const wrap = el("section", "pf-sec");
  wrap.append(el("h4", "", title));
  const list = el("div", "pf-rows");
  wrap.append(list);
  const addRow = (item = {}) => {
    const row = el("div", "pf-row");
    const inputs = {};
    cols.forEach((c) => {
      const i = textInput(item[c.key] ?? "", c.ph, {
        type: c.type || "text",
        maxLength: c.max || 200,
      });
      if (c.type === "number") {
        i.min = 1900;
        i.max = 2100;
      }
      i.setAttribute("aria-label", c.ph);
      i.style.flex = c.flex || "2 1 160px";
      inputs[c.key] = i;
      row.append(i);
    });
    const del = Object.assign(el("button", "pf-del", "×"), { type: "button" });
    del.setAttribute("aria-label", "Hapus baris");
    del.addEventListener("click", () => row.remove());
    row.append(del);
    row._inputs = inputs;
    list.append(row);
  };
  (items || []).forEach(addRow);
  const add = Object.assign(el("button", "pf-add", `＋ ${addLabel}`), {
    type: "button",
  });
  add.addEventListener("click", () => {
    addRow();
    list.lastElementChild.querySelector("input").focus();
  });
  wrap.append(add);
  wrap.read = () =>
    [...list.children]
      .map((r) =>
        Object.fromEntries(
          Object.entries(r._inputs).map(([k, i]) => [
            k,
            i.type === "number" ? Number(i.value) || null : i.value.trim(),
          ]),
        ),
      )
      .filter((o) => Object.values(o).some(Boolean));
  return wrap;
}

/** Editor profil untuk dosen dan mahasiswa. onSaved dipanggil setelah berhasil menyimpan. */
export async function openProfileEditor({
  toast = () => {},
  onSaved = () => {},
} = {}) {
  let me;
  try {
    me = await api.getMyProfile();
  } catch (e) {
    toast(e.message);
    return;
  }
  const isDosen = me.role === "dosen";

  const overlay = el("div", "dir-modal");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Edit profil");
  const form = el("form", "dir-modal-box pf-box");
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };

  const head = el("div", "dir-modal-head");
  const titleBox = el("div");
  titleBox.append(
    el("strong", "", "Edit profil"),
    el("small", "", `${me.name} · ${isDosen ? "Dosen" : "Mahasiswa"}`),
  );
  const x = Object.assign(el("button", "dir-modal-close", "×"), {
    type: "button",
  });
  x.setAttribute("aria-label", "Tutup");
  x.addEventListener("click", close);
  head.append(titleBox, x);

  const body = el("div", "pf-body");

  /* Foto */
  let newBlob = null,
    removePhoto = false;
  const preview = avatarImg(me, "big");
  const fileInput = Object.assign(el("input"), {
    type: "file",
    accept: "image/jpeg,image/png,image/webp",
    hidden: true,
  });
  const pick = Object.assign(el("button", "secondary-button", "Ganti foto"), {
    type: "button",
  });
  const drop = Object.assign(el("button", "secondary-button", "Hapus foto"), {
    type: "button",
  });
  pick.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try {
      const url = await fileToAvatar(f, 320);
      preview.src = url;
      newBlob = dataUrlToBlob(url);
      removePhoto = false;
    } catch (e) {
      toast(e.message);
    }
  });
  drop.addEventListener("click", () => {
    newBlob = null;
    removePhoto = true;
    preview.src = avatarUrl({ ...me, photo_url: null });
  });
  const photoRow = el("div", "pf-photo");
  const photoBtns = el("div", "pf-photo-btns");
  photoBtns.append(
    pick,
    drop,
    el("small", "pf-hint", "JPG/PNG/WEBP. Foto dipotong persegi otomatis."),
  );
  photoRow.append(preview, photoBtns, fileInput);
  body.append(photoRow);

  /* Umum */
  const headline = textInput(
    me.headline,
    isDosen
      ? "Contoh: Machine Learning & Computer Vision"
      : "Contoh: UI/UX designer · riset pengguna",
    { maxLength: 160 },
  );
  const about = textArea(
    me.about,
    isDosen
      ? "Ceritakan bidang riset dan minat Anda saat ini…"
      : "Ceritakan dirimu, pengalaman, dan apa yang sedang kamu cari…",
  );
  body.append(
    field("Headline (satu kalimat)", headline),
    field("Tentang", about),
  );

  let read;
  if (isDosen) {
    const title = textInput(me.title, "Contoh: Dosen Tetap · Informatika", {
      maxLength: 120,
    });
    const email = textInput(me.email, "nama@kampus.ac.id", {
      type: "email",
      maxLength: 120,
    });
    const expertise = textInput(
      (me.expertise || []).join(", "),
      "Machine Learning, Computer Vision",
    );
    const courses = textInput(
      (me.courses || []).join(", "),
      "Kecerdasan Buatan, Pembelajaran Mesin",
    );
    const pubs = repeater(
      "Riset & publikasi",
      me.publications,
      [
        {
          key: "title",
          ph: "Judul riset / publikasi",
          max: 200,
          flex: "4 1 240px",
        },
        {
          key: "venue",
          ph: "Jurnal / konferensi",
          max: 150,
          flex: "3 1 180px",
        },
        { key: "year", ph: "Tahun", type: "number", flex: "0 1 90px" },
      ],
      "Tambah riset terbaru",
    );
    body.append(
      field("Jabatan", title),
      field("Email", email),
      field("Keahlian", expertise, "Pisahkan dengan koma"),
      field("Mata kuliah", courses, "Pisahkan dengan koma"),
      pubs,
    );
    read = () => ({
      headline: headline.value,
      about: about.value,
      title: title.value,
      email: email.value,
      expertise: csv(expertise.value),
      courses: csv(courses.value),
      publications: pubs.read(),
    });
  } else {
    const skills = textInput(
      (me.skills || []).join(", "),
      "Figma, Python, HTML/CSS",
    );
    const interests = textInput(
      (me.interests || []).join(", "),
      "UI/UX, Pengembangan Web",
    );
    const open = check(
      "Terbuka untuk kolaborasi / mencari tim",
      me.collaboration !== "closed",
    );
    const pub = check(
      "Tampilkan profil saya di direktori mahasiswa",
      me.isPublic,
    );
    const comps = repeater(
      "Pengalaman lomba",
      me.competitions,
      [
        { key: "title", ph: "Nama lomba", max: 150, flex: "4 1 220px" },
        {
          key: "result",
          ph: "Hasil (Juara 1, Finalis…)",
          max: 80,
          flex: "2 1 150px",
        },
        { key: "year", ph: "Tahun", type: "number", flex: "0 1 90px" },
      ],
      "Tambah lomba",
    );
    const projects = repeater(
      "Proyek",
      me.projects,
      [
        { key: "title", ph: "Nama proyek", max: 120, flex: "2 1 160px" },
        { key: "desc", ph: "Deskripsi singkat", max: 300, flex: "4 1 240px" },
      ],
      "Tambah proyek",
    );
    const certs = repeater(
      "Sertifikasi",
      me.certifications,
      [
        { key: "name", ph: "Nama sertifikat", max: 120, flex: "3 1 200px" },
        { key: "issuer", ph: "Penerbit", max: 100, flex: "2 1 150px" },
      ],
      "Tambah sertifikat",
    );
    body.append(
      field("Skill", skills, "Pisahkan dengan koma"),
      field("Minat", interests, "Pisahkan dengan koma"),
      open.node,
      pub.node,
      comps,
      projects,
      certs,
    );
    read = () => ({
      headline: headline.value,
      about: about.value,
      skills: csv(skills.value),
      interests: csv(interests.value),
      collaboration: open.cb.checked ? "open" : "closed",
      isPublic: pub.cb.checked,
      competitions: comps.read(),
      projects: projects.read(),
      certifications: certs.read(),
    });
  }

  const foot = el("div", "dir-modal-foot");
  const cancel = Object.assign(el("button", "secondary-button", "Batal"), {
    type: "button",
  });
  cancel.addEventListener("click", close);
  const save = Object.assign(el("button", "primary-button", "Simpan"), {
    type: "submit",
  });
  foot.append(cancel, save);
  const msg = el("p", "form-message error");
  msg.setAttribute("role", "status");
  body.append(msg);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    save.disabled = true;
    save.textContent = "Menyimpan…";
    msg.textContent = "";
    try {
      await api.updateProfile(read());
      if (removePhoto) await api.deletePhoto();
      else if (newBlob) await api.uploadPhoto(newBlob);
      await onSaved();
      toast("Profil disimpan.");
      close();
    } catch (err) {
      msg.textContent = err.message;
      save.disabled = false;
      save.textContent = "Simpan";
    }
  });

  form.append(head, body, foot);
  overlay.append(form);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
  headline.focus();
}
