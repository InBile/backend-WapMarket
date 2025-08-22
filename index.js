/* =========================
   WapMarket — Frontend glue
   ========================= */

// ==== Ajusta tu backend aquí ====
const API_BASE = "https://backend-wapmarket-production.up.railway.app/api";

// ==== Utilidades básicas ====
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const toJSON = (r) => (r.ok ? r.json() : r.json().then(e => Promise.reject(e)));
const money = (n) => new Intl.NumberFormat("es-GQ").format(Number(n || 0));
const ls = {
  get: (k, d = null) => {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return d; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k),
};
const AUTH_USER_KEY = "wap_user";
const AUTH_TOKEN_KEY = "wap_token";
const CART_KEY = "wap_cart";
const CART_STORE_KEY = "wap_cart_store_id";
const SELECTED_STORE_KEY = "wap_selected_store";

// ==== Sesión ====
function getSession() {
  return {
    user: ls.get(AUTH_USER_KEY),
    token: ls.get(AUTH_TOKEN_KEY),
  };
}
function setSession(token, user) {
  ls.set(AUTH_TOKEN_KEY, token);
  ls.set(AUTH_USER_KEY, user);
  updateTopbar();
}
function clearSession() {
  ls.del(AUTH_TOKEN_KEY);
  ls.del(AUTH_USER_KEY);
  // Limpio carrito al cerrar sesión por coherencia
  clearCart(true);
  updateTopbar();
}
function authHeaders(h = {}) {
  const { token } = getSession();
  return token ? { ...h, Authorization: `Bearer ${token}` } : h;
}
function api(path, opts = {}) {
  const headers = authHeaders({ "Content-Type": "application/json", ...(opts.headers || {}) });
  return fetch(`${API_BASE}${path}`, { ...opts, headers }).then(toJSON);
}

// ==== Topbar: saludo dinámico + logout ====
// Index trae <a href="login.html">Entrar</a> y botón carrito (#cartBtn) en la nav.  :contentReference[oaicite:5]{index=5}
function updateTopbar() {
  const nav = $(".topbar .nav");
  if (!nav) return;

  const { user } = getSession();

  // Conserva botón carrito si existe
  const cartBtn = $("#cartBtn")?.outerHTML || "";

  if (user) {
    const name = user.name || user.email;
    const role = user.role || (user.is_admin ? "admin" : "buyer");

    let roleLink = "";
    if (role === "seller") roleLink = `<a href="seller.html" title="Panel de vendedor">Vendedor</a>`;
    if (role === "admin") roleLink = `<a href="admin.html" title="Panel de administrador">Admin</a>`;

    nav.innerHTML = `
      <span>Hola, <strong>${name}</strong></span>
      ${roleLink}
      ${cartBtn}
      <button id="logoutBtn" title="Cerrar sesión">Salir</button>
    `;

    $("#logoutBtn")?.addEventListener("click", () => {
      clearSession();
      // tras logout, vuelvo a home
      if (!location.pathname.endsWith("index.html")) {
        location.href = "index.html";
      } else {
        // refresco la UI de index si ya estoy aquí
        refreshCartBadge();
      }
    });
  } else {
    // Si no hay sesión, vuelve a poner "Entrar" + carrito si estaba
    nav.innerHTML = `
      <a href="login.html">Entrar</a>
      ${cartBtn}
    `;
  }
}

