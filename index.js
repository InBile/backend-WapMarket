
// ================== ROLE HELPERS ==================
function getRole(user) {
  if (!user) return "guest";
  if (user.role) return user.role; // "buyer" | "seller" | "admin"
  if (user.is_admin) return "admin";
  if (user.is_seller) return "seller";
  return "buyer";
}
function canPlaceOrders(user) {
  const role = getRole(user);
  return role === "buyer" || role === "guest";
}

/* app.js — WapMarket: Frontend conectado a tu backend
   - Productos públicos (guest checkout)
   - Filtro por negocios (stores)
   - Carrito con cierre por click-afuera / ESC / vaciado
   - Checkout invitado + render de factura
   - Seller dashboard (productos propios + pedidos + acciones de estado)
   - Admin (usuarios + crear vendedor/tienda)
*/

const API_BASE = "https://backend-wapmarket-production.up.railway.app/api";

/* ==========================
   Utilidades generales
========================== */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const currency = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) + " XAF";

function getAuth() {
  const token = localStorage.getItem("wap_token");
  const userRaw = localStorage.getItem("wap_user");
  let user = null;
  try { user = JSON.parse(userRaw || "null"); } catch {}
  return { token, user };
}
function setAuth({ token, user }) {
  if (token) localStorage.setItem("wap_token", token);
  if (user)  localStorage.setItem("wap_user", JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem("wap_token");
  localStorage.removeItem("wap_user");
}

function authHeaders(extra = {}) {
  const { token } = getAuth();
  const headers = { "Content-Type": "application/json", ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function httpJson(path, opts = {}, fallbacks = []) {
  const urls = [API_BASE + path, ...fallbacks.map(f => API_BASE + f)];
  let lastErr;

  for (const u of urls) {
    try {
      const res = await fetch(u, opts);

      // Intentamos parsear el cuerpo como JSON siempre
      const txt = await res.text();
      let data;
      try {
        data = txt ? JSON.parse(txt) : {};
      } catch {
        data = { raw: txt };
      }

      // Si la respuesta no es OK, devolvemos el error del backend
      if (!res.ok) {
        const msg = data.error || data.message || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      // Si es OK, devolvemos los datos
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/* ==========================
   Estado global (frontend)
========================== */
let SELECTED_STORE_ID = null; // Para filtro de productos por negocio


/* ==========================
   Tienda seleccionada + título + topbar
========================== */
let STORES_CACHE = [];

function getSelectedStore() {
  if (SELECTED_STORE_ID == null) return null;
  return (STORES_CACHE || []).find(s => Number(s.id) === Number(SELECTED_STORE_ID)) || null;
}

function ensureCartScopedToStore(storeId) {
  const current = localStorage.getItem("wap_cart_store");
  const nextStr = storeId != null ? String(storeId) : "";
  if (current !== nextStr) {
    // Cambió de tienda -> vaciamos el carrito y persistimos la nueva tienda
    saveCart([]);
  }
  localStorage.setItem("wap_cart_store", nextStr);
  updateCartCount();
}

function updateProductsTitle() {
  const el = $("#productsTitle");
  if (!el) return;
  const s = getSelectedStore();
  el.textContent = s ? `Productos de ${s.name}` : "Productos Disponibles";
}

function updateUserTopbar() {
  const nav = $("#userSection") || $(".nav");
  if (!nav) return;
  const { token, user } = getAuth();

  if (token && user) {
    // Mostramos solo botón de logout en el topbar
    nav.innerHTML = `
      <button id="logoutBtn" class="linklike">Salir</button>
    `;

    // Actualizamos el saludo dentro del modal
    const greetingText = document.getElementById("userGreetingText");
    if (greetingText) {
      const name = user.name || user.email || "Usuario";
      greetingText.textContent = `Hola, ${name.split(" ")[0]}`;
    }

    $("#logoutBtn")?.addEventListener("click", () => {
      clearAuth();
      SELECTED_STORE_ID = null;
      localStorage.removeItem("wap_selected_store");
      ensureCartScopedToStore(null);
      updateProductsTitle();
      location.href = "index.html";
    });
  } else {
    nav.innerHTML = `<a href="login.html">Entrar</a>`;
  }
}

/* ==========================
   Carrito (guest-friendly)
========================== */
function loadCart() {
  try { return JSON.parse(localStorage.getItem("wap_cart") || "[]"); } catch { return []; }
}
function saveCart(items) {
  localStorage.setItem("wap_cart", JSON.stringify(items));
  updateCartCount();
}
function clearCart() { saveCart([]); }
function addToCart(product) {
  // Aseguramos que el carrito pertenece a la tienda seleccionada
  ensureCartScopedToStore(SELECTED_STORE_ID);
  const cart = loadCart();
  const idx = cart.findIndex(i => i.id === product.id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({
    id: product.id,
    title: product.title || product.name || "Producto",
    price_xaf: Number(product.price_xaf ?? product.price ?? 0),
    image_url: product.image_url || null,
    qty: 1
  });
  saveCart(cart);
}
function cartSubtotal() {
  return loadCart().reduce((s, i) => s + Number(i.price_xaf || 0) * Number(i.qty || 0), 0);
}
function updateCartCount() {
  const el = $("#cartCount");
  if (el) el.textContent = loadCart().reduce((s, i) => s + i.qty, 0);
}

/* ==========================
   API client
========================== */
const api = {
  /* Auth */
  async login(email, password) {
    return await httpJson("/auth/login", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password })
    }, ["/login"]);
  },
  async signup(payload) {
    return await httpJson("/auth/signup", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    }, ["/register"]);
  },
  async profile() {
    return await httpJson("/profile", { headers: authHeaders() });
  },

  /* Stores */
  async stores() {
    try {
      const data = await httpJson("/stores", { headers: authHeaders() }, ["/businesses", "/shops", "/negocios"]);
      return Array.isArray(data) ? data : (data.stores || []);
    } catch { return []; }
  },

  /* Products */
  async products({ store_id = null } = {}) {
    const qs = store_id ? `?store_id=${encodeURIComponent(store_id)}` : "";
    const data = await httpJson(`/products${qs}`, { headers: authHeaders() });
    return Array.isArray(data) ? data : (data.products || []);
  },
  async product(id) {
    return await httpJson(`/products/${id}`, { headers: authHeaders() });
  },

  /* Orders */
  async createOrder(payload) {
    return await httpJson("/orders", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    }, ["/checkout"]);
  },

  /* Seller */
  seller: {
    async mineProducts() {
      const data = await httpJson("/seller/products", { headers: authHeaders() });
      return Array.isArray(data) ? data : (data.products || []);
    },
    async createProduct(p) {
      return await httpJson("/seller/products", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(p)
      });
    },
    async orders() {
      const data = await httpJson("/seller/orders", { headers: authHeaders() });
      return Array.isArray(data) ? data : (data.orders || []);
    },
    async setOrderStatus(orderId, status) {
      return await httpJson(`/seller/orders/${orderId}/status`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
    }
  },

  /* Admin */
  admin: {
    async users() {
      const data = await httpJson("/admin/users", { headers: authHeaders() });
      return Array.isArray(data) ? data : (data.users || []);
    },
    async createSeller(payload) {
      return await httpJson("/admin/create-seller", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
    }
  }
};

/* ==========================
   Render helpers (Index)
========================== */
function renderProducts(list, container) {
  if (!container) return;
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class="muted">No hay productos disponibles.</div>`;
    return;
  }

  for (const p of list) {
    const title = p.title || p.name || "Producto";
    const price = Number(p.price_xaf ?? p.price ?? 0);
    const img = p.image_url || "https://via.placeholder.com/300x200?text=Producto";

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img class="product-thumb" src="${img}" alt="${title}">
      <div class="product-info">
        <div class="product-title">${title}</div>
        <div class="product-price">${currency(price)}</div>
        <button class="product-btn">Añadir</button>
      </div>
    `;
    $(".product-btn", card).addEventListener("click", () => {
      addToCart({ id: p.id, title, price_xaf: price, image_url: img });
      toast("Producto añadido al carrito");
    });
    container.appendChild(card);
  }
}

function renderStores(list, container) {
  if (!container) return;
  container.innerHTML = "";
  const head = document.createElement("div");
  head.className = "businesses-header";
  head.innerHTML = `<h3>Negocios</h3>`;
  container.appendChild(head);


  const wrap = document.createElement("div");
  wrap.className = "business-list";
  container.appendChild(wrap);

  if (!list.length) {
    wrap.innerHTML = `<div class="muted">Sin negocios</div>`;
    return;
  }

  for (const s of list) {
    const item = document.createElement("button");
    item.className = "business-item";
    item.dataset.storeId = s.id;
    item.innerHTML = `
      <div class="avatar">${(s.name || "Tienda").slice(0,1).toUpperCase()}</div>
      <div class="business-meta">
        <div class="business-name">${s.name || "Tienda"}</div>
        <div class="business-sub">${(s.product_count ?? 0)} productos</div>
      </div>
    `;
    item.addEventListener("click", async () => {
      SELECTED_STORE_ID = s.id;
      localStorage.setItem("wap_selected_store", String(s.id));
      highlightActiveStore(s.id);
      ensureCartScopedToStore(s.id);
      updateProductsTitle();
      await reloadProducts();
      toast(`Filtrado por: ${s.name}`);
    });
    wrap.appendChild(item);
  }

  //$("#clearStoreFilter")?.addEventListener("click", async () => {
   // SELECTED_STORE_ID = null;
   // highlightActiveStore(null);
    //await reloadProducts();
  //});
}

function highlightActiveStore(storeId) {
  $$(".business-item").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.storeId) === Number(storeId));
  });
}

