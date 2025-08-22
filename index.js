/* app.js — WapMarket frontend conectado al backend Express+Postgres
   - Login/Registro con roles
   - Listado de negocios y filtrado de productos por negocio
   - Carrito (guest) con cierre al clicar fuera o al vaciar
   - Checkout con mini-factura
   - Seller dashboard: productos, pedidos y acciones de estado
   - Admin: crear vendedor y ver usuarios
*/

const API_BASE = "https://backend-wapmarket-production.up.railway.app/api";

/* =================== Utils =================== */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// Busca el primer selector que exista
function q(selectors, ctx = document) {
  for (const s of selectors) {
    const el = ctx.querySelector(s);
    if (el) return el;
  }
  return null;
}

function getAuth() {
  const token = localStorage.getItem("wap_token") || null;
  let user = null;
  try { user = JSON.parse(localStorage.getItem("wap_user") || "null"); } catch {}
  return { token, user };
}
function setAuth(token, user) {
  if (token) localStorage.setItem("wap_token", token);
  if (user) localStorage.setItem("wap_user", JSON.stringify(user));
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

async function jfetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  // algunos endpoints devuelven vacío (204) o texto
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

function moneyXAF(n) {
  return Number(n || 0).toLocaleString() + " XAF";
}

/* =================== Carrito (guest) =================== */
function loadCart() {
  try { return JSON.parse(localStorage.getItem("wap_cart") || "[]"); } catch { return []; }
}
function saveCart(items) {
  localStorage.setItem("wap_cart", JSON.stringify(items));
  updateCartCount();
}
function clearCart() {
  saveCart([]);
  renderCart(); // para que se cierre si queda vacío
}
function addToCart(product) {
  const items = loadCart();
  const idx = items.findIndex(i => i.id === product.id);
  if (idx >= 0) items[idx].qty += 1;
  else items.push({
    id: product.id,
    title: product.title || product.name,
    price_xaf: Number(product.price_xaf ?? product.price ?? 0),
    image_url: product.image_url || null,
    qty: 1
  });
  saveCart(items);
}
function updateCartCount() {
  const el = q(["#cartCount", ".cart-count"]);
  if (el) el.textContent = loadCart().reduce((s, i) => s + i.qty, 0);
}
function cartSubtotal() {
  return loadCart().reduce((s, i) => s + Number(i.price_xaf || 0) * Number(i.qty || 0), 0);
}

/* =================== API client =================== */
const api = {
  // Auth
  async login(email, password) {
    return await jfetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password })
    });
  },
  async signup(payload) {
    // tu backend acepta /api/auth/signup y /api/register
    try {
      return await jfetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
    } catch {
      return await jfetch(`${API_BASE}/register`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
    }
  },
  async profile() {
    return await jfetch(`${API_BASE}/profile`, { headers: authHeaders() });
  },

  // Stores
  async stores() {
    // devuelve {stores:[...]}
    try {
      const d = await jfetch(`${API_BASE}/stores`);
      return Array.isArray(d) ? d : (d.stores || []);
    } catch {
      const d = await jfetch(`${API_BASE}/businesses`);
      return Array.isArray(d) ? d : (d.stores || []);
    }
  },

  // Products
  async products(params = {}) {
    const url = new URL(`${API_BASE}/products`);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
    const d = await jfetch(url.toString());
    return Array.isArray(d) ? d : (d.products || []);
  },

  // Orders (guest or auth)
  async createOrder(payload) {
    return await jfetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
  },

  // Seller
  seller: {
    async products() {
      const d = await jfetch(`${API_BASE}/seller/products`, { headers: authHeaders() });
      return Array.isArray(d) ? d : (d.products || []);
    },
    async createProduct(payload) {
      return await jfetch(`${API_BASE}/seller/products`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
    },
    async orders() {
      const d = await jfetch(`${API_BASE}/seller/orders`, { headers: authHeaders() });
      return Array.isArray(d) ? d : (d.orders || []);
    },
    async setOrderStatus(orderId, status) {
      return await jfetch(`${API_BASE}/seller/orders/${orderId}/status`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
    }
  },

  // Admin
  admin: {
    async users() {
      const d = await jfetch(`${API_BASE}/admin/users`, { headers: authHeaders() });
      return Array.isArray(d) ? d : (d.users || []);
    },
    async createSeller(payload) {
      return await jfetch(`${API_BASE}/admin/create-seller`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
    }
  }
};

/* =================== Render helpers (Index) =================== */
function renderStores(stores) {
  const container = q(["#businessesSection", "#storesList", ".businesses"]);
  if (!container) return;
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "business-list";

  const allBtn = document.createElement("button");
  allBtn.className = "store-pill active";
  allBtn.textContent = "Todos";
  allBtn.dataset.storeId = "";
  wrap.appendChild(allBtn);

  for (const s of stores) {
    const pill = document.createElement("button");
    pill.className = "store-pill";
    pill.textContent = s.name || `Tienda ${s.id}`;
    pill.dataset.storeId = s.id;
    wrap.appendChild(pill);
  }
  container.appendChild(wrap);
}

function renderProducts(list) {
  const container = q(["#productsList", ".products-grid", "#productosGrid"]);
  if (!container) return;
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `<div class="muted">No hay productos disponibles.</div>`;
    return;
  }

  for (const p of list) {
    const title = p.title || p.name || "Producto";
    const price = Number(p.price_xaf ?? p.price ?? 0);
    const img = p.image_url || "https://via.placeholder.com/320x210?text=Producto";
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img class="product-img" src="${img}" alt="${title}">
      <div class="product-info">
        <div class="product-title">${title}</div>
        <div class="product-price">${moneyXAF(price)}</div>
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

function renderCart() {
  const drawer = q(["#cartDrawer", ".cart-drawer"]);
  const itemsEl = q(["#cartItems", ".cart-items"]);
  const subtotalEl = q(["#subtotalXAF", ".subtotal-xaf"]);
  if (!itemsEl) return;

  const items = loadCart();
  itemsEl.innerHTML = "";

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <img class="thumb" src="${it.image_url || "https://via.placeholder.com/64"}" alt="">
      <div class="cart-row-info">
        <div class="title">${it.title}</div>
        <div class="tiny">${moneyXAF(it.price_xaf)} × ${it.qty}</div>
      </div>
      <div class="cart-row-actions">
        <button class="minus" aria-label="menos">−</button>
        <span class="q">${it.qty}</span>
        <button class="plus" aria-label="más">+</button>
        <button class="remove" aria-label="quitar">✕</button>
      </div>
    `;
    $(".minus", row).onclick = () => { it.qty = Math.max(1, it.qty - 1); saveCart(items); renderCart(); };
    $(".plus", row).onclick = () => { it.qty += 1; saveCart(items); renderCart(); };
    $(".remove", row).onclick = () => {
      const left = items.filter(x => x.id !== it.id);
      saveCart(left);
      renderCart();
    };
    itemsEl.appendChild(row);
  }

  if (subtotalEl) subtotalEl.textContent = cartSubtotal().toLocaleString();

  // Si se vacía el carrito → cerrar drawer y (si está) modal de checkout
  if (!items.length) {
    const checkoutModal = q(["#checkoutModal", ".checkout-modal"]);
    if (drawer) drawer.classList.add("hidden");
    if (checkoutModal) checkoutModal.classList.add("hidden");
  }
}

function updateCheckoutSummary() {
  const subtotal = cartSubtotal();
  const fType = q(["#fulfillmentType"]);
  const delivery = (fType && fType.value === "delivery") ? 2000 : 0;
  const coSubtotal = q(["#coSubtotal", ".co-subtotal"]);
  const coDelivery = q(["#coDelivery", ".co-delivery"]);
  const coTotal = q(["#coTotal", ".co-total"]);
  if (coSubtotal) coSubtotal.textContent = subtotal.toLocaleString();
  if (coDelivery) coDelivery.textContent = delivery.toLocaleString();
  if (coTotal) coTotal.textContent = (subtotal + delivery).toLocaleString();
}

/* =================== Toaster simple =================== */
let toastTimer = null;
function toast(msg) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "24px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "10px 14px";
    el.style.background = "rgba(0,0,0,.8)";
    el.style.color = "#fff";
    el.style.borderRadius = "8px";
    el.style.fontSize = "14px";
    el.style.zIndex = "10000";
    el.style.opacity = "0";
    el.style.transition = "opacity .2s ease";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.opacity = "0"), 1600);
}

/* =================== Bootstraps por página =================== */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();

  const isIndex = !!q(["#productsList", ".products-grid", "#checkoutForm"]);
  const isLogin = !!q(["#loginForm", "#signupForm"]);
  const isSeller = !!q(["#sellerProducts", "#sellerOrders", "#newProductForm"]);
  const isAdmin = !!q(["#createSellerForm", "#usersTable"]);

  if (isIndex) bootIndex();
  if (isLogin) bootLogin();
  if (isSeller) bootSeller();
  if (isAdmin) bootAdmin();
});

/* =================== INDEX =================== */
async function bootIndex() {
  const productsContainer = q(["#productsList", ".products-grid"]);
  const searchInput = q(["#searchInput"]);
  const searchBtn = q(["#searchBtn"]);
  const minPrice = q(["#minPriceFilter"]);
  const maxPrice = q(["#maxPriceFilter"]);
  const categorySel = q(["#categoryFilter"]);
  const cartBtn = q(["#cartBtn", ".cart-btn"]);
  const cartDrawer = q(["#cartDrawer", ".cart-drawer"]);
  const closeCartBtn = q(["#closeCart", ".close-cart"]);
  const checkoutOpen = q(["#checkoutOpen", ".checkout-open"]);
  const checkoutModal = q(["#checkoutModal", ".checkout-modal"]);
  const closeCheckout = q(["#closeCheckout", ".close-checkout"]);
  const fulfillmentType = q(["#fulfillmentType"]);

  let allProducts = [];
  let allStores = [];
  let selectedStoreId = "";

  // Cargar stores + productos
  try {
    [allStores, allProducts] = await Promise.all([api.stores(), api.products()]);
  } catch (e) {
    console.error(e);
  }
  renderStores(allStores);
  renderProducts(allProducts);

  // Click en tiendas (pills)
  document.addEventListener("click", async (e) => {
    const pill = e.target.closest(".store-pill");
    if (!pill) return;
    $$(".store-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    selectedStoreId = pill.dataset.storeId || "";
    try {
      const list = await api.products(selectedStoreId ? { store_id: selectedStoreId } : {});
      // aplicar filtros actuales locales
      renderProducts(applyLocalFilters(list));
    } catch (err) {
      console.error(err);
    }
  });

  // Filtros locales (texto, precio, categoría)
  const applyLocalFilters = (list) => {
    const qText = (searchInput?.value || "").toLowerCase().trim();
    const min = Number(minPrice?.value || 0);
    const max = Number(maxPrice?.value || 999999999);
    const cat = (categorySel?.value || "").toLowerCase();

    return list.filter(p => {
      const t = (p.title || p.name || "").toLowerCase();
      const price = Number(p.price_xaf ?? p.price ?? 0);
      const c = (p.category || "").toLowerCase();
      return (!qText || t.includes(qText)) && price >= min && price <= max && (!cat || c === cat);
    });
  };

  function reRenderWithFilters() {
    api.products(selectedStoreId ? { store_id: selectedStoreId } : {})
      .then((list) => renderProducts(applyLocalFilters(list)))
      .catch(console.error);
  }

  if (searchBtn) searchBtn.addEventListener("click", reRenderWithFilters);
  if (searchInput) searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") reRenderWithFilters(); });
  if (minPrice) minPrice.addEventListener("change", reRenderWithFilters);
  if (maxPrice) maxPrice.addEventListener("change", reRenderWithFilters);
  if (categorySel) categorySel.addEventListener("change", reRenderWithFilters);

  // Drawer carrito — abrir/cerrar
  if (cartBtn) cartBtn.onclick = () => { renderCart(); cartDrawer?.classList.remove("hidden"); };
  if (closeCartBtn) closeCartBtn.onclick = () => cartDrawer?.classList.add("hidden");

  // Cerrar carrito al clicar fuera
  document.addEventListener("click", (e) => {
    if (!cartDrawer || cartDrawer.classList.contains("hidden")) return;
    const panel = cartDrawer.querySelector(".drawer-panel") || cartDrawer.firstElementChild;
    if (!panel) return;
    const clickedInside = panel.contains(e.target);
    const clickedButton = e.target.closest("#cartBtn,.cart-btn");
    if (!clickedInside && !clickedButton) {
      cartDrawer.classList.add("hidden");
    }
  });
  // Escape cierra drawer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cartDrawer?.classList.add("hidden");
  });

  // Checkout modal
  if (checkoutOpen) checkoutOpen.onclick = () => { renderCart(); checkoutModal?.classList.remove("hidden"); updateCheckoutSummary(); };
  if (closeCheckout) closeCheckout.onclick = () => checkoutModal?.classList.add("hidden");
  if (fulfillmentType) fulfillmentType.onchange = updateCheckoutSummary;

  // Cerrar checkout al clicar fuera
  document.addEventListener("click", (e) => {
    if (!checkoutModal || checkoutModal.classList.contains("hidden")) return;
    const panel = checkoutModal.querySelector(".modal-panel") || checkoutModal.firstElementChild;
    if (!panel) return;
    const inside = panel.contains(e.target);
    const openBtn = e.target.closest("#checkoutOpen,.checkout-open");
    if (!inside && !openBtn) {
      checkoutModal.classList.add("hidden");
    }
  });

  // Submit checkout
  const checkoutForm = q(["#checkoutForm"]);
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const items = loadCart();
      if (!items.length) { alert("Tu carrito está vacío"); return; }

      const fd = new FormData(checkoutForm);
      const payload = {
        items: items.map(i => ({ product_id: i.id, quantity: i.qty })),
        fulfillment_type: fd.get("fulfillment_type") || "pickup",
        address: fd.get("address") || null,
        guest_name: fd.get("guest_name") || null,
        guest_phone: fd.get("guest_phone") || null
      };

      try {
        const res = await api.createOrder(payload);
        // mini-factura basada en el carrito local + datos del backend (id, total, estado)
        showInvoice({
          order_id: res?.order_id || res?.order?.id,
          status: res?.order?.status || "CREATED",
          fulfillment_type: res?.order?.fulfillment_type || payload.fulfillment_type,
          created_at: res?.order?.created_at || new Date().toISOString(),
          items,
          delivery_fee: payload.fulfillment_type === "delivery" ? 2000 : 0,
          total_xaf: res?.order?.total_xaf ?? (cartSubtotal() + (payload.fulfillment_type === "delivery" ? 2000 : 0))
        });
        clearCart();
        checkoutForm.reset();
      } catch (err) {
        console.error(err);
        alert("No se pudo completar el pedido.");
      }
    });
  }
}

/* =================== Mini-Factura =================== */
function showInvoice({ order_id, status, fulfillment_type, created_at, items, delivery_fee, total_xaf }) {
  let modal = $("#invoiceModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "invoiceModal";
    modal.className = "invoice-modal";
    modal.innerHTML = `
      <div class="invoice-panel">
        <div class="invoice-header">
          <h3>Factura</h3>
          <button id="closeInvoice" aria-label="cerrar">✕</button>
        </div>
        <div class="invoice-body"></div>
        <div class="invoice-footer">
          <button id="printInvoice">Imprimir</button>
          <button id="okInvoice">Aceptar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    $("#closeInvoice").onclick = () => modal.classList.add("hidden");
    $("#okInvoice").onclick = () => modal.classList.add("hidden");
    $("#printInvoice").onclick = () => window.print();
    // cerrar clic fuera
    modal.addEventListener("click", (e) => {
      const panel = modal.querySelector(".invoice-panel");
      if (panel && !panel.contains(e.target)) modal.classList.add("hidden");
    });
  }

  const body = modal.querySelector(".invoice-body");
  const rows = items.map(i => `
    <tr>
      <td>${i.title}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">${moneyXAF(i.price_xaf)}</td>
      <td style="text-align:right">${moneyXAF(i.price_xaf * i.qty)}</td>
    </tr>
  `).join("");

  const subtotal = items.reduce((s, i) => s + i.price_xaf * i.qty, 0);
  body.innerHTML = `
    <div class="invoice-meta">
      <div><strong>Pedido:</strong> ${order_id ?? "-"}</div>
      <div><strong>Fecha:</strong> ${new Date(created_at).toLocaleString()}</div>
      <div><strong>Estado:</strong> ${status}</div>
      <div><strong>Modo:</strong> ${fulfillment_type}</div>
    </div>
    <table class="invoice-table">
      <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">${moneyXAF(subtotal)}</td></tr>
        <tr><td colspan="3" style="text-align:right">Envío</td><td style="text-align:right">${moneyXAF(delivery_fee || 0)}</td></tr>
        <tr><td colspan="3" style="text-align:right"><strong>Total</strong></td><td style="text-align:right"><strong>${moneyXAF(total_xaf)}</strong></td></tr>
      </tfoot>
    </table>
  `;

  modal.classList.remove("hidden");
}

/* =================== LOGIN / SIGNUP =================== */
function bootLogin() {
  const loginForm = $("#loginForm");
  const signupForm = $("#signupForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const email = fd.get("email");
      const password = fd.get("password");
      try {
        const data = await api.login(email, password);
        if (data?.token) setAuth(data.token, data.user);
        const role = data?.user?.role || (data?.user?.is_admin ? "admin" : "buyer");
        routeByRole(role);
      } catch (err) {
        console.error(err);
        alert("Credenciales inválidas");
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(signupForm);
      const payload = {
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        password: fd.get("password"),
        role: "buyer"
      };
      try {
        const data = await api.signup(payload);
        // algunos endpoints de signup no devuelven token: refrescamos login
        if (data?.token) setAuth(data.token, data.user);
        else toast("Cuenta creada, inicia sesión");
        // si quieres auto-login aquí, llama a api.login(payload.email, payload.password)
        window.location.href = "login.html";
      } catch (err) {
        console.error(err);
        alert("No se pudo crear la cuenta");
      }
    });
  }
}

function routeByRole(role) {
  if (role === "seller") window.location.href = "seller.html";
  else if (role === "admin") window.location.href = "admin.html";
  else window.location.href = "index.html";
}

/* =================== SELLER =================== */
async function bootSeller() {
  const productsGrid = $("#sellerProducts");
  const ordersBox = $("#sellerOrders");
  const form = $("#newProductForm");

  async function refreshProducts() {
    try {
      const list = await api.seller.products();
      productsGrid.innerHTML = "";
      if (!list.length) {
        productsGrid.innerHTML = `<div class="muted">Aún no tienes productos.</div>`;
        return;
      }
      for (const p of list) {
        const title = p.title || p.name || "Producto";
        const price = Number(p.price_xaf ?? p.price ?? 0);
        const img = p.image_url || "https://via.placeholder.com/320x210?text=Producto";
        const card = document.createElement("div");
        card.className = "product";
        card.innerHTML = `
          <img src="${img}" alt="${title}">
          <div class="title">${title}</div>
          <div class="price">${moneyXAF(price)}</div>
        `;
        productsGrid.appendChild(card);
      }
    } catch (e) {
      console.error(e);
      productsGrid.innerHTML = `<div class="error">Error cargando tus productos</div>`;
    }
  }

  async function refreshOrders() {
    try {
      const list = await api.seller.orders();
      ordersBox.innerHTML = "";
      if (!list.length) {
        ordersBox.innerHTML = `<div class="muted">Sin pedidos por ahora.</div>`;
        return;
      }
      const tbl = document.createElement("table");
      tbl.className = "orders-table";
      tbl.innerHTML = `
        <thead>
          <tr>
            <th>ID</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Items</th><th>Total</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      for (const o of list) {
        const tr = document.createElement("tr");
        const when = o.created_at ? new Date(o.created_at).toLocaleString() : "";
        const buyer = o.guest_name || o.customer_name || "";
        const itemsTxt = (o.items || []).map(i => `${i.title || i.name} × ${i.qty || i.quantity}`).join(", ");
        tr.innerHTML = `
          <td>${o.id}</td>
          <td>${when}</td>
          <td>${buyer}</td>
          <td>${o.fulfillment_type || ""}</td>
          <td><span class="badge">${o.status}</span></td>
          <td>${itemsTxt}</td>
          <td>${moneyXAF(o.total_xaf || o.total)}</td>
          <td class="actions">
            <button class="btn tiny ready">Ready to Pick up</button>
            <button class="btn tiny delivered">Delivered</button>
            <button class="btn tiny cancel">Cancel</button>
          </td>
        `;
        $(".ready", tr).onclick = async () => { await setStatus(o.id, "READY_TO_PICKUP"); };
        $(".delivered", tr).onclick = async () => { await setStatus(o.id, "DELIVERED"); };
        $(".cancel", tr).onclick = async () => { await setStatus(o.id, "CANCELLED"); };
        $("tbody", tbl).appendChild(tr);
      }
      ordersBox.appendChild(tbl);
    } catch (e) {
      console.error(e);
      ordersBox.innerHTML = `<div class="error">Error cargando pedidos</div>`;
    }
  }

  async function setStatus(orderId, status) {
    try {
      await api.seller.setOrderStatus(orderId, status);
      toast("Estado actualizado");
      await refreshOrders();
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el estado");
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        title: fd.get("title") || fd.get("name"),
        price_xaf: fd.get("price_xaf") || fd.get("price"),
        stock: fd.get("stock") || fd.get("quantity") || 0,
        image_url: fd.get("image_url") || fd.get("image") || null,
        category: fd.get("category") || null,
        active: true
      };
      try {
        await api.seller.createProduct(payload);
        toast("Producto creado");
        form.reset();
        await refreshProducts();
      } catch (e1) {
        console.error(e1);
        alert("No se pudo crear el producto");
      }
    });
  }

  await refreshProducts();
  await refreshOrders();
}

/* =================== ADMIN =================== */
function bootAdmin() {
  const form = $("#createSellerForm");
  const usersWrap = $("#usersTable");
  const refreshBtn = $("#refreshUsers");

  async function renderUsers() {
    usersWrap.innerHTML = "Cargando...";
    try {
      const list = await api.admin.users();
      const tbl = document.createElement("table");
      tbl.className = "users-table";
      tbl.innerHTML = `
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Tienda</th></tr></thead>
        <tbody></tbody>
      `;
      for (const u of list) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.name || ""}</td>
          <td>${u.email || ""}</td>
          <td>${u.role || (u.is_admin ? "admin" : "buyer")}</td>
          <td>${u.store?.name || u.store_name || ""}</td>
        `;
        $("tbody", tbl).appendChild(tr);
      }
      usersWrap.innerHTML = "";
      usersWrap.appendChild(tbl);
    } catch (e) {
      console.error(e);
      usersWrap.innerHTML = `<div class="error">No se pudieron cargar los usuarios</div>`;
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password"),
        phone: fd.get("phone"),
        store_name: fd.get("store_name"),
        city: fd.get("city"),
        description: fd.get("description")
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
  }

  if (refreshBtn) refreshBtn.onclick = renderUsers;
  renderUsers();
}

/* =================== (Opcional) Logout botón genérico =================== */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-logout]");
  if (!btn) return;
  e.preventDefault();
  clearAuth();
  window.location.href = "index.html";
});