// ==== Carrito (ligado a tienda seleccionada) ====
function loadCart() {
  return {
    items: ls.get(CART_KEY, []),          // [{id, title, price_xaf, qty, image_url}]
    storeId: ls.get(CART_STORE_KEY, null) // id de la tienda asociada a estos items
  };
}
function saveCart(cart) {
  ls.set(CART_KEY, cart.items);
  ls.set(CART_STORE_KEY, cart.storeId);
  refreshCartBadge();
  renderCartDrawer(); // si está abierto, actualiza
}
function clearCart(keepStore = false) {
  const storeId = keepStore ? ls.get(CART_STORE_KEY, null) : null;
  saveCart({ items: [], storeId });
}
function resetCartForStore(newStoreId) {
  const currentStoreId = ls.get(CART_STORE_KEY, null);
  if (currentStoreId !== newStoreId) {
    saveCart({ items: [], storeId: newStoreId });
  }
}
function addToCart(product, qty = 1) {
  const cart = loadCart();
  if (cart.storeId == null) {
    // Primera vez: liga carrito a la tienda del producto
    cart.storeId = product.store_id ?? ls.get(SELECTED_STORE_KEY, null);
  }
  // Seguridad: si el producto pertenece a otra tienda, resetea
  if (cart.storeId !== (product.store_id ?? ls.get(SELECTED_STORE_KEY, null))) {
    saveCart({ items: [], storeId: product.store_id ?? ls.get(SELECTED_STORE_KEY, null) });
  }

  const idx = cart.items.findIndex(i => i.id === product.id);
  if (idx >= 0) {
    cart.items[idx].qty += qty;
  } else {
    cart.items.push({
      id: product.id,
      title: product.name || product.title,
      price_xaf: Number(product.price_xaf ?? product.price ?? 0),
      qty,
      image_url: product.image_url || null,
      store_id: product.store_id ?? null
    });
  }
  saveCart(cart);
}
function removeFromCart(productId) {
  const cart = loadCart();
  cart.items = cart.items.filter(i => i.id !== productId);
  saveCart(cart);
}
function refreshCartBadge() {
  const count = loadCart().items.reduce((s, i) => s + i.qty, 0);
  const badge = $("#cartCount");
  if (badge) badge.textContent = count;
}