async function reloadProducts() {
  const container = $("#productsList");
  if (!container) return;
  container.innerHTML = `<div class="muted">Cargando productos…</div>`;
  try {
    const prods = await api.products({ store_id: SELECTED_STORE_ID });
    renderProducts(prods, container);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="error">Error cargando productos</div>`;
  }
}

/* ==========================
   Carrito UI / Checkout
========================== */
function toast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.position = "fixed";
    t.style.bottom = "20px";
    t.style.left = "50%";
    t.style.transform = "translateX(-50%)";
    t.style.padding = "10px 14px";
    t.style.background = "rgba(0,0,0,.8)";
    t.style.color = "#fff";
    t.style.borderRadius = "10px";
    t.style.fontSize = ".95rem";
    t.style.zIndex = "9999";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  setTimeout(() => { t.style.opacity = "0"; }, 1400);
}

function openDrawer() { $("#cartDrawer")?.classList.remove("hidden"); }
function closeDrawer() { $("#cartDrawer")?.classList.add("hidden"); }

function wireDrawerDismiss() {
  const drawer = $("#cartDrawer");
  if (!drawer) return;

  // Cerrar por click fuera: si el overlay es #cartDrawer y el panel es .drawer-panel
  drawer.addEventListener("click", (e) => {
    const panel = $(".drawer-panel", drawer) || $("#cartPanel") || null;
    if (panel && !panel.contains(e.target)) closeDrawer();
    else if (!panel) closeDrawer(); // fallback si no existe panel
  });

  // Cerrar por tecla ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
}

function renderCart() {
  const list = $("#cartItems");
  const subtotalEl = $("#subtotalXAF");
  if (!list) return;

  const items = loadCart();
  list.innerHTML = "";

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <img class="cart-thumb" src="${it.image_url || "https://via.placeholder.com/64"}" alt="">
      <div class="cart-meta">
        <div class="cart-title">${it.title}</div>
        <div class="cart-sub">${currency(it.price_xaf)} × ${it.qty}</div>
      </div>
      <div class="cart-qty">
        <button class="qty minus">−</button>
        <span class="qty-value">${it.qty}</span>
        <button class="qty plus">+</button>
        <button class="remove" title="Quitar">✕</button>
      </div>
    `;
    $(".minus", row).addEventListener("click", () => {
      it.qty = Math.max(1, it.qty - 1);
      saveCart(items);
      renderCart();
    });
    $(".plus", row).addEventListener("click", () => {
      it.qty += 1;
      saveCart(items);
      renderCart();
    });
    $(".remove", row).addEventListener("click", () => {
      const next = items.filter(x => x.id !== it.id);
      saveCart(next);
      renderCart();
      if (!next.length) {
        closeDrawer();
        toast("Carrito vacío");
      }
    });
    list.appendChild(row);
  }

  if (subtotalEl) subtotalEl.textContent = currency(cartSubtotal());
  updateCheckoutSummary();
}

