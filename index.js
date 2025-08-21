// WapMarket Backend – Express + PostgreSQL (Railway)
// Endpoints compatibles con el frontend actual (stores, products, auth, admin, seller, orders)

const express = require("express");
const cors = require("cors"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

const multer = require("multer");
const sharp = require("sharp");

// Configuración de multer (máx 5 MB en memoria, validamos después)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });


// ================== CONFIG ==================
const JWT_SECRET = process.env.JWT_SECRET || "clave-secreta-super-segura";
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================== DB INIT ==================
async function initDb() {
  // Tabla usuarios (compat con roles y datos que requiere el front)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'buyer', -- buyer | seller | admin
      is_admin BOOLEAN DEFAULT false, -- legado
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tiendas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id INT REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Productos (campos que espera el front)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      price_xaf INT NOT NULL,
      store_id INT REFERENCES stores(id) ON DELETE CASCADE,
      stock INT DEFAULT 0,
      image_url TEXT,
      category TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  //imagenes
   await pool.query(`
    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      data BYTEA NOT NULL,
      mime TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


  // Pedidos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      store_id INT REFERENCES stores(id) ON DELETE SET NULL,
      buyer_user_id INT REFERENCES users(id) ON DELETE SET NULL,
      guest_name TEXT,
      guest_phone TEXT,
      address TEXT,
      fulfillment_type TEXT DEFAULT 'pickup', -- pickup | delivery
      status TEXT DEFAULT 'CREATED', -- CREATED, PAID, FULFILLING, READY_FOR_PICKUP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
      subtotal_xaf INT DEFAULT 0,
      total_xaf INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Items del pedido
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      title TEXT,
      unit_price_xaf INT NOT NULL,
      qty INT NOT NULL
    );
  `);
}


// Admin por defecto sin demo store ni productos
async function seed() {
  const adminEmail = "admin@wapmarket.com";
  const adminPass = "admin123";

  const { rows } = await pool.query("SELECT id FROM users WHERE email=$1", [adminEmail]);
  if (!rows.length) {
    const passwordHash = await bcrypt.hash(adminPass, 10);
    await pool.query(
      "INSERT INTO users (name,email,phone,password_hash,role,is_admin) VALUES ($1,$2,$3,$4,$5,$6)",
      ["Admin", adminEmail, null, passwordHash, "admin", true]
    );
    console.log(`✅ Admin creado: ${adminEmail} / ${adminPass}`);
  } else {
    console.log("⚡ Admin ya existe.");
  }
}


// ================== AUTH ==================
function authRequired(req, res, next) {
  const auth = req.headers["authorization"];
  if (!auth) return res.status(401).json({ error: "No token provided" });
  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, name }
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: "Not authorized" });
    next();
  };
}

// Signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email y password requeridos" });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,phone,role,created_at",
      [name || null, email, phone || null, hash, role || "buyer"]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name || "" }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user });
  } catch (e) {
    res.status(400).json({ error: "Email ya registrado" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email y password requeridos" });
  const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  const user = rows[0];
  if (!user) return res.status(400).json({ error: "Usuario no encontrado" });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: "Contraseña incorrecta" });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name || "" }, JWT_SECRET, { expiresIn: "7d" });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name || "",
      email: user.email,
      role: user.role,
      phone: user.phone || null,
      created_at: user.created_at
    }
  });
});
// Subir imagen de producto
app.post("/api/products/:id/image", authRequired, requireRole("seller", "admin"), upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Optimizar imagen a formato webp y limitar tamaño
    const optimized = await sharp(req.file.buffer)
      .resize(800, 800, { fit: "inside" }) // máximo 800x800
      .webp({ quality: 80 }) // formato webp comprimido
      .toBuffer();

    if (optimized.length > 1 * 1024 * 1024) {
      return res.status(400).json({ error: "Image too large after compression (max 1MB)" });
    }

    // Guardar en la BD
    await pool.query("INSERT INTO product_images (product_id, data, mime) VALUES ($1, $2, $3)", [
      req.params.id,
      optimized,
      "image/webp"
    ]);

    res.json({ success: true, message: "Image uploaded" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error uploading image" });
  }
});

// Servir imagen de producto
app.get("/api/products/:id/image", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT data, mime FROM product_images WHERE product_id=$1 ORDER BY created_at DESC LIMIT 1",
    [req.params.id]
  );

  if (!rows.length) return res.status(404).send("No image found");

  res.set("Content-Type", rows[0].mime);
  res.send(rows[0].data);
});


// Perfil
app.get("/api/profile", authRequired, async (req, res) => {
  const { rows } = await pool.query("SELECT id,name,email,phone,role,created_at FROM users WHERE id=$1", [req.user.id]);
  res.json(rows[0] || null);
});

