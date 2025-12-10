const express = require("express");
const router = express.Router();
const { pool } = require("../db");

const SUPER_ADMIN_ROLE = "SuperAdmin";

function isSuperAdmin(user = {}) {
  return user?.Role === SUPER_ADMIN_ROLE;
}

// GET /api/payment-methods -> list all methods
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT PaymentMethodID, MethodName, IsActive
       FROM PaymentMethods
       ORDER BY MethodName`
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching payment methods:", err);
    res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

// GET /api/payment-methods/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT PaymentMethodID, MethodName, IsActive
       FROM PaymentMethods
       WHERE PaymentMethodID = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching payment method:", err);
    res.status(500).json({ error: "Failed to fetch payment method" });
  }
});

// POST /api/payment-methods -> create new method (SuperAdmin only)
router.post("/", async (req, res) => {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Only SuperAdmin can create methods" });
  }

  const { MethodName, IsActive } = req.body || {};

  if (!MethodName) {
    return res.status(400).json({ error: "MethodName is required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO PaymentMethods (MethodName, IsActive)
       VALUES (?, COALESCE(?, 1))`,
      [MethodName, IsActive]
    );

    const [rows] = await pool.query(
      `SELECT PaymentMethodID, MethodName, IsActive
       FROM PaymentMethods
       WHERE PaymentMethodID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ error: "A payment method with this name already exists" });
    }

    console.error("Error creating payment method:", err);
    res.status(500).json({ error: "Failed to create payment method" });
  }
});

// PUT /api/payment-methods/:id -> update method (SuperAdmin only)
router.put("/:id", async (req, res) => {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Only SuperAdmin can update methods" });
  }

  const { id } = req.params;
  const { MethodName, IsActive } = req.body || {};

  if (!MethodName) {
    return res.status(400).json({ error: "MethodName is required" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE PaymentMethods
       SET MethodName = ?, IsActive = COALESCE(?, IsActive)
       WHERE PaymentMethodID = ?`,
      [MethodName, IsActive, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    const [rows] = await pool.query(
      `SELECT PaymentMethodID, MethodName, IsActive
       FROM PaymentMethods
       WHERE PaymentMethodID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ error: "A payment method with this name already exists" });
    }

    console.error("Error updating payment method:", err);
    res.status(500).json({ error: "Failed to update payment method" });
  }
});

// DELETE /api/payment-methods/:id -> soft delete (SuperAdmin only)
router.delete("/:id", async (req, res) => {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Only SuperAdmin can delete methods" });
  }

  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE PaymentMethods
       SET IsActive = 0
       WHERE PaymentMethodID = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    res.json({ message: "Payment method deactivated" });
  } catch (err) {
    console.error("Error deleting payment method:", err);
    res.status(500).json({ error: "Failed to delete payment method" });
  }
});

module.exports = router;
