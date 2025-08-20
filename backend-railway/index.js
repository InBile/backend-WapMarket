const express = require("express");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔹 Cargar credenciales desde variable de entorno en Railway
let serviceAccount = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin inicializado con credenciales de Railway");
  } catch (error) {
    console.error("❌ Error al parsear credenciales de Firebase:", error);
  }
} else {
  console.warn("⚠️ No se encontraron credenciales en GOOGLE_APPLICATION_CREDENTIALS_JSON");
}

const db = admin.firestore();

// Datos del admin por defecto
const ADMIN_EMAIL = "admin@wapmarket.local";
const ADMIN_PASS = "admin123";
const ADMIN_PHONE = "+240555558213";

// Crear admin si no existe
(async () => {
  try {
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
  } catch (err) {
    console.error("❌ Error creando admin:", err);
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

