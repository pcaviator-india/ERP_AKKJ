const express = require("express");
const router = express.Router();
const { pool } = require("../db");

const ADMIN_ROLES = new Set(["SuperAdmin", "CompanyAdmin"]);

function requireCompanyAdmin(req, res) {
  if (!ADMIN_ROLES.has(req.user?.Role)) {
    res
      .status(403)
      .json({ error: "Only company admins can manage bank accounts" });
    return false;
  }
  return true;
}

// GET /api/bank-accounts -> list accounts for current company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT
         ba.BankAccountID,
         ba.CompanyID,
         ba.GLAccountID,
         ba.AccountName,
         ba.AccountNumber,
         ba.BankName,
         ba.BranchName,
         ba.CurrencyID,
         c.CurrencyCode,
         c.CurrencyName,
         ba.IsActive,
         ba.CreatedAt
       FROM BankAccounts ba
       LEFT JOIN Currencies c ON ba.CurrencyID = c.CurrencyID
       WHERE ba.CompanyID = ?
       ORDER BY ba.AccountName`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching bank accounts:", err);
    res.status(500).json({ error: "Failed to fetch bank accounts" });
  }
});

// GET /api/bank-accounts/:id
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
         ba.BankAccountID,
         ba.CompanyID,
         ba.GLAccountID,
         ba.AccountName,
         ba.AccountNumber,
         ba.BankName,
         ba.BranchName,
         ba.CurrencyID,
         ba.IsActive,
         ba.CreatedAt
       FROM BankAccounts ba
       WHERE ba.BankAccountID = ? AND ba.CompanyID = ?`,
      [id, companyId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Bank account not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching bank account:", err);
    res.status(500).json({ error: "Failed to fetch bank account" });
  }
});

// POST /api/bank-accounts -> create (CompanyAdmin or SuperAdmin)
router.post("/", async (req, res) => {
  if (!requireCompanyAdmin(req, res)) return;

  const companyId = req.user.CompanyID;
  const body = req.body || {};

  const {
    GLAccountID,
    AccountName,
    AccountNumber,
    BankName,
    BranchName,
    CurrencyID,
    IsActive,
  } = body;

  if (!GLAccountID || !AccountName || !AccountNumber || !CurrencyID) {
    return res.status(400).json({
      error:
        "GLAccountID, AccountName, AccountNumber and CurrencyID are required",
    });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO BankAccounts
        (CompanyID, GLAccountID, AccountName, AccountNumber,
         BankName, BranchName, CurrencyID, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 1))`,
      [
        companyId,
        GLAccountID,
        AccountName,
        AccountNumber,
        BankName || null,
        BranchName || null,
        CurrencyID,
        IsActive,
      ]
    );

    const [rows] = await pool.query(
      `SELECT
         BankAccountID, CompanyID, GLAccountID,
         AccountName, AccountNumber, BankName, BranchName,
         CurrencyID, IsActive, CreatedAt
       FROM BankAccounts
       WHERE BankAccountID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      const message = err.sqlMessage.includes("GLAccountID")
        ? "A bank account already exists for this GL account"
        : "Account number already exists for this company";
      return res.status(400).json({ error: message });
    }

    console.error("Error creating bank account:", err);
    res.status(500).json({ error: "Failed to create bank account" });
  }
});

// PUT /api/bank-accounts/:id -> update
router.put("/:id", async (req, res) => {
  if (!requireCompanyAdmin(req, res)) return;

  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const body = req.body || {};

  const {
    GLAccountID,
    AccountName,
    AccountNumber,
    BankName,
    BranchName,
    CurrencyID,
    IsActive,
  } = body;

  try {
    const [result] = await pool.query(
      `UPDATE BankAccounts
       SET
         GLAccountID = COALESCE(?, GLAccountID),
         AccountName = COALESCE(?, AccountName),
         AccountNumber = COALESCE(?, AccountNumber),
         BankName = COALESCE(?, BankName),
         BranchName = COALESCE(?, BranchName),
         CurrencyID = COALESCE(?, CurrencyID),
         IsActive = COALESCE(?, IsActive)
       WHERE BankAccountID = ? AND CompanyID = ?`,
      [
        GLAccountID || null,
        AccountName || null,
        AccountNumber || null,
        BankName || null,
        BranchName || null,
        CurrencyID || null,
        IsActive,
        id,
        companyId,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Bank account not found" });
    }

    const [rows] = await pool.query(
      `SELECT
         BankAccountID, CompanyID, GLAccountID,
         AccountName, AccountNumber, BankName, BranchName,
         CurrencyID, IsActive, CreatedAt
       FROM BankAccounts
       WHERE BankAccountID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      const message = err.sqlMessage.includes("GLAccountID")
        ? "A bank account already exists for this GL account"
        : "Account number already exists for this company";
      return res.status(400).json({ error: message });
    }
    console.error("Error updating bank account:", err);
    res.status(500).json({ error: "Failed to update bank account" });
  }
});

// DELETE /api/bank-accounts/:id -> soft delete
router.delete("/:id", async (req, res) => {
  if (!requireCompanyAdmin(req, res)) return;

  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE BankAccounts
       SET IsActive = 0
       WHERE BankAccountID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Bank account not found" });
    }

    res.json({ message: "Bank account deactivated" });
  } catch (err) {
    console.error("Error deleting bank account:", err);
    res.status(500).json({ error: "Failed to delete bank account" });
  }
});

module.exports = router;