function updateCheckoutSummary() {
  const subtotal = cartSubtotal();
  const typeSel = $("#fulfillmentType");
  const deliveryFee = (typeSel && typeSel.value === "delivery") ? 2000 : 0;

  const coSubtotal = $("#coSubtotal");
  const coDelivery = $("#coDelivery");
  const coTotal = $("#coTotal");
  if (coSubtotal) coSubtotal.textContent = currency(subtotal);
  if (coDelivery) coDelivery.textContent = currency(deliveryFee);
  if (coTotal)     coTotal.textContent = currency(subtotal + deliveryFee);
}

function renderInvoice({ order, submittedItems, buyer }) {
  // Crea una factura sencilla dentro del modal de checkout
  const wrap = $("#invoiceBox");
  if (!wrap) return;

  const date = new Date(order.created_at || Date.now());
  const itemsHtml = submittedItems.map(i => `
    <tr>
      <td>${i.title}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${currency(i.unit_price_xaf || i.price_xaf)}</td>
    </tr>
  `).join("");

  wrap.innerHTML = `
    <div class="invoice">
      <div class="invoice-head">
        <div>
          <h3>Factura</h3>
          <div class="muted">Pedido #${order.id}</div>
        </div>
        <div class="muted" style="text-align:right">
          ${date.toLocaleDateString()} ${date.toLocaleTimeString().slice(0,5)}
        </div>
      </div>
      <div class="invoice-meta">
        <div><strong>Cliente:</strong> ${buyer?.name || buyer?.guest_name || "Invitado"}</div>
        <div><strong>Teléfono:</strong> ${buyer?.phone || buyer?.guest_phone || "-"}</div>
        ${order.fulfillment_type === "delivery" ? `<div><strong>Dirección:</strong> ${buyer?.address || "-"}</div>` : ""}
        <div><strong>Entrega:</strong> ${order.fulfillment_type.toUpperCase()}</div>
        <div><strong>Estado:</strong> ${order.status}</div>
      </div>
      <table class="invoice-table">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="invoice-total">
        <div><span>Total</span><strong>${currency(order.total_xaf)}</strong></div>
      </div>
      <div class="invoice-actions">
        <button id="invoicePrint">Imprimir</button>
        <button id="invoiceClose">Cerrar</button>
      </div>
    </div>
  `;

  $("#invoicePrint")?.addEventListener("click", () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Factura #${order.id}</title>
      <style>
        body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:20px;}
        h3{margin:0 0 8px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #ddd;padding:8px}
        th{text-align:left;background:#f7f7f7}
        .right{text-align:right}
      </style></head>
      <body>
        ${$("#invoiceBox").innerHTML}
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  });
  $("#invoiceClose")?.addEventListener("click", () => {
    const modal = $("#checkoutModal");
    modal?.classList.add("hidden");
  });
}

