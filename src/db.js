const mysql = require("mysql2/promise");
require("dotenv").config();

function parseUrl(urlString = "") {
  try {
    if (!urlString) return null;
    const url = new URL(urlString);
    const sslParam = url.searchParams.get("ssl") || url.searchParams.get("sslmode");

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username || ""),
      password: decodeURIComponent(url.password || ""),
      database: url.pathname ? url.pathname.replace(/^\//, "") : undefined,
      ssl:
        sslParam === "true" ||
        sslParam === "1" ||
        sslParam === "require" ||
        sslParam === "required",
    };
  } catch (err) {
    console.warn("Invalid database URL. Falling back to discrete env vars.", err.message);
    return null;
  }
}

// Prefer a full connection string (DATABASE_URL / MYSQL_URL), else fall back to discrete env vars.
const urlConfig =
  parseUrl(process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URL) ||
  {};

const host = urlConfig.host || process.env.MYSQL_HOST || process.env.DB_SERVER || "localhost";
const port = urlConfig.port || (process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306);
const user = urlConfig.user || process.env.MYSQL_USER || process.env.DB_USER || "root";
const password = urlConfig.password || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
const database =
  urlConfig.database || process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "erp_akkj";

const useSsl =
  urlConfig.ssl || process.env.MYSQL_SSL === "true" || process.env.DB_SSL === "true";
const rawLimit = Number(process.env.MYSQL_CONNECTION_LIMIT || process.env.DB_CONNECTION_LIMIT || 3);
const connectionLimit = Math.max(1, Math.min(rawLimit, 5)); // filess.io caps max_user_connections at 5

const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit,
  queueLimit: 0,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

// Log a quick ping on startup to surface connection issues early.
pool
  .getConnection()
  .then((conn) => {
    console.log(`Connected to MySQL at ${host}:${port} database ${database}`);
    conn.release();
  })
  .catch((err) => {
    console.error("Failed to connect to MySQL. Check your environment variables.", err.message);
  });

module.exports = {
  pool,
};