// ================== STORES ==================
app.get("/api/stores", async (_req, res) => {
  const { rows } = await pool.query("SELECT id,name,owner_id,created_at FROM stores ORDER BY id ASC");
  res.json({ stores: rows });
});

app.post("/api/stores", authRequired, requireRole("seller", "admin"), async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  const ownerId = req.user.id;
  const { rows } = await pool.query(
    "INSERT INTO stores (name, owner_id) VALUES ($1,$2) RETURNING id,name,owner_id,created_at",
    [name, ownerId]
  );
  res.json({ store: rows[0] });
});

// ================== PRODUCTS ==================
app.get("/api/products", async (req, res) => {
  const { store_id } = req.query;
  if (store_id) {
    const { rows } = await pool.query(
      "SELECT id,title,price_xaf,store_id,stock,image_url,category,active FROM products WHERE store_id=$1 AND active=true ORDER BY id DESC",
      [store_id]
    );
    return res.json({ products: rows });
  }
  const { rows } = await pool.query(
    "SELECT id,title,price_xaf,store_id,stock,image_url,category,active FROM products WHERE active=true ORDER BY id DESC"
  );
  res.json({ products: rows });
});

// Crear producto (seller/admin) → se asigna a su tienda (seller) o a la que indique (admin)
app.post("/api/seller/products", authRequired, requireRole("seller", "admin"), async (req, res) => {
  const { title, price_xaf, stock, image_url, category, store_id } = req.body || {};
  if (!title || !price_xaf) return res.status(400).json({ error: "title y price_xaf requeridos" });

  // Determinar store del seller
  let sid = store_id;
  if (req.user.role === "seller") {
    const { rows: srows } = await pool.query("SELECT id FROM stores WHERE owner_id=$1 LIMIT 1", [req.user.id]);
    if (!srows.length) return res.status(400).json({ error: "El vendedor no tiene tienda" });
    sid = srows[0].id;
  }
  if (!sid) return res.status(400).json({ error: "store_id requerido" });

  const { rows } = await pool.query(
    `INSERT INTO products (title,price_xaf,store_id,stock,image_url,category,active)
     VALUES ($1,$2,$3,$4,$5,$6,true)
     RETURNING id,title,price_xaf,store_id,stock,image_url,category,active`,
    [title, parseInt(price_xaf, 10), sid, parseInt(stock || 0, 10), image_url || null, category || null]
  );
  res.json({ product: rows[0] });
});

app.get("/api/seller/products", authRequired, requireRole("seller", "admin"), async (req, res) => {
  // Si es seller, solo su tienda; si es admin, puede ver todas (simple: devolvemos todas)
  if (req.user.role === "seller") {
    const { rows: srows } = await pool.query("SELECT id FROM stores WHERE owner_id=$1 LIMIT 1", [req.user.id]);
    if (!srows.length) return res.json({ products: [] });
    const sid = srows[0].id;
    const { rows } = await pool.query(
      "SELECT id,title,price_xaf,store_id,stock,image_url,category,active FROM products WHERE store_id=$1 ORDER BY id DESC",
      [sid]
    );
    return res.json({ products: rows });
  } else {
    const { rows } = await pool.query(
      "SELECT id,title,price_xaf,store_id,stock,image_url,category,active FROM products ORDER BY id DESC"
    );
    return res.json({ products: rows });
  }
});

// ================== ORDERS ==================
// Crea pedido desde el front (usuario con token opcional o invitado)
app.post("/api/orders", async (req, res) => {
  try {
    const auth = req.headers["authorization"];
    let buyer = null;
    if (auth && auth.startsWith("Bearer ")) {
      try {
        buyer = jwt.verify(auth.split(" ")[1], JWT_SECRET);
      } catch {}
    }

    const {
      store_id,
      items = [], // [{product_id, qty}]
      fulfillment_type = "pickup",
      address = "",
      guest_name = "",
      guest_phone = ""
    } = req.body || {};

    if (!store_id || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, error: "store_id e items requeridos" });
    }

    const productIds = items.map(i => parseInt(i.product_id, 10));
    const { rows: prows } = await pool.query(
      "SELECT id,title,price_xaf,stock FROM products WHERE id = ANY($1::int[]) AND active=true",
      [productIds]
    );

    // calcular totales + validar stock
    let subtotal = 0;
    for (const it of items) {
      const p = prows.find(r => r.id === parseInt(it.product_id, 10));
      if (!p) return res.status(400).json({ success: false, error: `Producto ${it.product_id} no disponible` });
      const qty = parseInt(it.qty || 0, 10);
      if (qty <= 0) return res.status(400).json({ success: false, error: "Cantidad inválida" });
      if (p.stock < qty) return res.status(400).json({ success: false, error: `Stock insuficiente para ${p.title}` });
      subtotal += p.price_xaf * qty;
    }
    const envio = fulfillment_type === "delivery" ? 2000 : 0;
    const total = subtotal + envio;

    // crear pedido
    const { rows: orows } = await pool.query(
      `INSERT INTO orders (store_id,buyer_user_id,guest_name,guest_phone,address,fulfillment_type,status,subtotal_xaf,total_xaf)
       VALUES ($1,$2,$3,$4,$5,$6,'CREATED',$7,$8)
       RETURNING id`,
      [store_id, buyer ? buyer.id : null, guest_name || null, guest_phone || null, address || null, fulfillment_type, subtotal, total]
    );
    const orderId = orows[0].id;

    // insertar items + descontar stock
    for (const it of items) {
      const p = prows.find(r => r.id === parseInt(it.product_id, 10));
      const qty = parseInt(it.qty, 10);
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, title, unit_price_xaf, qty)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, p.id, p.title, p.price_xaf, qty]
      );
      await pool.query("UPDATE products SET stock = stock - $1 WHERE id=$2", [qty, p.id]);
    }

    res.json({ success: true, order_id: orderId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Error procesando pedido" });
  }
});

