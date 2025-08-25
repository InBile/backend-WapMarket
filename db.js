// db.js
const { Sequelize } = require("sequelize");

// ⚠️ Cambia usuario, contraseña y base según tu Postgres
const sequelize = new Sequelize("wapmarket", "postgres", "tu_password", {
  host: "localhost",   // o la IP de tu servidor Postgres
  dialect: "postgres",
  logging: false,
});

sequelize.authenticate()
  .then(() => console.log("✅ Conectado a Postgres"))
  .catch(err => console.error("❌ Error conexión Postgres:", err));

module.exports = sequelize;
