const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const WapCard = sequelize.define("WapCard", {
  cardCode: { type: DataTypes.STRING, unique: true, allowNull: false },
  balance: { type: DataTypes.INTEGER, defaultValue: 0 },
  role: { type: DataTypes.ENUM("client", "seller", "admin"), defaultValue: "client" }
});

module.exports = WapCard;
