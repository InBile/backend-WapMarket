// index.js (único archivo)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");


// Middleware para verificar token y adjuntar usuario
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No autorizado" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // ahora tienes req.user.id y req.user.role
    next();
  } catch (e) {
    return res.status(403).json({ error: "Token inválido" });
  }
}


// ================= CONFIG =================
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "clave-secreta-super-segura";

// ================= EXPRESS =================
const app = express();
app.use(cors());
app.use(express.json());

// ================= POSTGRES =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ================= SUPABASE =================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE; // SERVICE ROLE (solo backend)
const supabase = createClient(supabaseUrl, supabaseKey);
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "product-images";

// ================= MULTER =================

const upload = multer({
  storage: multer.memoryStorage(), // guarda en RAM, no en disco
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de imagen no permitido. Solo JPG, PNG o WEBP."));
    }
  },
});




// ================= HELPERS =================
const mapProduct = (p) => ({
  id: p.id,
  name: p.name,
  price: Number(p.price),
  title: p.name,
  price_xaf: Number(p.price),
  stock: p.stock ?? 0,
  image_url: p.image_url || null,
  active: p.active ?? true,
  category: p.category || null,
  store_id: p.store_id || null,
  seller_id: p.seller_id || null,
  created_at: p.created_at,
});
const mapUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name || null,
  phone: u.phone || null,
  role: u.role || (u.is_admin ? "admin" : "buyer"),
  is_admin: !!u.is_admin,
  created_at: u.created_at,
});
const getFirst = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
const parsePrice = (raw) => {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

// ================= DB INIT + PARCHEO SEGURO =================
async function initDb() {
  // Tablas base
  await pool.query(`
    -- ========= USERS =========
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT false,
      is_seller BOOLEAN DEFAULT false,
      name TEXT,
      phone TEXT,
      role TEXT DEFAULT 'buyer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ========= STORES =========
    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ========= PRODUCTS =========
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC NOT NULL
    );

    -- ========= CART =========
    CREATE TABLE IF NOT EXISTS cart (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      quantity INT NOT NULL
    );

    -- ========= ORDERS =========
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      total NUMERIC NOT NULL,
      status TEXT DEFAULT 'CREATED',
      fulfillment_type TEXT DEFAULT 'pickup',
      guest_name TEXT,
      guest_phone TEXT,
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      quantity INT NOT NULL,
      unit_price NUMERIC
    );
  `);

  // Columnas que podrían faltar (idempotente)
  await pool.query(`
    -- stores
    ALTER TABLE stores
      ADD COLUMN IF NOT EXISTS seller_user_id INT REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

    -- products
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS store_id INT REFERENCES stores(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS seller_id INT REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    -- índices
    CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
    CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
    CREATE INDEX IF NOT EXISTS idx_stores_seller_user_id ON stores(seller_user_id);
  `);

  // Migraciones suaves de nombres antiguos (si existieran)
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stores' AND column_name = 'seller_id'
      ) THEN
        UPDATE stores
        SET seller_user_id = COALESCE(seller_user_id, seller_id)
        WHERE seller_user_id IS NULL;
      END IF;
    END $$;
  `);
}
initDb().catch(console.error);

// ================= ADMIN POR DEFECTO =================
async function createDefaultAdmin() {
  try {
    const email = "admin@wapmarket.com";
    const password = "naciel25091999"; // cámbialo luego
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (result.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (email, password_hash, is_admin, role, name) VALUES ($1, $2, $3, $4, $5)",
        [email, passwordHash, true, "admin", "Administrador"]
      );
      console.log(`✅ Admin creado: ${email} / ${password}`);
    } else {
      console.log("⚡ Admin ya existe, no se creó otro.");
    }
  } catch (e) {
    console.error("No se pudo crear admin por defecto:", e.message);
  }
}
createDefaultAdmin().catch(console.error);

// ================= MIDDLEWARE AUTH =================
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, isAdmin, role, isSeller? }
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const role = req.user.role || (req.user.isAdmin ? "admin" : "buyer");
    if (role === "admin" || roles.includes(role)) return next();
    return res.status(403).json({ error: "Not authorized" });
  };
}
function authMiddlewareOptional(req, _res, next) {
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      // token inválido -> ignorar
    }
  }
  next();
}

// ================= AUTH =================
async function handleRegister(req, res) {
  const { email, password, name, phone, role } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      "INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [email, passwordHash, name || null, phone || null, role || "buyer"]
    );
    res.json({ message: "User registered", user: mapUser(r.rows[0]) });
  } catch {
    res.status(400).json({ error: "Email already registered" });
  }
}
async function handleLogin(req, res) {
  const { email, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(400).json({ error: "Invalid password" });

  const role = user.role || (user.is_admin ? "admin" : user.is_seller ? "seller" : "buyer");
  const payload = {
    id: user.id,
    email: user.email,
    isAdmin: user.is_admin,
    role,
    isSeller: user.is_seller,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: mapUser(user) });
}

app.post("/api/register", handleRegister);
app.post("/api/auth/signup", handleRegister);
app.post("/api/login", handleLogin);
app.post("/api/auth/login", handleLogin);

app.get("/api/profile", authMiddleware, async (req, res) => {
  const result = await pool.query("SELECT * FROM users WHERE id=$1", [req.user.id]);
  res.json(mapUser(result.rows[0]));
});

// ================= STORES (NEGOCIOS) =================
// antes: function loadStoresRows() {
async function loadStoresRows() {
  try {
    const r = await pool.query(`
      SELECT 
        s.id, s.name, s.seller_user_id, s.active, s.created_at,
        u.name as seller_name, u.email as seller_email,
        COALESCE((SELECT COUNT(*)::int FROM products p WHERE p.store_id = s.id), 0) as product_count
      FROM stores s 
      LEFT JOIN users u ON u.id = s.seller_user_id
      ORDER BY s.id DESC
    `);
    return r.rows;
  } catch (e) {
    if (e && e.code === "42703") {
      const r2 = await pool.query(`
        SELECT 
          s.id, s.name, s.seller_id AS seller_user_id, s.active, s.created_at,
          u.name as seller_name, u.email as seller_email,
          COALESCE((SELECT COUNT(*)::int FROM products p WHERE p.store_id = s.id), 0) as product_count
        FROM stores s 
        LEFT JOIN users u ON u.id = s.seller_id
        ORDER BY s.id DESC
      `);
      return r2.rows;
    }
    throw e;
  }
}


app.get("/api/stores", async (_req, res) => {
  try {
    const rows = await loadStoresRows();
    res.json({ stores: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot load stores" });
  }
});

// Aliases
app.get("/api/shops", async (_req, res) => res.json({ stores: await loadStoresRows() }));
app.get("/api/businesses", async (_req, res) => res.json({ stores: await loadStoresRows() }));
app.get("/api/negocios", async (_req, res) => res.json({ stores: await loadStoresRows() }));

// ================= PRODUCTOS (públicos) =================
app.get("/api/products", async (req, res) => {
  const { store_id } = req.query;
  let sql = "SELECT * FROM products";
  const params = [];
  if (store_id) {
    sql += " WHERE store_id=$1";
    params.push(store_id);
  }
  sql += " ORDER BY id DESC";
  const result = await pool.query(sql, params);
  res.json({ products: result.rows.map(mapProduct) });
});

app.get("/api/products/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM products WHERE id=$1", [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: "Not found" });
  res.json(mapProduct(result.rows[0]));
});

/**
 * Compat: GET /products/:id/image
 * Ahora redirige a image_url (Supabase) si existe.
 */
app.get("/products/:id/image", async (req, res) => {
  try {
    const { id } = req.params;
    const q = await pool.query(`SELECT image_url FROM products WHERE id = $1`, [id]);
    if (!q.rows.length || !q.rows[0].image_url) {
      return res.status(404).send("Imagen no encontrada");
    }
    return res.redirect(q.rows[0].image_url);
  } catch (err) {
    console.error("Error en GET /products/:id/image:", err);
    res.status(500).send("Error al servir la imagen");
  }
});

/**
 * POST /products (público: tu seller.html ya llama aquí)
 * Sube archivo a Supabase Storage y guarda image_url en DB.
 */
app.post("/products", upload.single("image_file"), async (req, res) => {
  try {
    const { name, price, stock, category, store_id, seller_id } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "name y price son obligatorios" });
    }

    let publicUrl = null;

    if (req.file) {
      // nombre único
      const ext = req.file.originalname.split(".").pop();
      const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadError) throw uploadError;

      // url pública
      const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(fileName);
      publicUrl = data.publicUrl;
    }

    const insert = await pool.query(
      `INSERT INTO products (name, price, stock, category, store_id, seller_id, active, created_at, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,true,NOW(),$7)
       RETURNING *`,
      [
        name,
        Number(price),
        Number(stock || 0),
        category || null,
        store_id || null,
        seller_id || null,
        publicUrl,
      ]
    );

    res.json(insert.rows[0]);
  } catch (err) {
    console.error("Error en /products:", err);
    res.status(500).json({ error: "Error al crear el producto" });
  }
});


// ================= PRODUCTOS (admin) =================
app.post("/api/products", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const name = getFirst(req.body.name, req.body.title, req.body.productName, req.body.nombre);
    const price = parsePrice(getFirst(req.body.price, req.body.price_xaf, req.body.productPrice, req.body.precio));
    const stock = parsePrice(getFirst(req.body.stock, req.body.quantity, req.body.qty)) ?? 0;
    const image_url = getFirst(req.body.image_url, req.body.image, req.body.imageUrl) || null;
    const active = req.body.active === false ? false : true;
    const category = getFirst(req.body.category, req.body.categoria, req.body.cat) || null;
    const store_id = req.body.store_id || null;
    const seller_id = req.body.seller_id || null;

    if (!name) return res.status(400).json({ error: "Falta el nombre del producto" });
    if (price === null) return res.status(400).json({ error: "Falta o es inválido el precio" });

    const result = await pool.query(
      `INSERT INTO products (name, price, stock, image_url, active, category, store_id, seller_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, price, stock, image_url, active, category, store_id, seller_id]
    );
    res.json(mapProduct(result.rows[0]));
  } catch (err) {
    console.error("Error admin creando producto:", err);
    res.status(500).json({ error: "No se pudo crear el producto" });
  }
});

