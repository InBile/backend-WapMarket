const express = require("express");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Inicializar Firebase Admin (Railway usará credenciales desde el entorno si están configuradas)
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
} catch (e) {
  console.log("Firebase Admin ya inicializado o sin credenciales disponibles.");
}
const db = admin.firestore();

// Datos del admin por defecto
const ADMIN_EMAIL = "admin@wapmarket.local";
const ADMIN_PASS = "admin123";
const ADMIN_PHONE = "+240555558213";

// Crear admin si no existe
(async () => {
  const ref = db.collection("users").doc("admin");
  const doc = await ref.get();
  if (!doc.exists) {
    const hash = bcrypt.hashSync(ADMIN_PASS, 10);
    await ref.set({
      name: "Administrador",
      email: ADMIN_EMAIL,
      password_hash: hash,
      role: "admin",
      phone: ADMIN_PHONE
    });
    console.log("✅ Admin creado:", ADMIN_EMAIL);
  }
})();

// Ruta de prueba
app.get("/api", (req, res) => {
  res.json({ msg: "🚀 Backend WapMarket funcionando en Railway" });
});

// Aquí luego puedes añadir rutas de productos, pedidos, etc.

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
