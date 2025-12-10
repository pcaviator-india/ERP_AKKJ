const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/brands -> by company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT 
         ProductBrandID,
         CompanyID,
         BrandName,
         IsActive
       FROM ProductBrands
       WHERE CompanyID = ?
       ORDER BY BrandName`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching brands:", err);
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

// POST /api/brands
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { BrandName } = req.body;

  if (!BrandName) {
    return res.status(400).json({ error: "BrandName is required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO ProductBrands 
        (CompanyID, BrandName, IsActive)
       VALUES (?, ?, 1)`,
      [companyId, BrandName]
    );

    const [rows] = await pool.query(
      `SELECT 
         ProductBrandID,
         CompanyID,
         BrandName,
         IsActive
       FROM ProductBrands
       WHERE ProductBrandID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating brand:", err);
    // could be UNIQUE constraint (CompanyID, BrandName)
    res.status(500).json({ error: "Failed to create brand" });
  }
});

// PUT /api/brands/:id
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { BrandName, IsActive } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE ProductBrands
       SET BrandName = ?, IsActive = ?
       WHERE ProductBrandID = ? AND CompanyID = ?`,
      [BrandName, IsActive ?? 1, id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Brand not found" });
    }

    const [rows] = await pool.query(
      `SELECT 
         ProductBrandID,
         CompanyID,
         BrandName,
         IsActive
       FROM ProductBrands
       WHERE ProductBrandID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating brand:", err);
    res.status(500).json({ error: "Failed to update brand" });
  }
});

// DELETE /api/brands/:id -> soft delete
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE ProductBrands
       SET IsActive = 0
       WHERE ProductBrandID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Brand not found" });
    }

    res.json({ message: "Brand deactivated" });
  } catch (err) {
    console.error("Error deleting brand:", err);
    res.status(500).json({ error: "Failed to delete brand" });
  }
});

module.exports = router;