// Pedidos del vendedor (de su tienda)
app.get("/api/seller/orders", authRequired, requireRole("seller", "admin"), async (req, res) => {
  try {
    let sid = null;
    if (req.user.role === "seller") {
      const { rows: srows } = await pool.query("SELECT id FROM stores WHERE owner_id=$1 LIMIT 1", [req.user.id]);
      if (!srows.length) return res.json({ orders: [] });
      sid = srows[0].id;
    }

    const baseQ = `
      SELECT o.*
      FROM orders o
      ${req.user.role === "seller" ? "WHERE o.store_id=$1" : ""}
      ORDER BY o.id DESC
    `;
    const { rows: orows } =
      req.user.role === "seller" ? await pool.query(baseQ, [sid]) : await pool.query(baseQ);

    // Adjuntar items por pedido
    const ids = orows.map(o => o.id);
    let itemsByOrder = {};
    if (ids.length) {
      const { rows: irows } = await pool.query(
        "SELECT * FROM order_items WHERE order_id = ANY($1::int[])",
        [ids]
      );
      for (const it of irows) {
        if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
        itemsByOrder[it.order_id].push({
          product_id: it.product_id,
          title: it.title,
          unit_price_xaf: it.unit_price_xaf,
          qty: it.qty
        });
      }
    }

    const orders = orows.map(o => ({
      id: o.id,
      store_id: o.store_id,
      buyer_user_id: o.buyer_user_id,
      guest_name: o.guest_name,
      guest_phone: o.guest_phone,
      address: o.address,
      fulfillment_type: o.fulfillment_type,
      status: o.status,
      subtotal_xaf: o.subtotal_xaf,
      total_xaf: o.total_xaf,
      created_at: o.created_at,
      items: itemsByOrder[o.id] || []
    }));

    res.json({ orders });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error listando pedidos" });
  }
});

// Cambiar estado de pedido
app.put("/api/seller/orders/:id/status", authRequired, requireRole("seller", "admin"), async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: "status requerido" });

  // (Opcional: validar que el pedido sea de su tienda si es seller)
  await pool.query("UPDATE orders SET status=$1 WHERE id=$2", [status, req.params.id]);
  res.json({ message: "Estado actualizado" });
});

// ================== ADMIN ==================
app.get("/api/admin/users", authRequired, requireRole("admin"), async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id,name,email,role,phone,created_at FROM users ORDER BY id ASC"
  );
  res.json({ users: rows });
});

app.post("/api/admin/create-seller", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, phone, password, store_name } = req.body || {};
    if (!email || !password || !store_name) return res.status(400).json({ error: "email, password y store_name requeridos" });

    const hash = await bcrypt.hash(password, 10);
    const { rows: urows } = await pool.query(
      "INSERT INTO users (name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,'seller') RETURNING id",
      [name || null, email, phone || null, hash]
    );
    const userId = urows[0].id;

    const { rows: srows } = await pool.query(
      "INSERT INTO stores (name, owner_id) VALUES ($1,$2) RETURNING id",
      [store_name, userId]
    );

    res.json({ seller_user_id: userId, store_id: srows[0].id });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "No se pudo crear el vendedor (¿email repetido?)" });
  }
});

// ================== VARIOS ==================
app.get("/health", (_req, res) => res.json({ ok: true }));

// ================== START ==================
initDb()
  .then(seed)
  .then(() => {
    app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
  })
  .catch(err => {
    console.error("❌ Error inicializando la BD:", err);
    process.exit(1);
  });
