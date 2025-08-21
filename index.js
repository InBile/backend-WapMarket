// Backend extendido con Express + PostgreSQL en Railway
// Maneja usuarios, autenticación JWT, productos, carrito y pedidos

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

// Crear tablas si no existen
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
}

initDb().catch(console.error);

// Crear admin predeterminado si no existe
async function createDefaultAdmin() {
  const email = "admin@wapmarket.com";
  const password = "naciel25091999"; // cámbialo por algo más seguro
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (result.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, $3)",
      [email, passwordHash, true]
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
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ================= USUARIOS =================
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [email, passwordHash]);
    res.json({ message: "User registered" });
  } catch (err) {
    res.status(400).json({ error: "Email already registered" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

app.get("/api/profile", authMiddleware, async (req, res) => {
  const result = await pool.query("SELECT id, email, is_admin FROM users WHERE id=$1", [req.user.id]);
  res.json(result.rows[0]);
});

// ================= PRODUCTOS =================
app.get("/api/products", async (req, res) => {
  const result = await pool.query("SELECT * FROM products");
  res.json(result.rows);
});

app.get("/api/products/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM products WHERE id=$1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
});

app.post("/api/products", authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Not authorized" });
  const { name, price } = req.body;
  const result = await pool.query("INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *", [name, price]);
  res.json(result.rows[0]);
});

app.put("/api/products/:id", authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Not authorized" });
  const { name, price } = req.body;
  const result = await pool.query("UPDATE products SET name=$1, price=$2 WHERE id=$3 RETURNING *", [name, price, req.params.id]);
  res.json(result.rows[0]);
});

app.delete("/api/products/:id", authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Not authorized" });
  await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
  res.json({ message: "Deleted" });
});

// ================= CARRITO =================
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

// ================= PEDIDOS =================
app.post("/api/orders", async (req, res) => {
  const { userId, items } = req.body;

  // Calcular total
  const productIds = items.map(i => i.productId);
  const result = await pool.query(`SELECT * FROM products WHERE id = ANY($1::int[])`, [productIds]);
  let total = 0;
  items.forEach(i => {
    const product = result.rows.find(p => p.id === i.productId);
    if (product) total += Number(product.price) * i.quantity;
  });

  // Crear pedido
  const orderResult = await pool.query("INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING *", [userId, total]);
  const order = orderResult.rows[0];

  // Insertar items
  for (const i of items) {
    await pool.query("INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)", [order.id, i.productId, i.quantity]);
  }

  res.json(order);
});

app.get("/api/orders/:userId", async (req, res) => {
  const result = await pool.query("SELECT * FROM orders WHERE user_id=$1", [req.params.userId]);
  res.json(result.rows);
});

// ================= START =================
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));


