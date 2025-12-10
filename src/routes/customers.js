const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/customers -> list customers for this company (optionally filter by q)
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { q } = req.query; // search text

  try {
    let sql = `
      SELECT
        CustomerID,
        CompanyID,
        CustomerName,
        ContactPerson,
        Email,
        PhoneNumber,
        TaxID,
        BillingAddressLine1,
        BillingCity,
        ShippingAddressLine1,
        ShippingCity,
        CustomerGroupID,
        CreditLimit,
        IsActive,
        CreatedAt
      FROM Customers
      WHERE CompanyID = ?
    `;
    const params = [companyId];

    if (q && q.trim() !== "") {
      sql += `
        AND (
          CustomerName LIKE ? OR
          TaxID LIKE ? OR
          Email LIKE ?
        )
      `;
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    sql += " ORDER BY CustomerName";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching customers:", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// GET /api/customers/:id -> single customer
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
         CustomerID,
         CompanyID,
         CustomerName,
         ContactPerson,
         Email,
         PhoneNumber,
         TaxID,
         BillingAddressLine1,
         BillingCity,
         ShippingAddressLine1,
         ShippingCity,
         CustomerGroupID,
         CreditLimit,
         IsActive,
         CreatedAt
       FROM Customers
       WHERE CustomerID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching customer:", err);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// POST /api/customers -> create customer
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const body = req.body || {};

  const {
    CustomerName,
    ContactPerson,
    Email,
    PhoneNumber,
    TaxID,
    BillingAddressLine1,
    BillingCity,
    ShippingAddressLine1,
    ShippingCity,
    CustomerGroupID,
    CreditLimit,
  } = body;

  if (!CustomerName) {
    return res
      .status(400)
      .json({ error: "CustomerName is required and body must be JSON" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO Customers
        (CompanyID, CustomerName, ContactPerson, Email, PhoneNumber, TaxID,
         BillingAddressLine1, BillingCity,
         ShippingAddressLine1, ShippingCity,
         CustomerGroupID, CreditLimit, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        companyId,
        CustomerName,
        ContactPerson || null,
        Email || null,
        PhoneNumber || null,
        TaxID || null,
        BillingAddressLine1 || null,
        BillingCity || null,
        ShippingAddressLine1 || null,
        ShippingCity || null,
        CustomerGroupID || null,
        CreditLimit ?? 0,
      ]
    );

    const [rows] = await pool.query(
      `SELECT
         CustomerID,
         CompanyID,
         CustomerName,
         ContactPerson,
         Email,
         PhoneNumber,
         TaxID,
         BillingAddressLine1,
         BillingCity,
         ShippingAddressLine1,
         ShippingCity,
         CustomerGroupID,
         CreditLimit,
         IsActive,
         CreatedAt
       FROM Customers
       WHERE CustomerID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating customer:", err);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

// PUT /api/customers/:id -> update customer
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  const {
    CustomerName,
    ContactPerson,
    Email,
    PhoneNumber,
    TaxID,
    BillingAddressLine1,
    BillingCity,
    ShippingAddressLine1,
    ShippingCity,
    CustomerGroupID,
    CreditLimit,
    IsActive,
  } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE Customers
       SET
         CustomerName = ?,
         ContactPerson = ?,
         Email = ?,
         PhoneNumber = ?,
         TaxID = ?,
         BillingAddressLine1 = ?,
         BillingCity = ?,
         ShippingAddressLine1 = ?,
         ShippingCity = ?,
         CustomerGroupID = ?,
         CreditLimit = ?,
         IsActive = ?
       WHERE CustomerID = ? AND CompanyID = ?`,
      [
        CustomerName,
        ContactPerson || null,
        Email || null,
        PhoneNumber || null,
        TaxID || null,
        BillingAddressLine1 || null,
        BillingCity || null,
        ShippingAddressLine1 || null,
        ShippingCity || null,
        CustomerGroupID || null,
        CreditLimit ?? 0,
        IsActive ?? 1,
        id,
        companyId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const [rows] = await pool.query(
      `SELECT
         CustomerID,
         CompanyID,
         CustomerName,
         ContactPerson,
         Email,
         PhoneNumber,
         TaxID,
         BillingAddressLine1,
         BillingCity,
         ShippingAddressLine1,
         ShippingCity,
         CustomerGroupID,
         CreditLimit,
         IsActive,
         CreatedAt
       FROM Customers
       WHERE CustomerID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating customer:", err);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

// DELETE /api/customers/:id -> soft delete (IsActive = 0)
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE Customers
       SET IsActive = 0
       WHERE CustomerID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ message: "Customer deactivated" });
  } catch (err) {
    console.error("Error deleting customer:", err);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

module.exports = router;