/* ==========================
   Inicialización por página
========================== */
document.addEventListener("DOMContentLoaded", () => {
  updateUserTopbar();
  updateCartCount();

  const isIndex  = !!$("#productsList");
  const isLogin  = !!$("#loginForm") || !!$("#signupForm");
  const isSeller = !!$("#sellerOrders") || !!$("#newProductForm");
  const isAdmin  = !!$("#createSellerForm");

  if (isIndex)  bootIndexPage();
  if (isLogin)  bootAuthPage();
  if (isSeller) bootSellerPage();
  if (isAdmin)  bootAdminPage();
});

/* ==========================
   Página: Index (tienda)
========================== */

// app.js
const API = "https://backend-wapmarket-production.up.railway.app";

const els = {
  businessesList: document.getElementById("businessesList"),
  productsList: document.getElementById("productsList"),
  cartBtn: document.getElementById("cartBtn"),
  cartDrawer: document.getElementById("cartDrawer"),
  closeCart: document.getElementById("closeCart"),
  cartItems: document.getElementById("cartItems"),
  cartCount: document.getElementById("cartCount"),
  subtotalXAF: document.getElementById("subtotalXAF"),
  checkoutOpen: document.getElementById("checkoutOpen"),
};

let productsCache = [];
let currentStoreId = null;

