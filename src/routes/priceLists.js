const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/price-lists
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const [rows] = await pool.query(
      `SELECT PriceListID, Name, IsActive, CreatedAt
       FROM PriceLists
       WHERE CompanyID = ?
       ORDER BY Name`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching price lists", err);
    res.status(500).json({ error: "Failed to fetch price lists" });
  }
});

// POST /api/price-lists
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { Name, IsActive = 1 } = req.body || {};
  if (!Name) return res.status(400).json({ error: "Name is required" });
  try {
    const [result] = await pool.query(
      `INSERT INTO PriceLists (CompanyID, Name, IsActive)
       VALUES (?, ?, ?)`,
      [companyId, Name, IsActive ? 1 : 0]
    );
    const [rows] = await pool.query(
      `SELECT PriceListID, Name, IsActive, CreatedAt
       FROM PriceLists WHERE PriceListID = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating price list", err);
    res.status(500).json({ error: "Failed to create price list" });
  }
});

// PUT /api/price-lists/:id
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { Name, IsActive } = req.body || {};
  try {
    const [result] = await pool.query(
      `UPDATE PriceLists SET Name = COALESCE(?, Name), IsActive = COALESCE(?, IsActive)
       WHERE PriceListID = ? AND CompanyID = ?`,
      [Name, IsActive, id, companyId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Price list not found" });
    const [rows] = await pool.query(
      `SELECT PriceListID, Name, IsActive, CreatedAt FROM PriceLists WHERE PriceListID = ?`,
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating price list", err);
    res.status(500).json({ error: "Failed to update price list" });
  }
});

// GET /api/price-lists/:id/items
router.get("/:id/items", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    const [items] = await pool.query(
      `SELECT
         pli.PriceListItemID,
         pli.PriceListID,
         pli.ProductID,
         p.ProductName,
         p.SKU,
         pli.MinQty,
         pli.Price,
         pli.IsActive,
         pli.CreatedAt,
         (
           SELECT pi.ImageUrl
           FROM ProductImages pi
           WHERE pi.ProductID = p.ProductID
           ORDER BY pi.IsPrimary DESC, pi.ProductImageID ASC
           LIMIT 1
         ) AS PrimaryImageURL
       FROM PriceListItems pli
       INNER JOIN PriceLists pl ON pli.PriceListID = pl.PriceListID
       INNER JOIN Products p ON pli.ProductID = p.ProductID
       WHERE pli.PriceListID = ? AND pl.CompanyID = ?
       ORDER BY p.ProductName, pli.MinQty`,
      [id, companyId]
    );
    res.json(items);
  } catch (err) {
    console.error("Error fetching price list items", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// PUT /api/price-lists/:id/items  (replace all items)
router.put("/:id/items", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const entries = Array.isArray(req.body?.items) ? req.body.items : [];
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [pl] = await conn.query(
      `SELECT PriceListID FROM PriceLists WHERE PriceListID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (pl.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Price list not found" });
    }

    // Soft delete existing items
    await conn.query(`DELETE FROM PriceListItems WHERE PriceListID = ?`, [id]);

    for (const entry of entries) {
      const { ProductID, MinQty, Price, IsActive = 1 } = entry || {};
      if (!ProductID || Price === undefined || Price === null) continue;
      await conn.query(
        `INSERT INTO PriceListItems (PriceListID, ProductID, MinQty, Price, IsActive)
         VALUES (?, ?, ?, ?, ?)`,
        [id, ProductID, MinQty ?? 1, Price, IsActive ? 1 : 0]
      );
    }

    await conn.commit();
    res.json({ updated: entries.length });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error saving price list items", err);
    res.status(500).json({ error: "Failed to save items" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