// ==== Drawer del carrito + checkout (index) ====
function initCartUI() {
  const cartBtn = $("#cartBtn");
  const drawer = $("#cartDrawer");
  const closeCart = $("#closeCart");
  const checkoutOpen = $("#checkoutOpen");
  const closeCheckout = $("#closeCheckout");
  const checkoutModal = $("#checkoutModal");
  const checkoutForm = $("#checkoutForm");
  const fulfillmentType = $("#fulfillmentType");
  const coSubtotal = $("#coSubtotal");
  const coDelivery = $("#coDelivery");
  const coTotal = $("#coTotal");

  if (cartBtn && drawer) {
    cartBtn.addEventListener("click", () => drawer.classList.remove("hidden"));
  }
  if (closeCart && drawer) {
    closeCart.addEventListener("click", () => drawer.classList.add("hidden"));
  }
  if (checkoutOpen && checkoutModal) {
    checkoutOpen.addEventListener("click", () => {
      drawer.classList.add("hidden");
      checkoutModal.classList.remove("hidden");
      // precalcula totales
      updateCheckoutTotals();
    });
  }
  if (closeCheckout && checkoutModal) {
    closeCheckout.addEventListener("click", () => checkoutModal.classList.add("hidden"));
  }
  function updateCheckoutTotals() {
    const cart = loadCart();
    const subtotal = cart.items.reduce((s, i) => s + (i.price_xaf * i.qty), 0);
    const delivery = fulfillmentType?.value === "delivery" ? 2000 : 0;
    if (coSubtotal) coSubtotal.textContent = money(subtotal);
    if (coDelivery) coDelivery.textContent = money(delivery);
    if (coTotal) coTotal.textContent = money(subtotal + delivery);
  }
  fulfillmentType?.addEventListener("change", updateCheckoutTotals);

  checkoutForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cart = loadCart();
    if (!cart.items.length) {
      alert("Tu carrito está vacío.");
      return;
    }
    const fd = new FormData(checkoutForm);
    const payload = {
      items: cart.items.map(i => ({ productId: i.id, quantity: i.qty })),
      fulfillment_type: fd.get("fulfillment_type") || "pickup",
      guest_name: fd.get("guest_name") || null,
      guest_phone: fd.get("guest_phone") || null,
      address: fd.get("address") || null,
    };
    try {
      const res = await api("/orders", { method: "POST", body: JSON.stringify(payload) });
      alert(`✅ Pedido creado (ID ${res.order_id}). ¡Gracias!`);
      clearCart(true); // mantiene store seleccionada
      $("#checkoutModal")?.classList.add("hidden");
    } catch (err) {
      console.error(err);
      alert(err?.error || "No se pudo crear el pedido");
    }
  });

  renderCartDrawer();
  refreshCartBadge();
}
function renderCartDrawer() {
  const container = $("#cartItems");
  const subtotalEl = $("#subtotalXAF");
  if (!container) return;
  const cart = loadCart();
  container.innerHTML = "";
  let subtotal = 0;

  cart.items.forEach(item => {
    subtotal += item.price_xaf * item.qty;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = ".5rem";
    row.style.padding = ".4rem 0";
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;max-width:70%">
        <img src="${item.image_url || "https://via.placeholder.com/60x60?text=%20"}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:.35rem;background:#eee">
        <div style="overflow:hidden">
          <div style="font-weight:600;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${item.title}</div>
          <div style="font-size:.9rem;color:#555">${money(item.price_xaf)} XAF</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.35rem">
        <button data-act="dec" data-id="${item.id}">−</button>
        <span>${item.qty}</span>
        <button data-act="inc" data-id="${item.id}">+</button>
        <button data-act="del" data-id="${item.id}" title="Quitar">✕</button>
      </div>
    `;
    container.appendChild(row);
  });

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    const act = btn.getAttribute("data-act");
    const cart = loadCart();
    const idx = cart.items.findIndex(i => i.id === id);
    if (idx < 0) return;
    if (act === "inc") cart.items[idx].qty += 1;
    if (act === "dec") cart.items[idx].qty = Math.max(1, cart.items[idx].qty - 1);
    if (act === "del") cart.items.splice(idx, 1);
    saveCart(cart);
  }, { once: true }); // re-engancha en cada render

  if (subtotalEl) subtotalEl.textContent = money(subtotal);
}

// ==== Index: tiendas + productos (solo de la tienda seleccionada) ====
let STATE = {
  stores: [],
  selectedStoreId: null,
  allProducts: [], // productos de la tienda seleccionada
  filters: {
    q: "",
    category: "",
    min: 0,
    max: 100000
  }
};

async function loadStores() {
  const r = await api("/stores"); // devuelve { stores: [...] }
  STATE.stores = r.stores || [];
  renderStores();
  // Selección inicial: la última elegida o la primera disponible
  const saved = ls.get(SELECTED_STORE_KEY, null);
  const initial = STATE.stores.find(s => s.id === saved) ? saved : STATE.stores[0]?.id ?? null;
  if (initial) await selectStore(initial);
}

// La columna izquierda está vacía en tu HTML; la lleno con título, buscador y lista.  :contentReference[oaicite:6]{index=6}
function renderStores() {
  const host = $("#businessesSection");
  if (!host) return;
  host.innerHTML = `
    <h3>Negocios</h3>
    <div class="business-search">
      <input id="storeSearch" placeholder="Buscar negocio...">
    </div>
    <div class="business-list" id="businessList"></div>
  `;

  const list = $("#businessList");
  const search = $("#storeSearch");

  function draw(items) {
    list.innerHTML = items.map(s => `
      <button class="business-item" data-id="${s.id}" style="${STATE.selectedStoreId===s.id ? 'background:#f9fafb' : ''}">
        <img src="https://via.placeholder.com/32x32?text=%20" alt="">
        <div>
          <div class="business-name">${s.name}</div>
          <div class="business-category">${(s.product_count ?? 0)} productos</div>
        </div>
      </button>
    `).join("");
  }
  draw(STATE.stores);

  list.addEventListener("click", async (e) => {
    const btn = e.target.closest(".business-item");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    await selectStore(id);
    // re-dibuja para marcar activa
    draw(STATE.stores);
  });

  search?.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const filtered = !q ? STATE.stores : STATE.stores.filter(s => (s.name || "").toLowerCase().includes(q));
    draw(filtered);
  });
}

async function selectStore(storeId) {
  STATE.selectedStoreId = Number(storeId);
  ls.set(SELECTED_STORE_KEY, STATE.selectedStoreId);
  resetCartForStore(STATE.selectedStoreId);

  // Título de sección
  const store = STATE.stores.find(s => s.id === STATE.selectedStoreId);
  const title = $("#productsTitle");
  if (title) title.textContent = store ? `Productos de ${store.name}` : "Productos disponibles";

  // Carga productos de esa tienda
  const r = await api(`/products?store_id=${STATE.selectedStoreId}`);
  STATE.allProducts = (r.products || []);
  fillCategories(STATE.allProducts);
  renderProducts();
}

function currentFilteredProducts() {
  const { q, category, min, max } = STATE.filters;
  return STATE.allProducts.filter(p => {
    const name = (p.name || p.title || "").toLowerCase();
    const okQ = !q || name.includes(q.toLowerCase());
    const cat = (p.category || "").toLowerCase();
    const okCat = !category || cat === category.toLowerCase();
    const price = Number(p.price_xaf ?? p.price ?? 0);
    const okMin = price >= (Number(min) || 0);
    const okMax = price <= (Number(max) || 999999999);
    return okQ && okCat && okMin && okMax;
  });
}
function fillCategories(products) {
  const catSel = $("#categoryFilter");
  if (!catSel) return;
  const cats = [...new Set(products.map(p => (p.category || "").trim()).filter(Boolean))].sort();
  catSel.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c => `<option>${c}</option>`).join("");
}
function renderProducts() {
  const host = $("#productsList");
  if (!host) return;
  const items = currentFilteredProducts();
  host.innerHTML = items.map(p => `
    <div class="product-card">
      <img src="${p.image_url || 'https://via.placeholder.com/300x160?text=%20'}" alt="">
      <div class="product-info">
        <div class="product-title">${p.name || p.title}</div>
        <div class="product-price">${money(p.price_xaf ?? p.price)} XAF</div>
        <button class="product-btn" data-id="${p.id}">Añadir al carrito</button>
      </div>
    </div>
  `).join("");

  host.addEventListener("click", async (e) => {
    const btn = e.target.closest(".product-btn");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    const product = STATE.allProducts.find(x => x.id === id);
    if (!product) return;
    addToCart(product, 1);
  }, { once: true });
}

function initIndexFilters() {
  const q = $("#searchInput");                // ya existe en topbar de index  :contentReference[oaicite:7]{index=7}
  const qBtn = $("#searchBtn");               // idem
  const cat = $("#categoryFilter");
  const min = $("#minPriceFilter");
  const max = $("#maxPriceFilter");

  function apply() {
    STATE.filters = {
      q: q?.value || "",
      category: cat?.value || "",
      min: min?.value || 0,
      max: max?.value || 100000
    };
    renderProducts();
  }
  qBtn?.addEventListener("click", apply);
  q?.addEventListener("keydown", (e) => { if (e.key === "Enter") apply(); });
  cat?.addEventListener("change", apply);
  min?.addEventListener("change", apply);
  max?.addEventListener("change", apply);
}

// ==== Login & Signup (login.html) ====
function initAuthPage() {
  const loginForm = $("#loginForm");
  const signupForm = $("#signupForm");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const payload = { email: fd.get("email"), password: fd.get("password") };
    try {
      const r = await api("/auth/login", { method: "POST", body: JSON.stringify(payload) });
      setSession(r.token, r.user);
      // volver a inicio
      location.href = "index.html";
    } catch (err) {
      alert(err?.error || "No se pudo iniciar sesión");
    }
  });

  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(signupForm);
    const email = fd.get("email");
    const password = fd.get("password");
    const payload = {
      name: fd.get("name"),
      phone: fd.get("phone"),
      email,
      password
    };
    try {
      // Importante: solo llamamos a UN endpoint para evitar duplicados; luego autenticamos.
      await api("/auth/signup", { method: "POST", body: JSON.stringify(payload) });
      const loginRes = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setSession(loginRes.token, loginRes.user);
      location.href = "index.html";
    } catch (err) {
      alert(err?.error || "No se pudo crear la cuenta");
    }
  });
}

// ==== Admin (admin.html) ====
function initAdminPage() {
  const createSellerForm = $("#createSellerForm");
  const refreshUsersBtn = $("#refreshUsers");
  const usersTable = $("#usersTable");

  async function drawUsers() {
    try {
      const r = await api("/admin/users");
      const rows = (r.users || []).map(u => `
        <tr>
          <td>${u.id}</td>
          <td>${u.name || ""}</td>
          <td>${u.email}</td>
          <td>${u.phone || ""}</td>
          <td>${u.role || (u.is_admin ? "admin" : "buyer")}</td>
          <td>${new Date(u.created_at).toLocaleString()}</td>
        </tr>
      `).join("");
      usersTable.innerHTML = `
        <table>
          <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Rol</th><th>Alta</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch (e) {
      usersTable.innerHTML = `<p style="color:#b91c1c">No se pudieron cargar los usuarios.</p>`;
    }
  }

  refreshUsersBtn?.addEventListener("click", drawUsers);
  createSellerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(createSellerForm);
    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      password: fd.get("password"),
      phone: fd.get("phone") || null,
      store_name: fd.get("store_name"),
    };
    try {
      await api("/admin/create-seller", { method: "POST", body: JSON.stringify(payload) });
      alert("✅ Vendedor y tienda creados");
      createSellerForm.reset();
      drawUsers();
    } catch (err) {
      alert(err?.error || "Error al crear vendedor");
    }
  });

  // carga inicial
  if (usersTable) drawUsers();
}