// ------- UTIL
function fmt(xaf) { return Number(xaf || 0).toLocaleString("es-GQ"); }
function imgOf(p) { return p.image_url || "assets/placeholder.png"; } // fallback

function getCart() {
  try { return JSON.parse(localStorage.getItem("wap_cart") || "[]"); }
  catch { return []; }
}
function setCart(items) {
  localStorage.setItem("wap_cart", JSON.stringify(items));
  drawCart();
}
function addToCart(productId) {
  const p = productsCache.find(x => x.id == productId);
  if (!p) return;
  const cart = getCart();
  const idx = cart.findIndex(i => i.id == p.id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ id: p.id, name: p.name, price: p.price_xaf ?? p.price, qty: 1 });
  setCart(cart);
}

// ------- RENDER
function renderStores(stores) {
  const frag = document.createDocumentFragment();

  const allBtn = document.createElement("button");
  allBtn.className = "list-item";
  allBtn.textContent = "Todos";
  allBtn.addEventListener("click", () => {
    currentStoreId = null;
    loadProducts();
  });
  frag.appendChild(allBtn);

  stores.forEach(s => {
    const li = document.createElement("button");
    li.className = "list-item";
    li.textContent = `${s.name} (${s.product_count})`;
    li.addEventListener("click", () => {
      currentStoreId = s.id;
      loadProducts();
    });
    frag.appendChild(li);
  });

  els.businessesList.innerHTML = "";
  els.businessesList.appendChild(frag);
}

function renderProducts(list) {
  const wrap = document.createDocumentFragment();

  list.forEach(p => {
    const card = document.createElement("article");
    card.className = "card product-card";

    card.innerHTML = `
      <div class="img-wrap">
        <img src="${imgOf(p)}" alt="${p.name}"
             onerror="this.src='assets/placeholder.png'"/>
      </div>
      <h4>${p.name}</h4>
      <p><b>Precio:</b> ${fmt(p.price_xaf ?? p.price)} XAF</p>
      <p><b>Categoría:</b> ${p.category || "Sin categoría"}</p>
      <button class="btn-primary add-to-cart" data-id="${p.id}">
        Agregar al carrito
      </button>
    `;
    wrap.appendChild(card);
  });

  els.productsList.innerHTML = "";
  els.productsList.appendChild(wrap);
}

// Delegación de click para botones "Agregar al carrito"
els.productsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-to-cart");
  if (!btn) return;
  addToCart(btn.dataset.id);
});

// ------- CART UI
function drawCart() {
  const cart = getCart();
  els.cartItems.innerHTML = "";

  let subtotal = 0;
  cart.forEach(i => {
    const row = document.createElement("div");
    row.className = "cart-row";
    const line = Number(i.price) * Number(i.qty);
    subtotal += line;
    row.innerHTML = `
      <div>${i.name}</div>
      <div>${i.qty} × ${fmt(i.price)} XAF</div>
      <div><b>${fmt(line)} XAF</b></div>
    `;
    els.cartItems.appendChild(row);
  });

  els.cartCount.textContent = cart.reduce((a,b)=>a + Number(b.qty), 0);
  els.subtotalXAF.textContent = fmt(subtotal);
}

els.cartBtn?.addEventListener("click", () => {
  els.cartDrawer.classList.remove("hidden");
  els.cartDrawer.setAttribute("aria-hidden", "false");
});
els.closeCart?.addEventListener("click", () => {
  els.cartDrawer.classList.add("hidden");
  els.cartDrawer.setAttribute("aria-hidden", "true");
});

// ------- DATA
async function loadStores() {
  try {
    const r = await fetch(`${API}/api/stores`);
    const data = await r.json();
    renderStores(data.stores || []);
  } catch (e) {
    console.error("Error cargando stores:", e);
  }
}

