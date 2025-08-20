const express = require("express");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔹 Inicialización segura de Firebase
let db = null;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log("✅ Firebase Admin inicializado en Railway");
  } catch (err) {
    console.error("❌ Error al inicializar Firebase:", err);
  }
} else {
  console.warn("⚠️ No se encontraron credenciales en GOOGLE_APPLICATION_CREDENTIALS_JSON");
}

// 🔹 Crear administrador por defecto (si Firestore disponible)
(async () => {
  if (!db) {
    console.warn("⚠️ Firestore no disponible, se omite creación de admin.");
    return;
  }
  try {
    const ref = db.collection("users").doc("admin");
    const doc = await ref.get();
    if (!doc.exists) {
      const hash = bcrypt.hashSync("admin123", 10);
      await ref.set({
        name: "Administrador",
        email: "admin@wapmarket.local",
        password_hash: hash,
        role: "admin",
        phone: "+240555558213",
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("✅ Admin creado en Firestore.");
    } else {
      console.log("ℹ️ Admin ya existe en Firestore.");
    }
  } catch (err) {
    console.error("❌ Error creando admin:", err);
  }
})();

// 🔹 Ruta raíz
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><meta charset="utf-8"><title>WapMarket</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif">
        <h1>🚀 WapMarket Backend en Railway</h1>
        <p>Servidor en ejecución. Prueba la API: <a href="/api">/api</a></p>
      </body>
    </html>
  `);
});

// 🔹 Ruta de prueba
app.get("/api", (req, res) => {
  res.json({ msg: "🚀 Backend WapMarket funcionando en Railway" });
});

// 🔹 Ejemplo de pedidos
app.post("/api/orders", async (req, res) => {
  try {
    const { store_id, items, fulfillment_type, guest_name, guest_phone, address } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Debes incluir al menos 1 producto en items" });
    }

    const order = {
      store_id: store_id || null,
      items,
      fulfillment_type: fulfillment_type || "pickup", // pickup o delivery
      guest_name: guest_name || null,
      guest_phone: guest_phone || null,
      address: address || "",
      created_at: new Date().toISOString()
    };

    if (db) {
      const ref = await db.collection("orders").add(order);
      return res.json({ success: true, order_id: ref.id });
    } else {
      // Si Firestore no está configurado, devolvemos respuesta simulada
      return res.json({ success: true, message: "Pedido recibido (modo simulado)", order });
    }
  } catch (err) {
    console.error("❌ Error en /api/orders:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// 🔹 Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

