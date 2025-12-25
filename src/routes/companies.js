const express = require("express");
const router = express.Router();
const { pool } = require("../db");

const SUPER_ADMIN_ROLE = "SuperAdmin";
function isSuperAdmin(user = {}) {
  return user?.Role === SUPER_ADMIN_ROLE;
}

// GET /api/companies  -> list all
router.get("/", async (req, res) => {
  const user = req.user;
  const superAdmin = isSuperAdmin(user);

  try {
    let sql = `SELECT 
        CompanyID,
        CompanyName,
        LegalName,
        TaxID,
        AddressLine1,
        City,
        CountryCode,
        Email,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM Companies`;

    const params = [];

    if (!superAdmin) {
      sql += " WHERE CompanyID = ?";
      params.push(user.CompanyID);
    }

    sql += " ORDER BY CompanyName";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

// GET /api/companies/:id  -> single company
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  if (!isSuperAdmin(user) && Number(id) !== Number(user.CompanyID)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT 
        CompanyID,
        CompanyName,
        LegalName,
        TaxID,
        AddressLine1,
        City,
        CountryCode,
        Email,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM Companies
      WHERE CompanyID = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching company:", err);
    res.status(500).json({ error: "Failed to fetch company" });
  }
});

// POST /api/companies  -> create new company
router.post("/", async (req, res) => {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Only SuperAdmin can create companies" });
  }

  const { CompanyName, LegalName, TaxID, City, CountryCode, Email } = req.body;

  // Accept AddressLine1 from client (address field)
  const { AddressLine1 } = req.body;
  if (!CompanyName) {
    return res.status(400).json({ error: "CompanyName is required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO Companies 
        (CompanyName, LegalName, TaxID, City, CountryCode, AddressLine1, Email, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [CompanyName, LegalName, TaxID, City, CountryCode, AddressLine1, Email]
    );

    const newId = result.insertId;

    const [rows] = await pool.query(
      `SELECT 
        CompanyID,
        CompanyName,
        LegalName,
        TaxID,
        AddressLine1,
        City,
        CountryCode,
        Email,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM Companies
      WHERE CompanyID = ?`,
      [newId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating company:", err);
    res.status(500).json({ error: "Failed to create company" });
  }
});

// PUT /api/companies/:id  -> update company
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  if (!isSuperAdmin(user) && Number(id) !== Number(user.CompanyID)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { CompanyName, LegalName, TaxID, City, CountryCode, Email, IsActive } =
    req.body;
  const { AddressLine1 } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE Companies
       SET 
         CompanyName = ?,
         LegalName = ?,
         TaxID = ?,
         City = ?,
         CountryCode = ?,
         AddressLine1 = ?,
         Email = ?,
         IsActive = ?
       WHERE CompanyID = ?`,
      [
        CompanyName,
        LegalName,
        TaxID,
        City,
        CountryCode,
        AddressLine1,
        Email,
        IsActive ?? 1,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const [rows] = await pool.query(
      `SELECT 
        CompanyID,
        CompanyName,
        LegalName,
        TaxID,
        AddressLine1,
        City,
        CountryCode,
        Email,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM Companies
      WHERE CompanyID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating company:", err);
    res.status(500).json({ error: "Failed to update company" });
  }
});

// DELETE /api/companies/:id  -> soft delete (IsActive = 0)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  if (!isSuperAdmin(user) && Number(id) !== Number(user.CompanyID)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE Companies
       SET IsActive = 0
       WHERE CompanyID = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({ message: "Company deactivated" });
  } catch (err) {
    console.error("Error deleting company:", err);
    res.status(500).json({ error: "Failed to delete company" });
  }
});

module.exports = router;
