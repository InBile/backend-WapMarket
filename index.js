// Backend Express + PostgreSQL extendido (compatible con tu versión)
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

// ================= CONFIG =================
const JWT_SECRET = process.env.JWT_SECRET || "clave-secreta-super-segura";
const PORT = process.env.PORT || 3000;

// ================= POSTGRES =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helpers
const mapProduct = (p) => ({
  // originales
  id: p.id,
  name: p.name,
  price: Number(p.price),
  // compat frontend
  title: p.name,
  price_xaf: Number(p.price),
  stock: p.stock ?? 0,
  image_url: p.image_url || null,
  active: p.active ?? true,
  category: p.category || null,
  store_id: p.store_id || null,
});

const mapUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name || null,
  phone: u.phone || null,
  role: u.role || (u.is_admin ? 'admin' : 'buyer'),
  is_admin: !!u.is_admin,
  created_at: u.created_at
});

// Crear/alterar tablas si no existen
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cart (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      quantity INT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      total NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      quantity INT NOT NULL
    );
  `);

  -- 🔥 añadimos la columna si no existe
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='products'
        AND column_name='seller_user_id'
      ) THEN
        ALTER TABLE products ADD COLUMN seller_user_id INT REFERENCES users(id);
      END IF;
    END
    $$;
  `);
}

}

initDb().catch(console.error);

// Crear admin predeterminado si no existe
async function createDefaultAdmin() {
  const email = "admin@wapmarket.com";
  const password = "naciel25091999"; // cámbialo luego
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (result.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (email, password_hash, is_admin, role, name) VALUES ($1, $2, $3, $4, $5)",
      [email, passwordHash, true, 'admin', 'Administrador']
    );
    console.log(`✅ Admin creado: ${email} / ${password}`);
  } else {
    console.log("⚡ Admin ya existe, no se creó otro.");
  }
}
createDefaultAdmin().catch(console.error);

// ================= MIDDLEWARE =================
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, isAdmin, role }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const role = req.user.role || (req.user.isAdmin ? 'admin' : 'buyer');
    if (role === 'admin' || roles.includes(role)) return next();
    return res.status(403).json({ error: "Not authorized" });
  };
}

// ================= USUARIOS / AUTH =================
async function handleRegister(req, res) {
  const { email, password, name, phone, role } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      "INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [email, passwordHash, name || null, phone || null, role || 'buyer']
    );
    res.json({ message: "User registered", user: mapUser(r.rows[0]) });
  } catch (err) {
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

  const role = user.role || (user.is_admin ? 'admin' : (user.is_seller ? 'seller' : 'buyer'));

  const payload = { 
    id: user.id, 
    email: user.email, 
    isAdmin: user.is_admin, 
    role, 
    isSeller: user.is_seller   // 👈 ahora el token lleva info de vendedor
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: mapUser(user) });
}

// Rutas originales y alias para que el frontend encaje
app.post("/api/register", handleRegister);
app.post("/api/auth/signup", handleRegister);

app.post("/api/login", handleLogin);
app.post("/api/auth/login", handleLogin);

app.get("/api/profile", authMiddleware, async (req, res) => {
  const result = await pool.query("SELECT * FROM users WHERE id=$1", [req.user.id]);
  res.json(mapUser(result.rows[0]));
});

// ================= STORES =================
app.get("/api/stores", async (req, res) => {
  const r = await pool.query(`
    SELECT s.id, s.name, s.seller_user_id, s.created_at, u.name as seller_name, u.email as seller_email
    FROM stores s LEFT JOIN users u ON u.id = s.seller_user_id
    ORDER BY s.id DESC
  `);
  res.json({ stores: r.rows });
});

// ================= PRODUCTOS =================
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
  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(mapProduct(result.rows[0]));
});