app.put("/api/products/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  const name = getFirst(req.body.name, req.body.title, req.body.productName, req.body.nombre);
  const priceParsed = parsePrice(getFirst(req.body.price, req.body.price_xaf, req.body.productPrice, req.body.precio));
  const stockParsed = parsePrice(getFirst(req.body.stock, req.body.quantity, req.body.qty));

  const updates = {
    name: name ?? null,
    price: Number.isFinite(priceParsed) ? priceParsed : null,
    stock: Number.isFinite(stockParsed) ? stockParsed : null,
    image_url: getFirst(req.body.image_url, req.body.image, req.body.imageUrl) || null,
    active: typeof req.body.active === "boolean" ? req.body.active : null,
    category: getFirst(req.body.category, req.body.categoria, req.body.cat) || null,
    store_id: req.body.store_id ?? null,
    seller_id: req.body.seller_id ?? null,
  };

  const result = await pool.query(
    `UPDATE products SET
      name=COALESCE($1,name),
      price=COALESCE($2,price),
      stock=COALESCE($3,stock),
      image_url=COALESCE($4,image_url),
      active=COALESCE($5,active),
      category=COALESCE($6,category),
      store_id=COALESCE($7,store_id),
      seller_id=COALESCE($8,seller_id)
     WHERE id=$9 RETURNING *`,
    [
      updates.name,
      updates.price,
      updates.stock,
      updates.image_url,
      updates.active,
      updates.category,
      updates.store_id,
      updates.seller_id,
      req.params.id,
    ]
  );
  res.json(mapProduct(result.rows[0]));
});