async function loadProducts() {
  try {
    const url = new URL(`${API}/api/products`);
    if (currentStoreId) url.searchParams.set("store_id", currentStoreId);
    const r = await fetch(url);
    const data = await r.json();
    productsCache = data.products || [];
    renderProducts(productsCache);
  } catch (e) {
    console.error("Error cargando products:", e);
  }
}

// ------- INIT
document.addEventListener("DOMContentLoaded", () => {
  drawCart();
  loadStores();
  loadProducts();
});


/* ==========================
   Página: Login / Signup
========================== */
function bootAuthPage() {
  const loginForm  = $("#loginForm");
  const signupForm = $("#signupForm");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const email = fd.get("email");
    const password = fd.get("password");

    try {
      const data = await api.login(email, password);
      if (data?.token) setAuth({ token: data.token, user: data.user });
      const role = data?.user?.role || (data?.user?.is_admin ? "admin" : "buyer");

      if (role === "seller")      window.location.href = "seller.html";
      else if (role === "admin")  window.location.href = "admin.html";
      else                        window.location.href = "inicio.html"; // 👈 aquí
    } catch (e1) {
      console.error(e1);
      alert("Credenciales inválidas");
    }
  });

  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(signupForm);
    const payload = {
      name:     fd.get("name"),
      email:    fd.get("email"),
      password: fd.get("password"),
      phone:    fd.get("phone") || null
    };
    try {
      const data = await api.signup(payload);
      if (payload.email && payload.password) {
        const autologin = await api.login(payload.email, payload.password);
        if (autologin?.token) setAuth({ token: autologin.token, user: autologin.user });
        const role = autologin?.user?.role || (autologin?.user?.is_admin ? "admin" : "buyer");
        if (role === "seller")     window.location.href = "seller.html";
        else if (role === "admin") window.location.href = "admin.html";
        else                       window.location.href = "inicio.html"; // 👈 aquí
      } else {
        window.location.href = "inicio.html"; // 👈 aquí
      }
    } catch (e1) {
      console.error(e1);
      alert("No se pudo crear la cuenta");
    }
  });
}


