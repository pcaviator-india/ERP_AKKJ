const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/warehouses -> list warehouses for this company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT
         WarehouseID,
         CompanyID,
         WarehouseName,
         AddressLine1,
         City,
         IsDefault,
         IsActive,
         CreatedAt
       FROM Warehouses
       WHERE CompanyID = ?
       ORDER BY WarehouseName`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching warehouses:", err);
    res.status(500).json({ error: "Failed to fetch warehouses" });
  }
});

// POST /api/warehouses -> create warehouse
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const body = req.body || {};
  const { WarehouseName, AddressLine1, City, IsDefault } = body;

  if (!WarehouseName) {
    return res.status(400).json({ error: "WarehouseName is required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO Warehouses
        (CompanyID, WarehouseName, AddressLine1, City, IsDefault, IsActive)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        companyId,
        WarehouseName,
        AddressLine1 || null,
        City || null,
        IsDefault ? 1 : 0,
      ]
    );

    const [rows] = await pool.query(
      `SELECT
         WarehouseID,
         CompanyID,
         WarehouseName,
         AddressLine1,
         City,
         IsDefault,
         IsActive,
         CreatedAt
       FROM Warehouses
       WHERE WarehouseID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating warehouse:", err);
    res.status(500).json({ error: "Failed to create warehouse" });
  }
});

// PUT /api/warehouses/:id -> update
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const body = req.body || {};
  const { WarehouseName, AddressLine1, City, IsDefault, IsActive } = body;

  try {
    const [result] = await pool.query(
      `UPDATE Warehouses
       SET
         WarehouseName = ?,
         AddressLine1 = ?,
         City = ?,
         IsDefault = ?,
         IsActive = ?
       WHERE WarehouseID = ? AND CompanyID = ?`,
      [
        WarehouseName,
        AddressLine1 || null,
        City || null,
        IsDefault ? 1 : 0,
        IsActive ?? 1,
        id,
        companyId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Warehouse not found" });
    }

    const [rows] = await pool.query(
      `SELECT
         WarehouseID,
         CompanyID,
         WarehouseName,
         AddressLine1,
         City,
         IsDefault,
         IsActive,
         CreatedAt
       FROM Warehouses
       WHERE WarehouseID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating warehouse:", err);
    res.status(500).json({ error: "Failed to update warehouse" });
  }
});

// DELETE /api/warehouses/:id -> soft delete
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE Warehouses
       SET IsActive = 0
       WHERE WarehouseID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Warehouse not found" });
    }

    res.json({ message: "Warehouse deactivated" });
  } catch (err) {
    console.error("Error deleting warehouse:", err);
    res.status(500).json({ error: "Failed to delete warehouse" });
  }
});

module.exports = router;
