import * as api from "./api.js";

const rp = (v) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
const STATUS = {
  reserved: "Menunggu tenant",
  preparing: "Sedang disiapkan",
  ready: "Siap diambil",
  done: "Selesai",
  cancelled: "Dibatalkan",
};
const PROGRESS = {
  reserved: 25,
  preparing: 55,
  ready: 85,
  done: 100,
  cancelled: 0,
};
const CATS = ["Semua", "Makanan berat", "Mie", "Camilan", "Minuman"];

export async function initCanteen(root, user) {
  let tenants = [],
    cart = [],
    orders = [],
    cat = "Semua",
    text = "",
    selected = null,
    onlyOpen = false,
    sort = "default",
    maxPrice = 0;
  try {
    tenants = await api.getCanteen();
  } catch (e) {
    root.textContent = e.message;
    return;
  }
  const menus = () =>
    tenants.flatMap((t) =>
      t.menus.filter((m) => m.available).map((m) => ({ ...m, tenant: t })),
    );
  const find = (id) => menus().find((m) => m.id === Number(id));
  const art = (x, cls = "") => {
    if (!x.image) return "🍽️";

    // Jika gambar gagal dimuat (404), ganti teksnya menjadi "Gambar Rusak" agar kita tahu
    return `<img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy" class="${cls}" onerror="this.outerHTML='<div style=\\'display:grid;place-items:center;height:100%;width:100%;background:#ffeded;color:#c34444;font-size:10px;font-weight:bold;text-align:center;padding:10px;\\'>Foto tidak ditemukan:<br>${x.image}</div>';">`;
  };
  const total = () => cart.reduce((s, i) => s + i.price * i.qty, 0);
  let toastT;
  const toast = (m) => {
    const t = root.querySelector(".canteen-toast");
    t.textContent = m;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2800);
  };

  root.innerHTML = `<div class="canteen-app">
    <section class="canteen-hero"><div class="canteen-hero-content"><p class="eyebrow">MDP ONE • CAMPUS FOOD</p><h2>Perut kenyang, kuliah tenang!</h2>
      <p>Pilih menu, reservasi, lalu ambil &amp; bayar di kasir tanpa antre lama.</p><div class="canteen-points" id="cPoints"></div></div></section>
    <div class="canteen-layout"><div class="canteen-main">
      <section class="canteen-section"><div class="canteen-section-heading"><div><h2>Status tenant</h2><p class="tenant-status-bar" id="cStatus"></p></div></div><div class="tenant-strip" id="cTenants"></div><div id="cFocus"></div></section>
      <section class="canteen-section"><div class="canteen-section-heading"><div><h2>Lagi lapar? Pilih menunya</h2><p>Klik kartu untuk melihat menu tenant.</p></div><span class="filter-count" id="cCount"></span></div>
        <div class="canteen-toolbar filter-bar"><label class="canteen-search"><span>⌕</span><input id="cSearch" type="search" placeholder="Cari makanan, minuman, atau tenant..." aria-label="Cari menu"></label>
          <select id="cCat" class="canteen-chip" aria-label="Kategori">${CATS.map((c) => `<option value="${esc(c)}">${c === "Semua" ? "Semua kategori" : esc(c)}</option>`).join("")}</select>
          <select id="cPrice" class="canteen-chip" aria-label="Harga maksimal"><option value="0">Semua harga</option><option value="10000">≤ Rp10.000</option><option value="15000">≤ Rp15.000</option><option value="20000">≤ Rp20.000</option></select>
          <select id="cSort" class="canteen-chip" aria-label="Urutan"><option value="default">Urutan awal</option><option value="cheap">Termurah</option><option value="exp">Termahal</option></select>
          <button type="button" class="canteen-chip" id="cOpen">Buka saja</button><button type="button" class="canteen-chip" id="cReset">Reset</button></div>
        <div class="food-grid" id="cGrid"></div></section>
    </div><aside class="canteen-side">
      <section class="canteen-section"><div class="canteen-cart" id="cCart"></div></section>
      <section class="canteen-section"><div class="canteen-section-heading"><div><h2>Riwayat reservasi</h2></div></div><div class="order-list" id="cOrders"></div></section>
    </aside></div></div><div class="canteen-toast"></div>`;
  const $ = (s) => root.querySelector(s);
  root.addEventListener(
    "error",
    (e) => {
      if (e.target.tagName === "IMG")
        e.target.replaceWith(
          Object.assign(document.createElement("span"), { textContent: "🍽️" }),
        );
    },
    true,
  );

  const tokensOf = () => text.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (item, t, tokens) => {
    const hay = [item.name, item.desc, t.name, t.category, t.location]
      .join(" ")
      .toLowerCase();
    return tokens.every((k) => hay.includes(k));
  };
  const visibleTenants = () => {
    const tokens = tokensOf();
    return tenants
      .filter(
        (t) =>
          (cat === "Semua" || t.category === cat) &&
          (!onlyOpen || t.open) &&
          (!tokens.length ||
            tokens.every((k) =>
              [t.name, t.category, t.location, ...t.menus.map((m) => m.name)]
                .join(" ")
                .toLowerCase()
                .includes(k),
            )),
      )
      .sort((a, b) => Number(b.open) - Number(a.open));
  };
  const refresh = () => {
    drawFoods();
    drawTenants();
  };

  function drawFoods() {
    $("#cOpen").classList.toggle("active", onlyOpen);
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    let list = menus().filter(
      (m) =>
        (cat === "Semua" || m.tenant.category === cat) &&
        (!onlyOpen || m.tenant.open) &&
        (!maxPrice || m.price <= maxPrice) &&
        matches(m, m.tenant, tokens),
    );
    if (sort === "cheap") list.sort((a, b) => a.price - b.price);
    else if (sort === "exp") list.sort((a, b) => b.price - a.price);
    list.sort((a, b) => Number(b.tenant.open) - Number(a.tenant.open));
    $("#cCount").textContent = `${list.length} menu`;
    $("#cGrid").innerHTML = list.length
      ? list
          .map(
            (m) => `<article class="food-card" data-tenant="${m.tenant.id}">
      <div class="food-card-art">${art(m)}<span class="food-card-badge">${esc(m.tenant.category)}</span><span class="food-card-open ${m.tenant.open ? "" : "closed"}">${m.tenant.open ? "● Buka" : "● Tutup"}</span></div>
      <div class="food-card-body"><h3>${esc(m.name)}</h3><div class="food-tenant">🏪 <b>${esc(m.tenant.name)}</b> · ${esc(m.tenant.location)}</div>
      <div class="food-card-bottom"><b>${rp(m.price)}</b><button type="button" class="add-food-button" data-add="${m.id}" ${m.tenant.open ? "" : "disabled"} aria-label="Tambah ${esc(m.name)}">+</button></div></div></article>`,
          )
          .join("")
      : '<div class="canteen-empty">Menu tidak ditemukan.</div>';
  }
  function drawTenants() {
    const openCount = tenants.filter((t) => t.open).length;
    $("#cStatus").innerHTML =
      `<span class="status-open">● ${openCount} tenant buka</span><span class="status-closed">● ${tenants.length - openCount} tutup</span>`;
    $("#cTenants").innerHTML = visibleTenants()
      .map(
        (
          t,
        ) => `<button type="button" class="tenant-pill ${t.open ? "" : "closed"} ${selected === t.id ? "active" : ""}" data-pill="${t.id}">
      <span class="pill-info"><strong>${esc(t.name)}</strong><small>${esc(t.location)} · ${t.open ? "Buka" : "Tutup"}</small></span></button>`,
      )
      .join("");
    const t = tenants.find((x) => x.id === selected);
    $("#cFocus").innerHTML = !t
      ? ""
      : `<div class="tenant-focus-panel"><div class="tenant-focus-top"><div><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p></div>
      <span class="tenant-status ${t.open ? "open" : "closed"}">${t.open ? "● Sedang buka" : "● Tutup"}</span></div>
      <div class="menu-grid">${t.menus
        .filter((m) => m.available)
        .map(
          (
            m,
          ) => `<article class="menu-item"><div class="menu-food-art">${art(m)}</div><div class="menu-food-info">
      <strong>${esc(m.name)}</strong><small>${esc(m.desc)}</small><div class="menu-food-bottom"><b>${rp(m.price)}</b>
      <button type="button" class="add-food-button" data-add="${m.id}" ${t.open ? "" : "disabled"}>+</button></div></div></article>`,
        )
        .join("")}</div></div>`;
  }
  function drawCart() {
    const box = $("#cCart");
    if (!cart.length) {
      box.innerHTML =
        '<div class="cart-heading"><h2>Pesanan kamu</h2><span class="cart-count">0 item</span></div><div class="canteen-empty">Keranjang masih kosong.</div>';
      return;
    }
    const t = tenants.find((x) => x.id === cart[0].tenantId);
    box.innerHTML = `<div class="cart-heading"><h2>${esc(t?.name)}</h2><span class="cart-count">${cart.reduce((s, i) => s + i.qty, 0)} item</span></div>
      <div class="cart-list">${cart
        .map(
          (
            i,
          ) => `<div class="cart-row"><div><strong>${esc(i.name)}</strong><small>${rp(i.price)}</small></div>
      <div class="cart-quantity"><button type="button" data-minus="${i.menuId}">−</button><span>${i.qty}</span><button type="button" data-plus="${i.menuId}">+</button></div></div>`,
        )
        .join("")}</div>
      <div class="cart-total"><span>Total (bayar di kasir)</span><strong>${rp(total())}</strong></div>
      <form class="canteen-checkout" id="cForm"><label for="cPick">Jadwal pengambilan</label><select id="cPick" required><option value="">Pilih waktu</option>
      ${["Secepatnya", "10 menit lagi", "15 menit lagi", "20 menit lagi", "30 menit lagi"].map((x) => `<option>${x}</option>`).join("")}</select>
      <label for="cNote">Catatan (opsional)</label><input id="cNote" maxlength="100" placeholder="Contoh: sambal dipisah">
      <button class="checkout-button" type="submit">Buat reservasi · ${rp(total())}</button></form>`;
  }
  function drawOrders() {
    const done = orders.filter((o) => o.status === "done").length;
    $("#cPoints").textContent = `⭐ ${done * 5} Canteen Points`;
    $("#cOrders").innerHTML = orders.length
      ? orders
          .map(
            (
              o,
            ) => `<article class="order-card"><div style="display:flex;justify-content:space-between;gap:8px"><strong>${esc(o.tenantName)}</strong><span class="order-status ${o.status === "done" ? "done" : ""}">● ${STATUS[o.status]}</span></div>
      <p>${esc(o.code)} · ${esc(o.pickupTime)}</p><p>${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(", ")}</p><strong>${rp(o.total)}</strong>
      <div class="order-progress"><span class="${o.status === "done" ? "done" : ""}" style="width:${PROGRESS[o.status]}%"></span></div>
      ${o.status === "reserved" ? `<div class="order-actions"><button type="button" data-cancel="${o.id}">Batalkan</button></div>` : ""}</article>`,
          )
          .join("")
      : '<div class="canteen-empty">Belum ada reservasi.</div>';
  }
  const loadOrders = async () => {
    if (document.hidden) return;
    try {
      orders = await api.getMyOrders();
      drawOrders();
    } catch {
      /* abaikan */
    }
  };

  function add(id) {
    const m = find(id);
    if (!m || !m.tenant.open) return toast("Tenant sedang tutup.");
    if (cart.length && cart[0].tenantId !== m.tenant.id) {
      if (
        !confirm(
          "Keranjang berasal dari tenant lain. Kosongkan dan pesan dari tenant ini?",
        )
      )
        return;
      cart = [];
    }
    const row = cart.find((i) => i.menuId === m.id);
    if (row) row.qty += 1;
    else
      cart.push({
        menuId: m.id,
        tenantId: m.tenant.id,
        name: m.name,
        price: m.price,
        qty: 1,
      });
    drawCart();
    toast(`${m.name} ditambahkan.`);
  }

  root.addEventListener("click", async (e) => {
    const t = e.target;
    const a = t.closest("[data-add]");
    if (a) return add(a.dataset.add);
    const mi = t.closest("[data-minus]"),
      pl = t.closest("[data-plus]");
    if (mi || pl) {
      const id = Number((mi || pl).dataset.minus || (mi || pl).dataset.plus);
      const r = cart.find((i) => i.menuId === id);
      r.qty += mi ? -1 : 1;
      cart = cart.filter((i) => i.qty > 0);
      return drawCart();
    }
    if (t.closest("#cOpen")) {
      onlyOpen = !onlyOpen;
      return refresh();
    }
    if (t.closest("#cReset")) {
      text = "";
      cat = "Semua";
      maxPrice = 0;
      sort = "default";
      onlyOpen = false;
      $("#cSearch").value = "";
      $("#cCat").value = "Semua";
      $("#cPrice").value = "0";
      $("#cSort").value = "default";
      return refresh();
    }
    const p = t.closest("[data-pill]");
    if (p) {
      selected = Number(p.dataset.pill);
      return drawTenants();
    }
    const cancel = t.closest("[data-cancel]");
    if (cancel && confirm("Batalkan reservasi ini?")) {
      try {
        await api.setOrderStatus(cancel.dataset.cancel, "cancelled");
        loadOrders();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    const card = t.closest(".food-card");
    if (card) {
      selected = Number(card.dataset.tenant);
      drawTenants();
      $("#cTenants").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  root.addEventListener("input", (e) => {
    if (e.target.id === "cSearch") {
      text = e.target.value.trim();
      refresh();
    }
  });
  root.addEventListener("change", (e) => {
    const v = e.target.value;
    if (e.target.id === "cSort") sort = v;
    else if (e.target.id === "cCat") cat = v;
    else if (e.target.id === "cPrice") maxPrice = Number(v);
    else return;
    refresh();
  });
  root.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = await api.createOrder({
        items: cart.map((i) => ({ menuId: i.menuId, quantity: i.qty })),
        pickupTime: $("#cPick").value,
        note: $("#cNote").value,
      });
      cart = [];
      drawCart();
      await loadOrders();
      toast(`Reservasi ${r.code} dibuat. Bayar di kasir saat mengambil.`);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });

  drawFoods();
  drawTenants();
  drawCart();
  loadOrders();
  setInterval(loadOrders, 8000);
}
