import * as api from "./api.js";

const el = (tag, cls = "", text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const rp = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const LABEL = {
  reserved: "Baru masuk",
  preparing: "Sedang disiapkan",
  ready: "Siap diambil",
};

const NEXT = {
  reserved: ["preparing", "Mulai siapkan"],
  preparing: ["ready", "Tandai siap"],
  ready: ["done", "Sudah diambil"],
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function button(text, cls = "") {
  const b = el("button", cls, text);
  b.type = "button";
  return b;
}

function input(placeholder, type = "text", value = "") {
  const i = el("input", "tenant-input");
  i.type = type;
  i.placeholder = placeholder;
  i.value = value;
  return i;
}

function sectionTitle(title, desc) {
  const wrap = el("div", "tenant-section-title");
  wrap.append(el("h3", "", title), el("p", "", desc));
  return wrap;
}

function statCard(title, value, icon) {
  const card = el("article", "tenant-stat");
  card.append(
    el("span", "tenant-stat-icon", icon),
    el("small", "", title),
    el("strong", "", value),
  );
  return card;
}

/* =========================
   TENANT DASHBOARD
========================= */

export function initTenantDashboard(root, user, tenantOpen = true) {
  let open = tenantOpen;
  let currentTab = "dashboard";
  let refreshTimer;

  root.replaceChildren();
  root.className = "tenant-dash";

  const header = el("header", "tenant-header");

  const heading = el("div");
  heading.append(
    el("p", "tenant-eyebrow", "PENGELOLAAN KANTIN"),
    el("h2", "", user.name),
    el("p", "tenant-subtitle", "Kelola pesanan dan menu kantinmu."),
  );

  const toggle = button("", "tenant-toggle");
  const paintToggle = () => {
    toggle.textContent = open ? "● Kantin Buka" : "○ Kantin Tutup";
    toggle.classList.toggle("is-open", open);
    toggle.classList.toggle("is-closed", !open);
  };

  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      await api.setTenantOpen(!open);
      open = !open;
      paintToggle();
    } catch (e) {
      alert(e.message);
    } finally {
      toggle.disabled = false;
    }
  });

  paintToggle();
  header.append(heading, toggle);

  const nav = el("nav", "tenant-nav");
  const content = el("main", "tenant-content");

  const tabs = [
    ["dashboard", "Dashboard"],
    ["orders", "Pesanan"],
    ["menus", "Kelola Menu"],
    ["reports", "Laporan"],
  ];

  tabs.forEach(([key, label]) => {
    const b = button(label, "tenant-tab");
    b.dataset.tab = key;
    b.addEventListener("click", () => showTab(key));
    nav.append(b);
  });

  root.append(header, nav, content);

  function setActiveTab(key) {
    nav.querySelectorAll(".tenant-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === key);
    });
  }

  function showTab(key) {
    currentTab = key;
    setActiveTab(key);
    content.replaceChildren();

    if (key === "dashboard") loadDashboard();
    if (key === "orders") loadOrders();
    if (key === "menus") loadMenus();
    if (key === "reports") loadReports();
  }

  /* =========================
     DASHBOARD
  ========================= */

  async function loadDashboard() {
    content.replaceChildren();

    content.append(
      sectionTitle("Ringkasan hari ini", "Pantau aktivitas kantinmu."),
    );

    const stats = el("div", "tenant-stats");
    stats.append(
      statCard("Pesanan aktif", "...", "📦"),
      statCard("Pesanan selesai", "...", "✓"),
      statCard("Pendapatan hari ini", "...", "💰"),
    );

    const refreshButton = button("↻ Perbarui", "tenant-secondary");
    refreshButton.addEventListener("click", loadDashboard);

    content.append(stats, refreshButton);

    try {
      const data = await api.getTenantSummary();
      if (currentTab !== "dashboard") return;

      const cards = stats.querySelectorAll(".tenant-stat strong");
      cards[0].textContent = data.active;
      cards[1].textContent = data.doneToday;
      cards[2].textContent = rp(data.revenueToday);
    } catch (e) {
      stats.append(el("p", "tenant-error", e.message));
    }
  }

  /* =========================
     PESANAN
  ========================= */

  async function loadOrders() {
    content.replaceChildren();
    content.append(
      sectionTitle("Pesanan masuk", "Perbarui status pesanan pelanggan."),
    );

    const board = el("div", "tenant-order-board");
    content.append(board);

    async function refresh() {
      try {
        const orders = await api.getTenantOrders();
        if (currentTab !== "orders") return;

        board.replaceChildren();

        if (!orders.length) {
          board.append(el("p", "tenant-empty", "Belum ada pesanan aktif."));
          return;
        }

        orders.forEach((o) => {
          const card = el("article", `tenant-order-card status-${o.status}`);

          const top = el("div", "tenant-order-top");
          top.append(
            el("strong", "", o.code),
            el("span", "tenant-order-status", LABEL[o.status] || o.status),
          );

          const items = el("div", "tenant-order-items");
          o.items.forEach((i) => {
            items.append(el("p", "", `${i.qty} × ${i.name}`));
          });

          card.append(
            top,
            el("p", "tenant-order-customer", `Pelanggan: ${o.customer}`),
            el("p", "", `Waktu ambil: ${o.pickupTime}`),
            o.note
              ? el("p", "tenant-order-note", `Catatan: ${o.note}`)
              : el("span"),
            items,
            el(
              "strong",
              "tenant-order-total",
              `${rp(o.total)} · Bayar di kasir`,
            ),
          );

          const actions = el("div", "tenant-order-actions");
          const next = NEXT[o.status];

          if (next) {
            const go = button(next[1], "tenant-primary");
            go.addEventListener("click", async () => {
              go.disabled = true;
              try {
                await api.setOrderStatus(o.id, next[0]);
                await refresh();
              } catch (e) {
                alert(e.message);
                go.disabled = false;
              }
            });
            actions.append(go);
          }

          const cancel = button("Batalkan", "tenant-danger");
          cancel.addEventListener("click", async () => {
            if (!confirm(`Batalkan pesanan ${o.code}?`)) return;

            try {
              await api.setOrderStatus(o.id, "cancelled");
              await refresh();
            } catch (e) {
              alert(e.message);
            }
          });

          actions.append(cancel);
          card.append(actions);
          board.append(card);
        });
      } catch (e) {
        board.replaceChildren(el("p", "tenant-error", e.message));
      }
    }

    await refresh();
  }

  /* =========================
     KELOLA MENU
  ========================= */

  async function loadMenus() {
    content.append(
      sectionTitle(
        "Kelola menu",
        "Tambahkan makanan dan minuman yang tersedia di kantinmu.",
      ),
    );

    const form = el("form", "tenant-menu-form");
    const name = input("Nama makanan/minuman");
    const description = el("textarea", "tenant-input");
    description.placeholder = "Deskripsi menu (opsional)";
    description.rows = 3;

    const price = input("Harga dalam rupiah", "number");
    price.min = "1000";
    price.max = "1000000";
    price.required = true;
    name.required = true;

    const submit = button("＋ Tambahkan menu", "tenant-primary");
    submit.type = "submit";

    form.append(
      el("h4", "", "Tambah menu baru"),
      name,
      description,
      price,
      submit,
    );

    const list = el("div", "tenant-menu-list");
    content.append(
      form,
      sectionTitle(
        "Daftar menu",
        "Ubah informasi, foto, atau ketersediaan menu.",
      ),
      list,
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submit.disabled = true;

      try {
        await api.createMenu({
          name: name.value,
          description: description.value,
          price: Number(price.value),
        });

        form.reset();
        await refreshMenus();
        alert("Menu berhasil ditambahkan.");
      } catch (err) {
        alert(err.message);
      } finally {
        submit.disabled = false;
      }
    });

    async function refreshMenus() {
      const menus = await api.getTenantMenus();
      if (currentTab !== "menus") return;

      list.replaceChildren();

      if (!menus.length) {
        list.append(
          el("p", "tenant-empty", "Belum ada menu. Tambahkan menu pertamamu."),
        );
        return;
      }

      menus.forEach((menu) => {
        const card = el("article", "tenant-menu-card");

        const preview = el("div", "tenant-menu-image");
        if (menu.image) {
          const img = el("img");
          img.src = menu.image;
          img.alt = menu.name;
          img.loading = "lazy";
          preview.append(img);
        } else {
          preview.textContent = "🍽️";
        }

        const info = el("div", "tenant-menu-info");
        const title = input("Nama menu", "text", menu.name);
        const desc = el("textarea", "tenant-input");
        desc.value = menu.description || "";
        desc.placeholder = "Deskripsi menu";

        const priceInput = input("Harga", "number", menu.price);
        priceInput.min = "1000";
        priceInput.max = "1000000";

        const save = button("Simpan perubahan", "tenant-primary");
        save.addEventListener("click", async () => {
          save.disabled = true;
          try {
            await api.updateMenu(menu.id, {
              name: title.value,
              description: desc.value,
              price: Number(priceInput.value),
            });
            alert("Menu berhasil diperbarui.");
            await refreshMenus();
          } catch (e) {
            alert(e.message);
          } finally {
            save.disabled = false;
          }
        });

        const availableLabel = el("label", "tenant-available");
        const available = el("input");
        available.type = "checkbox";
        available.checked = menu.available;

        available.addEventListener("change", async () => {
          available.disabled = true;
          try {
            await api.updateMenu(menu.id, { available: available.checked });
          } catch (e) {
            available.checked = !available.checked;
            alert(e.message);
          } finally {
            available.disabled = false;
          }
        });

        availableLabel.append(
          available,
          el("span", "", menu.available ? "Menu tersedia" : "Menu habis"),
        );

        const upload = el("input", "tenant-file");
        upload.type = "file";
        upload.accept = "image/jpeg,image/png,image/webp";

        const uploadButton = button("Unggah foto", "tenant-secondary");
        uploadButton.addEventListener("click", async () => {
          if (!upload.files[0]) {
            alert("Pilih foto terlebih dahulu.");
            return;
          }

          uploadButton.disabled = true;
          try {
            await api.uploadMenuImage(menu.id, upload.files[0]);
            alert("Foto berhasil diunggah.");
            await refreshMenus();
          } catch (e) {
            alert(e.message);
          } finally {
            uploadButton.disabled = false;
          }
        });

        const remove = button("Hapus menu", "tenant-danger");
        remove.addEventListener("click", async () => {
          if (!confirm(`Hapus menu "${menu.name}"?`)) return;

          try {
            await api.deleteMenu(menu.id);
            await refreshMenus();
          } catch (e) {
            alert(e.message);
          }
        });

        info.append(
          el("h4", "", menu.name),
          title,
          desc,
          priceInput,
          save,
          availableLabel,
          upload,
          uploadButton,
          remove,
        );

        card.append(preview, info);
        list.append(card);
      });
    }

    try {
      await refreshMenus();
    } catch (e) {
      list.append(el("p", "tenant-error", e.message));
    }
  }

  /* =========================
     LAPORAN PENJUALAN
  ========================= */

  async function loadReports() {
    content.append(
      sectionTitle(
        "Laporan penjualan",
        "Lihat transaksi yang sudah selesai dan dibayar di kasir.",
      ),
    );

    const filters = el("form", "tenant-report-filter");
    const from = input("", "date");
    const to = input("", "date");

    from.value = `${today().slice(0, 8)}01`;
    to.value = today();

    const search = button("Tampilkan laporan", "tenant-primary");
    search.type = "submit";

    filters.append(
      el("label", "", "Dari tanggal"),
      from,
      el("label", "", "Sampai tanggal"),
      to,
      search,
    );

    const result = el("div", "tenant-report-result");
    content.append(filters, result);

    async function fetchReport(e) {
      if (e) e.preventDefault();

      if (!from.value || !to.value || from.value > to.value) {
        alert("Periksa rentang tanggal laporan.");
        return;
      }

      search.disabled = true;
      result.replaceChildren(el("p", "tenant-empty", "Memuat laporan..."));

      try {
        const data = await api.getTenantReports(from.value, to.value);
        if (currentTab !== "reports") return;

        result.replaceChildren();

        const stats = el("div", "tenant-stats");
        stats.append(
          statCard("Pendapatan", rp(data.summary.revenue), "💰"),
          statCard("Transaksi selesai", data.summary.orders, "🧾"),
          statCard("Produk terjual", data.summary.sold, "🍽️"),
        );

        result.append(stats);

        result.append(el("h4", "tenant-report-heading", "Menu terlaris"));

        const top = el("div", "tenant-report-table");

        if (!data.topMenus.length) {
          top.append(
            el("p", "tenant-empty", "Belum ada penjualan pada periode ini."),
          );
        } else {
          data.topMenus.forEach((m, index) => {
            const row = el("div", "tenant-report-row");
            row.append(
              el("strong", "", `${index + 1}. ${m.name}`),
              el("span", "", `${m.quantity} terjual`),
              el("span", "", rp(m.revenue)),
            );
            top.append(row);
          });
        }

        result.append(top);
        result.append(el("h4", "tenant-report-heading", "Riwayat transaksi"));

        const transactions = el("div", "tenant-report-table");

        if (!data.transactions.length) {
          transactions.append(
            el("p", "tenant-empty", "Belum ada transaksi selesai."),
          );
        } else {
          data.transactions.forEach((t) => {
            const row = el("div", "tenant-report-row");
            const date = new Date(t.createdAt).toLocaleString("id-ID");

            row.append(
              el("strong", "", t.code),
              el("span", "", t.customer),
              el("span", "", date),
              el("strong", "", rp(t.total)),
            );

            transactions.append(row);
          });
        }

        result.append(transactions);
      } catch (e) {
        result.replaceChildren(el("p", "tenant-error", e.message));
      } finally {
        search.disabled = false;
      }
    }

    filters.addEventListener("submit", fetchReport);
    await fetchReport();
  }

  showTab("dashboard");

  // Perbarui ringkasan dan pesanan secara berkala.
  refreshTimer = setInterval(() => {
    if (document.hidden) return;

    if (currentTab === "dashboard") loadDashboard();
    if (currentTab === "orders") loadOrders();
  }, 10000);

  // Simpan fungsi cleanup agar timer dapat dihentikan jika dashboard dibongkar.
  root._tenantCleanup = () => clearInterval(refreshTimer);
}
