const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/suppliers -> list suppliers (with optional search ?q=)
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { q } = req.query;

  try {
    let sql = `
      SELECT
        SupplierID,
        CompanyID,
        SupplierName,
        ContactPerson,
        Email,
        PhoneNumber,
        TaxID,
        AddressLine1,
        City,
        IsActive,
        CreatedAt
      FROM Suppliers
      WHERE CompanyID = ?
    `;
    const params = [companyId];

    if (q && q.trim() !== "") {
      sql += `
        AND (
          SupplierName LIKE ? OR
          TaxID LIKE ? OR
          Email LIKE ?
        )
      `;
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    sql += " ORDER BY SupplierName";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching suppliers:", err);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

// GET /api/suppliers/:id -> single supplier
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
         SupplierID,
         CompanyID,
         SupplierName,
         ContactPerson,
         Email,
         PhoneNumber,
         TaxID,
         AddressLine1,
         City,
         IsActive,
         CreatedAt
       FROM Suppliers
       WHERE SupplierID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching supplier:", err);
    res.status(500).json({ error: "Failed to fetch supplier" });
  }
});

// POST /api/suppliers -> create supplier
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const body = req.body || {};

  const {
    SupplierName,
    ContactPerson,
    Email,
    PhoneNumber,
    TaxID,
    AddressLine1,
    City,
  } = body;

  if (!SupplierName) {
    return res.status(400).json({ error: "SupplierName is required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO Suppliers
        (CompanyID, SupplierName, ContactPerson, Email, PhoneNumber, TaxID,
         AddressLine1, City, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        companyId,
        SupplierName,
        ContactPerson || null,
        Email || null,
        PhoneNumber || null,
        TaxID || null,
        AddressLine1 || null,
        City || null,
      ]
    );

    const [rows] = await pool.query(
      `SELECT
         SupplierID,
         CompanyID,
         SupplierName,
         ContactPerson,
         Email,
         PhoneNumber,
         TaxID,
         AddressLine1,
         City,
         IsActive,
         CreatedAt
       FROM Suppliers
       WHERE SupplierID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating supplier:", err);

    // handle unique constraint on (CompanyID, TaxID)
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({
          error: "A supplier with this TaxID already exists for this company",
        });
    }

    res.status(500).json({ error: "Failed to create supplier" });
  }
});

// PUT /api/suppliers/:id -> update supplier
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const body = req.body || {};

  const {
    SupplierName,
    ContactPerson,
    Email,
    PhoneNumber,
    TaxID,
    AddressLine1,
    City,
    IsActive,
  } = body;

  try {
    const [result] = await pool.query(
      `UPDATE Suppliers
       SET
         SupplierName = ?,
         ContactPerson = ?,
         Email = ?,
         PhoneNumber = ?,
         TaxID = ?,
         AddressLine1 = ?,
         City = ?,
         IsActive = ?
       WHERE SupplierID = ? AND CompanyID = ?`,
      [
        SupplierName,
        ContactPerson || null,
        Email || null,
        PhoneNumber || null,
        TaxID || null,
        AddressLine1 || null,
        City || null,
        IsActive ?? 1,
        id,
        companyId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const [rows] = await pool.query(
      `SELECT
         SupplierID,
         CompanyID,
         SupplierName,
         ContactPerson,
         Email,
         PhoneNumber,
         TaxID,
         AddressLine1,
         City,
         IsActive,
         CreatedAt
       FROM Suppliers
       WHERE SupplierID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating supplier:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({
          error: "A supplier with this TaxID already exists for this company",
        });
    }

    res.status(500).json({ error: "Failed to update supplier" });
  }
});

// DELETE /api/suppliers/:id -> soft delete
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE Suppliers
       SET IsActive = 0
       WHERE SupplierID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    res.json({ message: "Supplier deactivated" });
  } catch (err) {
    console.error("Error deleting supplier:", err);
    res.status(500).json({ error: "Failed to delete supplier" });
  }
});

module.exports = router;