/* ==========================
   Página: Seller
========================== */
function bootSellerPage() {
  const productsGrid = $("#sellerProducts");
  const ordersBox    = $("#sellerOrders");
  const newProdForm  = $("#newProductForm");

  async function refreshProducts() {
    productsGrid && (productsGrid.innerHTML = `<div class="muted">Cargando…</div>`);
    try {
      const list = await api.seller.mineProducts();
      if (!productsGrid) return;
      productsGrid.innerHTML = "";
      if (!list.length) {
        productsGrid.innerHTML = `<div class="muted">Aún no tienes productos.</div>`;
        return;
      }
      for (const p of list) {
        const title = p.title || p.name || "Producto";
        const price = Number(p.price_xaf ?? p.price ?? 0);
        const img = p.image_url || "https://via.placeholder.com/300x200?text=Producto";
        const card = document.createElement("div");
        card.className = "product";
        card.innerHTML = `
          <img src="${img}" alt="${title}">
          <div class="title">${title}</div>
          <div class="price">${currency(price)}</div>
        `;
        productsGrid.appendChild(card);
      }
    } catch (e) {
      console.error(e);
      productsGrid && (productsGrid.innerHTML = `<div class="error">Error cargando tus productos</div>`);
    }
  }

  async function refreshOrders() {
    ordersBox && (ordersBox.innerHTML = `<div class="muted">Cargando pedidos…</div>`);
    try {
      const orders = await api.seller.orders();
      if (!ordersBox) return;
      if (!orders.length) {
        ordersBox.innerHTML = `<div class="muted">Sin pedidos por ahora.</div>`;
        return;
      }

      const tbl = document.createElement("table");
      tbl.className = "orders";
      tbl.innerHTML = `
        <thead>
          <tr>
            <th>ID</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th><th>Entrega</th><th>Estado</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      for (const o of orders) {
        const tr = document.createElement("tr");
        const when = (o.created_at || "").replace("T", " ").slice(0, 16);
        const buyer = o.guest_name || o.customer_name || "-";
        const itemsTxt = (o.items || []).map(i => `${i.title} × ${i.qty}`).join(", ");
        tr.innerHTML = `
          <td>${o.id}</td>
          <td>${when}</td>
          <td>${buyer}</td>
          <td>${itemsTxt}</td>
          <td>${currency(o.total_xaf ?? o.subtotal_xaf)}</td>
          <td>${String(o.fulfillment_type || "").toUpperCase()}</td>
          <td><span class="badge">${o.status}</span></td>
          <td class="actions">
            <button class="act ready">Ready to Pick up</button>
            <button class="act delivered">Delivered</button>
            <button class="act canceled">Cancelled</button>
          </td>
        `;
        // Wiring acciones
        $(".ready", tr)?.addEventListener("click", async () => {
          await changeStatus(o.id, "READY_TO_PICKUP");
        });
        $(".delivered", tr)?.addEventListener("click", async () => {
          await changeStatus(o.id, "DELIVERED");
        });
        $(".canceled", tr)?.addEventListener("click", async () => {
          await changeStatus(o.id, "CANCELLED");
        });
        $("tbody", tbl).appendChild(tr);
      }

      ordersBox.innerHTML = "";
      ordersBox.appendChild(tbl);
    } catch (e) {
      console.error(e);
      ordersBox && (ordersBox.innerHTML = `<div class="error">Error cargando pedidos</div>`);
    }
  }

  async function changeStatus(orderId, status) {
    try {
      await api.seller.setOrderStatus(orderId, status);
      toast(`Estado actualizado: ${status}`);
      await refreshOrders();
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el estado");
    }
  }

  newProdForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(newProdForm);
    const payload = {
      name: fd.get("title") || fd.get("name") || "",
      price_xaf: fd.get("price_xaf") || fd.get("price") || "",
      stock: fd.get("stock") || 0,
      image_url: fd.get("image_url") || null,
      category: fd.get("category") || null,
      description: fd.get("description") || null
    };
    try {
      await api.seller.createProduct(payload);
      newProdForm.reset();
      toast("Producto creado");
      await refreshProducts();
    } catch (e1) {
      console.error(e1);
      alert("No se pudo crear el producto");
    }
  });

  refreshProducts();
  refreshOrders();
}

/* ==========================
   Página: Admin
========================== */
function bootAdminPage() {
  const usersWrap = $("#usersTable");
  const form = $("#createSellerForm");
  const refreshBtn = $("#refreshUsers");

  async function renderUsers() {
    usersWrap && (usersWrap.innerHTML = "Cargando…");
    try {
      const list = await api.admin.users();
      if (!usersWrap) return;
      const tbl = document.createElement("table");
      tbl.innerHTML = `<thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Tienda</th></tr></thead><tbody></tbody>`;
      for (const u of list) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.name || "-"}</td>
          <td>${u.email || "-"}</td>
          <td>${u.role || (u.is_admin ? "admin" : "buyer")}</td>
          <td>${u.store_name || u.store?.name || "-"}</td>
        `;
        $("tbody", tbl).appendChild(tr);
      }
      usersWrap.innerHTML = "";
      usersWrap.appendChild(tbl);
    } catch (e) {
      console.error(e);
      usersWrap && (usersWrap.innerHTML = `<div class="error">No se pudieron cargar los usuarios</div>`);
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      password: fd.get("password"),
      phone: fd.get("phone"),
      store_name: fd.get("store_name")
    };
    try {
      await api.admin.createSeller(payload);
      toast("Vendedor creado");
      form.reset();
      renderUsers();
    } catch (e1) {
      console.error(e1);
      alert("No se pudo crear el vendedor");
    }
  });

  refreshBtn?.addEventListener("click", renderUsers);
  renderUsers();
}