// Mantengo tu endpoint admin para crear productos (ahora con más campos)
app.post("/api/products", authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, price, stock, image_url, active, category, store_id, seller_id } = req.body;
  const result = await pool.query(
    `INSERT INTO products (name, price, stock, image_url, active, category, store_id, seller_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, price, stock||0, image_url||null, active!==false, category||null, store_id||null, seller_id||null]
  );
  res.json(mapProduct(result.rows[0]));
});

app.put("/api/products/:id", authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, price, stock, image_url, active, category, store_id, seller_id } = req.body;
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
    [name, price, stock, image_url, active, category, store_id, seller_id, req.params.id]
  );
  res.json(mapProduct(result.rows[0]));
});

app.delete("/api/products/:id", authMiddleware, requireRole('admin'), async (req, res) => {
  await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
  res.json({ message: "Deleted" });
});

// ================= CARRITO (compat) =================
app.get("/api/cart/:userId", async (req, res) => {
  const result = await pool.query("SELECT * FROM cart WHERE user_id=$1", [req.params.userId]);
  res.json(result.rows);
});
app.post("/api/cart/:userId", async (req, res) => {
  const { productId, quantity } = req.body;
  await pool.query("INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)", [req.params.userId, productId, quantity]);
  const result = await pool.query("SELECT * FROM cart WHERE user_id=$1", [req.params.userId]);
  res.json(result.rows);
});
app.delete("/api/cart/:userId/:productId", async (req, res) => {
  await pool.query("DELETE FROM cart WHERE user_id=$1 AND product_id=$2", [req.params.userId, req.params.productId]);
  const result = await pool.query("SELECT * FROM cart WHERE user_id=$1", [req.params.userId]);
  res.json(result.rows);
});

// ================= PEDIDOS (con invitado) =================
app.post("/api/orders", async (req, res) => {
  // Acepta ambas variantes de payload
  const userId = req.body.userId || req.user?.id || null;
  const itemsRaw = req.body.items || [];
  const items = itemsRaw.map(i => ({
    productId: i.productId || i.product_id,
    quantity: i.quantity || i.qty
  })).filter(i => i.productId && i.quantity > 0);

  const fulfillment_type = req.body.fulfillment_type || 'pickup';
  const guest_name = req.body.guest_name || null;
  const guest_phone = req.body.guest_phone || null;
  const address = req.body.address || null;

  if (!items.length) return res.status(400).json({ error: "Empty items" });

  const productIds = items.map(i => i.productId);
  const r = await pool.query(`SELECT id, price FROM products WHERE id = ANY($1::int[])`, [productIds]);

  let subtotal = 0;
  for (const it of items) {
    const p = r.rows.find(x => x.id === it.productId);
    if (p) subtotal += Number(p.price) * it.quantity;
  }
  const delivery = fulfillment_type === 'delivery' ? 2000 : 0;
  const total = subtotal + delivery;

  const orderResult = await pool.query(
    "INSERT INTO orders (user_id, total, status, fulfillment_type, guest_name, guest_phone, address) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
    [userId || null, total, 'CREATED', fulfillment_type, guest_name, guest_phone, address]
  );
  const order = orderResult.rows[0];

  for (const it of items) {
    const p = r.rows.find(x => x.id === it.productId);
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
      created_at: order.created_at
    }
  });
});

app.get("/api/orders/:userId", async (req, res) => {
  const result = await pool.query("SELECT * FROM orders WHERE user_id=$1 ORDER BY id DESC", [req.params.userId]);
  res.json(result.rows);
});

// ================= ADMIN =================
app.get("/api/admin/users", authMiddleware, requireRole('admin'), async (req, res) => {
  const r = await pool.query("SELECT * FROM users ORDER BY id DESC");
  res.json({ users: r.rows.map(mapUser) });
});

app.post("/api/admin/create-seller", authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, email, password, phone, store_name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: "Faltan campos" });
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const u = await pool.query(
      "INSERT INTO users (email, password_hash, name, phone, role, is_admin) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [email, passwordHash, name, phone || null, 'seller', false]
    );
    const sellerId = u.rows[0].id;
    const s = await pool.query(
      "INSERT INTO stores (name, seller_user_id) VALUES ($1,$2) RETURNING *",
      [store_name || name + "'s Store", sellerId]
    );
    res.json({ seller_user_id: sellerId, store_id: s.rows[0].id });
  } catch (e) {
    res.status(400).json({ error: "No se pudo crear el vendedor (email duplicado?)" });
  }
});

// ================= SELLER =================
app.get("/api/seller/products", authMiddleware, requireRole('seller'), async (req, res) => {
  const r = await pool.query("SELECT * FROM products WHERE seller_id=$1 ORDER BY id DESC", [req.user.id]);
  res.json({ products: r.rows.map(mapProduct) });
});

app.post("/api/seller/products", authMiddleware, requireRole('seller'), async (req, res) => {
  const { name, price, stock, image_url, active, category } = req.body;
  // buscar la store del vendedor
  const storeR = await pool.query("SELECT id FROM stores WHERE seller_user_id=$1 LIMIT 1", [req.user.id]);
  const storeId = storeR.rows[0]?.id || null;
  const r = await pool.query(
    `INSERT INTO products (name, price, stock, image_url, active, category, store_id, seller_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, price, stock||0, image_url||null, active!==false, category||null, storeId, req.user.id]
  );
  res.json({ product: mapProduct(r.rows[0]) });
});

app.get("/api/seller/orders", authMiddleware, requireRole('seller'), async (req, res) => {
  // pedidos que contienen productos de este seller
  const r = await pool.query(`
    SELECT DISTINCT o.*
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE p.seller_id = $1
    ORDER BY o.id DESC
  `, [req.user.id]);

  const orders = [];
  for (const o of r.rows) {
    const itemsR = await pool.query(`
      SELECT oi.product_id, oi.quantity, oi.unit_price, p.name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id=$1 AND p.seller_id=$2
    `, [o.id, req.user.id]);
    const items = itemsR.rows.map(it => ({
      product_id: it.product_id,
      title: it.name,
      qty: it.quantity,
      unit_price_xaf: Number(it.unit_price)
    }));
    const subtotal = items.reduce((s,i)=>s + i.unit_price_xaf * i.qty, 0);
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
      items
    });
  }
  res.json({ orders });
});

app.put("/api/seller/orders/:id/status", authMiddleware, requireRole('seller'), async (req, res) => {
  const { status } = req.body;
  // Autorización mínima: el pedido debe tener items de este seller
  const authR = await pool.query(`
    SELECT 1
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id=$1 AND p.seller_id=$2
    LIMIT 1
  `, [req.params.id, req.user.id]);
  if (authR.rows.length === 0) return res.status(403).json({ error: "No autorizado" });

  await pool.query("UPDATE orders SET status=$1 WHERE id=$2", [status, req.params.id]);
  res.json({ message: "Estado actualizado" });
});

// ================= START =================
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