// ==== Seller (seller.html) ====
function initSellerPage() {
  const form = $("#newProductForm");
  const grid = $("#sellerProducts");
  const ordersBox = $("#sellerOrders");

  async function loadMyProducts() {
    try {
      const r = await api("/seller/products");
      grid.innerHTML = (r.products || []).map(p => `
        <div class="card product">
          <img src="${p.image_url || 'https://via.placeholder.com/300x160?text=%20'}" alt="">
          <div class="title">${p.name || p.title}</div>
          <div class="price">${money(p.price_xaf ?? p.price)} XAF</div>
        </div>
      `).join("");
    } catch {
      grid.innerHTML = `<p style="color:#b91c1c">No se pudieron cargar tus productos.</p>`;
    }
  }
  async function loadMyOrders() {
    try {
      const r = await api("/seller/orders");
      const blocks = (r.orders || []).map(o => `
        <div class="card" style="margin-bottom:1rem">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <strong>Pedido #${o.id}</strong>
            <span>${new Date(o.created_at).toLocaleString()}</span>
          </div>
          <div>Cliente: ${o.guest_name || "-"}</div>
          <div>Teléfono: ${o.guest_phone || "-"}</div>
          <div>Entrega: ${o.fulfillment_type}</div>
          <div style="margin:.5rem 0">
            ${o.items.map(it => `<div>• ${it.title} × ${it.qty} — ${money(it.unit_price_xaf)} XAF</div>`).join("")}
          </div>
          <div><strong>Total:</strong> ${money(o.total_xaf)} XAF</div>
          <div style="margin-top:.5rem">
            <label>Cambiar estado:
              <select data-order="${o.id}" class="seller-status">
                ${["CREATED","CONFIRMED","SHIPPED","DELIVERED","CANCELLED"].map(s => `
                  <option ${s===o.status ? "selected" : ""} value="${s}">${s}</option>
                `).join("")}
              </select>
            </label>
          </div>
        </div>
      `).join("");
      ordersBox.innerHTML = blocks || "<p>No tienes pedidos todavía.</p>";

      ordersBox.addEventListener("change", async (e) => {
        const sel = e.target.closest(".seller-status");
        if (!sel) return;
        const id = sel.getAttribute("data-order");
        try {
          await api(`/seller/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status: sel.value }) });
          alert("Estado actualizado");
        } catch {
          alert("No se pudo actualizar el estado");
        }
      }, { once: true });
    } catch {
      ordersBox.innerHTML = `<p style="color:#b91c1c">No se pudieron cargar los pedidos.</p>`;
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: fd.get("title"),
      name: fd.get("title"),
      price_xaf: fd.get("price_xaf"),
      price: fd.get("price_xaf"),
      image_url: fd.get("image_url"),
      stock: Number(fd.get("stock") || 0)
    };
    try {
      await api("/seller/products", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      loadMyProducts();
      alert("✅ Producto creado");
    } catch (err) {
      alert(err?.error || "No se pudo crear el producto");
    }
  });

  loadMyProducts();
  loadMyOrders();
}

// ==== Boot por página ====
document.addEventListener("DOMContentLoaded", async () => {
  updateTopbar();

  const path = location.pathname;

  // index.html: sidebar negocios, lista de productos y carrito  :contentReference[oaicite:8]{index=8}
  if (path.endsWith("/") || path.endsWith("index.html")) {
    try {
      await loadStores();
    } catch (e) {
      console.error(e);
      $("#productsList") && ($("#productsList").innerHTML = `<p style="color:#b91c1c">No se pudieron cargar los negocios/productos.</p>`);
    }
    initIndexFilters();
    initCartUI();
  }

  // login.html: login/registro  :contentReference[oaicite:9]{index=9}
  if (path.endsWith("login.html")) {
    initAuthPage();
  }

  // admin.html  :contentReference[oaicite:10]{index=10}
  if (path.endsWith("admin.html")) {
    initAdminPage();
  }

  // seller.html  :contentReference[oaicite:11]{index=11}
  if (path.endsWith("seller.html")) {
    initSellerPage();
  }
});
