const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Transaction = sequelize.define("Transaction", {
  type: { type: DataTypes.ENUM("recharge", "payment", "withdraw"), allowNull: false },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  details: { type: DataTypes.JSON }
});

module.exports = Transaction;
