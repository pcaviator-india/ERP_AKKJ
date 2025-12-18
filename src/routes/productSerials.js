const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/product-serials?productId&status
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { productId, status } = req.query;
  try {
    let sql = `SELECT ProductSerialID, CompanyID, ProductID, SerialNumber, Status, CreatedAt
               FROM Productserials
               WHERE CompanyID = ?`;
    const params = [companyId];
    if (productId) {
      sql += " AND ProductID = ?";
      params.push(productId);
    }
    if (status) {
      sql += " AND Status = ?";
      params.push(status);
    }
    sql += " ORDER BY CreatedAt DESC LIMIT 500";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Failed to fetch product serials", err);
    res.status(500).json({ error: "Failed to fetch product serials" });
  }
});

// POST /api/product-serials/intake
// body: { ProductID, WarehouseID, serials: [string|{SerialNumber, Status?}] }
router.post("/intake", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { ProductID, WarehouseID, serials } = req.body || {};

  if (!ProductID || !WarehouseID) {
    return res.status(400).json({ error: "ProductID and WarehouseID are required." });
  }
  if (!Array.isArray(serials) || serials.length === 0) {
    return res.status(400).json({ error: "Serial list is required." });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Ensure product belongs to company and is serial-tracked
    const [prodRows] = await conn.query(
      "SELECT UsesSerials FROM Products WHERE ProductID = ? AND CompanyID = ?",
      [ProductID, companyId]
    );
    if (!prodRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Product not found" });
    }
    if (Number(prodRows[0].UsesSerials || 0) !== 1) {
      await conn.rollback();
      return res.status(400).json({ error: "Product is not serial-tracked." });
    }

    // Normalize serials
    const normalized = [];
    serials.forEach((item) => {
      if (item == null) return;
      if (typeof item === "string") {
        const sn = item.trim();
        if (sn) normalized.push({ SerialNumber: sn, Status: "InStock" });
      } else if (typeof item === "object") {
        const sn = String(item.SerialNumber || "").trim();
        if (sn) normalized.push({ SerialNumber: sn, Status: item.Status || "InStock" });
      }
    });

    if (normalized.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "No valid serials provided." });
    }

    // Deduplicate within payload
    const seen = new Set();
    const payload = normalized.filter(({ SerialNumber }) => {
      const key = SerialNumber.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const created = [];
    const duplicates = [];

    for (const item of payload) {
      try {
        const [ins] = await conn.query(
          `INSERT INTO Productserials (CompanyID, ProductID, SerialNumber, Status)
           VALUES (?, ?, ?, ?)`,
          [companyId, ProductID, item.SerialNumber, item.Status || "InStock"]
        );
        created.push({ ProductSerialID: ins.insertId, SerialNumber: item.SerialNumber });
      } catch (err) {
        if (err && err.code === "ER_DUP_ENTRY") {
          duplicates.push(item.SerialNumber);
          continue;
        }
        throw err;
      }
    }

    // Bump inventory level for the warehouse by created count
    if (created.length > 0) {
      const qty = created.length;
      await conn.query(
        `INSERT INTO ProductInventoryLevels
           (ProductID, WarehouseID, StockQuantity, ReservedQuantity, MinStockLevel, MaxStockLevel, LastUpdatedAt, ProductLotID)
         VALUES (?, ?, ?, 0, 0, 0, NOW(), NULL)
         ON DUPLICATE KEY UPDATE StockQuantity = StockQuantity + VALUES(StockQuantity), LastUpdatedAt = NOW()`,
        [ProductID, WarehouseID, qty]
      );
    }

    await conn.commit();
    res.json({ created: created.length, duplicates, createdItems: created });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Failed to intake serials", err);
    res.status(500).json({ error: "Failed to intake serials" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