app.delete("/api/products/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
  res.json({ message: "Deleted" });
});

// ================= Productos de un seller (seguro) =================
// =========================
// Productos (por tienda)
// =========================
app.get("/api/products", async (req, res) => {
  const { store_id } = req.query;
  let storeId = Number(store_id);

  if (!storeId) {
    return res.status(400).json({ error: "store_id inválido" });
  }

  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.price, p.category, p.image_url, p.store_id
      FROM products p
      WHERE p.store_id = $1
      ORDER BY p.created_at DESC
    `, [storeId]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error en /api/products:", err);
    res.status(500).json({ error: "No se pudieron cargar productos" });
  }
});

// ================= Pedidos de un seller (seguro) =================
// =========================
// Órdenes de un vendedor
// =========================
app.get("/sellers/:id/orders", async (req, res) => {
  const sellerId = Number(req.params.id);
  if (!sellerId) {
    return res.status(400).json({ error: "ID de vendedor inválido" });
  }

  try {
    const result = await pool.query(`
      SELECT DISTINCT o.*
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      JOIN stores s ON s.id = p.store_id
      WHERE s.seller_user_id = $1
      ORDER BY o.created_at DESC
    `, [sellerId]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error en /sellers/:id/orders:", err);
    res.status(500).json({ error: "No se pudieron cargar las órdenes" });
  }
});


// ================= CARRITO =================
app.get("/api/cart/:userId", async (req, res) => {
  const result = await pool.query("SELECT * FROM cart WHERE user_id=$1", [req.params.userId]);
  res.json(result.rows);
});
app.post("/api/cart/:userId", async (req, res) => {
  const { productId, quantity } = req.body;
  await pool.query("INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)", [
    req.params.userId,
    productId,
    quantity,
  ]);
  const result = await pool.query("SELECT * FROM cart WHERE user_id=$1", [req.params.userId]);
  res.json(result.rows);
});
app.delete("/api/cart/:userId/:productId", async (req, res) => {
  await pool.query("DELETE FROM cart WHERE user_id=$1 AND product_id=$2", [req.params.userId, req.params.productId]);
  const result = await pool.query("SELECT * FROM cart WHERE user_id=$1", [req.params.userId]);
  res.json(result.rows);
});

// ================= PEDIDOS =================
app.post("/api/orders", authMiddlewareOptional, async (req, res) => {
  try {
    const userId = req.body.userId || req.user?.id || null;
    const itemsRaw = req.body.items || [];
    const items = itemsRaw
      .map((i) => ({
        productId: i.productId || i.product_id,
        quantity: i.quantity || i.qty,
      }))
      .filter((i) => i.productId && i.quantity > 0);

    const fulfillment_type = req.body.fulfillment_type || "pickup";
    const guest_name = req.body.guest_name || null;
    const guest_phone = req.body.guest_phone || null;
    const address = req.body.address || null;

    if (!items.length) return res.status(400).json({ error: "Empty items" });

    const productIds = items.map((i) => i.productId);
    const r = await pool.query(`SELECT id, price FROM products WHERE id = ANY($1::int[])`, [productIds]);

    let subtotal = 0;
    for (const it of items) {
      const p = r.rows.find((x) => x.id === it.productId);
      if (p) subtotal += Number(p.price) * it.quantity;
    }
    const delivery = fulfillment_type === "delivery" ? 2000 : 0;
    const total = subtotal + delivery;

    const orderResult = await pool.query(
      "INSERT INTO orders (user_id, total, status, fulfillment_type, guest_name, guest_phone, address) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [userId || null, total, "CREATED", fulfillment_type, guest_name, guest_phone, address]
    );
    const order = orderResult.rows[0];

    for (const it of items) {
      const p = r.rows.find((x) => x.id === it.productId);
      const unit = p ? Number(p.price) : 0;
      await pool.query(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)",
        [order.id, it.productId, it.quantity, unit]
      );
    }

    res.json({
      success: true,
      order_id: order.id,
      order: {
        id: order.id,
        total_xaf: Number(order.total),
        status: order.status,
        fulfillment_type: order.fulfillment_type,
        created_at: order.created_at,
      },
    });
  } catch (err) {
    console.error("Error creando pedido:", err);
    res.status(500).json({ error: "No se pudo crear el pedido" });
  }
});

// ================= ADMIN =================
app.get("/api/admin/users", authMiddleware, requireRole("admin"), async (req, res) => {
  const r = await pool.query("SELECT * FROM users ORDER BY id DESC");
  res.json({ users: r.rows.map(mapUser) });
});

app.post("/api/admin/create-seller", authMiddleware, requireRole("admin"), async (req, res) => {
  const { name, email, password, phone, store_name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: "Faltan campos" });
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const u = await pool.query(
      "INSERT INTO users (email, password_hash, name, phone, role, is_admin, is_seller) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [email, passwordHash, name, phone || null, "seller", false, true]
    );
    const sellerId = u.rows[0].id;
    const s = await pool.query(
      "INSERT INTO stores (name, seller_user_id, active) VALUES ($1,$2,TRUE) RETURNING *",
      [store_name || `${name}'s Store`, sellerId]
    );
    res.json({ seller_user_id: sellerId, store_id: s.rows[0].id });
  } catch (e) {
    res.status(400).json({ error: "No se pudo crear el vendedor (email duplicado?)" });
  }
});