/* ======= WapMarket Secure Route & Ordering Guard (append-only) ======= */
(function SecureGuard(){
  // --- helpers de sesión compatibles ---
  function sg_get(keyList) {
    for (var i=0;i<keyList.length;i++){
      try {
        var v = localStorage.getItem(keyList[i]);
        if (v) return v;
      } catch {}
    }
    return null;
  }
  function sg_getJSON(keyList){
    var raw = sg_get(keyList);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function sg_parseJwt(token){
    try {
      var base = token.split(".")[1];
      base = base.replace(/-/g, "+").replace(/_/g, "/");
      var json = atob(base);
      return JSON.parse(json);
    } catch { return null; }
  }
  function sg_session(){
    var token = sg_get(["wap_token","wp_token","token","auth_token"]);
    var user  = sg_getJSON(["wap_user","wp_user","user"]);
    var payload = token ? sg_parseJwt(token) : null;
    return { token: token || null, user: user, payload };
  }
  function sg_role(u, p){
    // prioridad: user.role -> payload.role -> flags (user/payload)
    if (u && u.role) return u.role;
    if (p && p.role) return p.role;
    if ((u && (u.is_admin || u.isAdmin)) || (p && (p.is_admin || p.isAdmin))) return "admin";
    if ((u && (u.is_seller || u.isSeller)) || (p && (p.is_seller || p.isSeller))) return "seller";
    return u ? "buyer" : "guest";
  }
  function sg_canOrder(u,p){
    var r = sg_role(u,p);
    return r === "guest" || r === "buyer";
  }

  // --- redirecciones inmediatas por rol ---
  try {
    var sess = sg_session();
    var role = sg_role(sess.user, sess.payload);
    var file = (location.pathname.split("/").pop() || "index.html").toLowerCase();

    if (role === "admin" && file !== "admin.html") {
      location.replace("admin.html"); return;
    }
    if (role === "seller" && file !== "seller.html") {
      location.replace("seller.html"); return;
    }
    if (role === "buyer" && (file === "admin.html" || file === "seller.html")) {
      location.replace("inicio.html"); return;
    }
    if (role === "guest" && (file === "admin.html" || file === "seller.html")) {
      location.replace("login.html"); return;
    }
  } catch {}

  // --- topbar coherente si se cuela en index ---
  document.addEventListener("DOMContentLoaded", function(){
    try {
      var sess = sg_session();
      var role = sg_role(sess.user, sess.payload);
      var nav = document.querySelector(".nav");
      if (!nav) return;

      // Oculta "Entrar" si hay sesión
      var loginLink = nav.querySelector("a[href='login.html']");
      if (sess.user && loginLink) loginLink.style.display = "none";

      // Limpia restos
      var oldGreet = nav.querySelector(".user-greeting");
      if (oldGreet) oldGreet.remove();

      if (role === "seller") {
        var a = document.createElement("a"); a.href="seller.html"; a.className="user-greeting"; a.textContent="Panel Vendedor";
        nav.prepend(a);
      } else if (role === "admin") {
        var b = document.createElement("a"); b.href="admin.html"; b.className="user-greeting"; b.textContent="Panel Admin";
        nav.prepend(b);
      } else if (role === "buyer") {
        var name = (sess.user && (sess.user.name || sess.user.email)) || "Cliente";
        var s = document.createElement("span"); s.className="user-greeting"; s.textContent="Hola, " + name;
        nav.prepend(s);
      }
    } catch {}
  });

  // --- Interceptar acciones de compra a nivel documento ---
  document.addEventListener("click", function(e){
    try {
      // Botón Abrir Checkout
      if (e.target.closest && e.target.closest("#checkoutOpen")) {
        var sess = sg_session();
        if (!sg_canOrder(sess.user, sess.payload)) {
          e.preventDefault(); e.stopPropagation();
          alert("Solo clientes o invitados pueden realizar pedidos.");
        }
      }
      // Botones de añadir al carrito (comunes)
      if (e.target.matches(".p-add, .add-to-cart, .product-card .p-add, .btn-add-cart")) {
        var sess2 = sg_session();
        if (!sg_canOrder(sess2.user, sess2.payload)) {
          e.preventDefault(); e.stopPropagation();
          alert("Solo clientes o invitados pueden realizar pedidos.");
        }
      }
    } catch {}
  }, true);

  // --- Interceptar submit del checkout ---
  document.addEventListener("submit", function(e){
    try {
      var form = e.target;
      if (form && form.id === "checkoutForm") {
        var sess = sg_session();
        if (!sg_canOrder(sess.user, sess.payload)) {
          e.preventDefault(); e.stopPropagation();
          alert("Solo clientes o invitados pueden realizar pedidos.");
        }
      }
    } catch {}
  }, true);
})();
/* ======= Fin Secure Guard ======= */
