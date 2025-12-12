const mysql = require("mysql2/promise");
require("dotenv").config();

// You can keep your DB_* variables in .env, this will use either MYSQL_* or DB_*
const host = process.env.MYSQL_HOST || process.env.DB_SERVER || "localhost";
const port = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
const user = process.env.MYSQL_USER || process.env.DB_USER || "root";
const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
const database =
  process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "erp_akkj";

const useSsl = process.env.MYSQL_SSL === "true";
const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

module.exports = {
  pool,
};