// ================= SELLER =================
app.get("/api/seller/products", authMiddleware, requireRole("seller"), async (req, res) => {
  const r = await pool.query("SELECT * FROM products WHERE seller_id=$1 ORDER BY id DESC", [req.user.id]);
  res.json({ products: r.rows.map(mapProduct) });
});

app.post("/api/seller/products", authMiddleware, requireRole("seller"), async (req, res) => {
  try {
    const name = getFirst(req.body.name, req.body.title, req.body.productName, req.body.nombre);
    const price = parsePrice(getFirst(req.body.price, req.body.price_xaf, req.body.productPrice, req.body.precio));
    const stock = parsePrice(getFirst(req.body.stock, req.body.quantity, req.body.qty)) ?? 0;
    const image_url = getFirst(req.body.image_url, req.body.image, req.body.imageUrl) || null;
    const active = req.body.active === false ? false : true;
    const category = getFirst(req.body.category, req.body.categoria, req.body.cat) || null;

    if (!name) return res.status(400).json({ error: "Falta el nombre del producto" });
    if (price === null) return res.status(400).json({ error: "Falta o es inválido el precio" });

    // buscar / crear la store del vendedor
    let storeR = await pool.query("SELECT id FROM stores WHERE seller_user_id=$1 LIMIT 1", [req.user.id]);
    if (storeR.rows.length === 0) {
      const userR = await pool.query("SELECT name, email FROM users WHERE id=$1", [req.user.id]);
      const baseName = userR.rows[0]?.name || userR.rows[0]?.email || "Mi Tienda";
      storeR = await pool.query(
        "INSERT INTO stores (name, seller_user_id, active) VALUES ($1,$2,TRUE) RETURNING id",
        [baseName, req.user.id]
      );
    }
    const storeId = storeR.rows[0].id;

    const r = await pool.query(
      `INSERT INTO products (name, price, stock, image_url, active, category, store_id, seller_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, price, stock, image_url, active, category, storeId, req.user.id]
    );

    res.json({ product: mapProduct(r.rows[0]) });
  } catch (err) {
    console.error("Error creando producto:", err);
    res.status(500).json({ error: "No se pudo crear el producto" });
  }
});

app.get("/api/seller/orders", authMiddleware, requireRole("seller"), async (req, res) => {
  const r = await pool.query(
    `
    SELECT DISTINCT o.*
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE p.seller_id = $1
    ORDER BY o.id DESC
  `,
    [req.user.id]
  );

  const orders = [];
  for (const o of r.rows) {
    const itemsR = await pool.query(
      `
      SELECT oi.product_id, oi.quantity, oi.unit_price, p.name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id=$1 AND p.seller_id=$2
    `,
      [o.id, req.user.id]
    );
    const items = itemsR.rows.map((it) => ({
      product_id: it.product_id,
      title: it.name,
      qty: it.quantity,
      unit_price_xaf: Number(it.unit_price),
    }));
    const subtotal = items.reduce((s, i) => s + i.unit_price_xaf * i.qty, 0);
    orders.push({
      id: o.id,
      created_at: o.created_at,
      guest_name: o.guest_name,
      guest_phone: o.guest_phone,
      address: o.address,
      fulfillment_type: o.fulfillment_type,
      status: o.status,
      subtotal_xaf: subtotal,
      total_xaf: Number(o.total),
      items,
    });
  }
  res.json({ orders });
});

app.put("/api/seller/orders/:id/status", authMiddleware, requireRole("seller"), async (req, res) => {
  const { status } = req.body;
  const authR = await pool.query(
    `
    SELECT 1
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id=$1 AND p.seller_id=$2
    LIMIT 1
  `,
    [req.params.id, req.user.id]
  );
  if (authR.rows.length === 0) return res.status(403).json({ error: "No autorizado" });

  await pool.query("UPDATE orders SET status=$1 WHERE id=$2", [status, req.params.id]);
  res.json({ message: "Estado actualizado" });
});

// ================= ROOT =================
app.get("/", (_req, res) => res.send("✅ API WapMarket funcionando con Supabase Storage"));

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
