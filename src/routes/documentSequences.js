const express = require("express");
const router = express.Router();
const { pool } = require("../db");

const ADMIN_ROLES = new Set(["SuperAdmin", "CompanyAdmin"]);

function requireAdmin(req, res) {
  if (!ADMIN_ROLES.has(req.user?.Role)) {
    res
      .status(403)
      .json({ error: "Only company admins can manage document sequences" });
    return false;
  }
  return true;
}

function boolToTinyint(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value ? 1 : 0;
}

// GET /api/document-sequences -> list sequences for company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { documentType, isElectronic } = req.query;

  try {
    let sql = `SELECT
         DocumentSequenceID,
         CompanyID,
         DocumentType,
         Prefix,
         NextNumber,
         Suffix,
         FormatString,
         IsElectronic,
         RangeStart,
         RangeEnd,
         LastUsedAt,
         IsActive
       FROM DocumentSequences
       WHERE CompanyID = ?`;

    const params = [companyId];

    if (documentType) {
      sql += " AND DocumentType = ?";
      params.push(documentType);
    }

    if (isElectronic !== undefined) {
      sql += " AND IsElectronic = ?";
      params.push(Number(isElectronic) ? 1 : 0);
    }

    sql += " ORDER BY DocumentType, IsElectronic DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching document sequences:", err);
    res.status(500).json({ error: "Failed to fetch document sequences" });
  }
});

// GET /api/document-sequences/:id
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
         DocumentSequenceID,
         CompanyID,
         DocumentType,
         Prefix,
         NextNumber,
         Suffix,
         FormatString,
         IsElectronic,
         RangeStart,
         RangeEnd,
         LastUsedAt,
         IsActive
       FROM DocumentSequences
       WHERE DocumentSequenceID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Document sequence not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching document sequence:", err);
    res.status(500).json({ error: "Failed to fetch document sequence" });
  }
});

// POST /api/document-sequences
router.post("/", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const companyId = req.user.CompanyID;
  const body = req.body || {};

  const {
    DocumentType,
    Prefix,
    NextNumber,
    Suffix,
    FormatString,
    IsElectronic,
    RangeStart,
    RangeEnd,
    IsActive,
  } = body;

  if (!DocumentType) {
    return res.status(400).json({ error: "DocumentType is required" });
  }

  const nextNumberValue =
    NextNumber != null && !Number.isNaN(Number(NextNumber))
      ? Number(NextNumber)
      : 1;

  try {
    const [result] = await pool.query(
      `INSERT INTO DocumentSequences
        (CompanyID, DocumentType, Prefix, NextNumber, Suffix,
         FormatString, IsElectronic, RangeStart, RangeEnd, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 1))`,
      [
        companyId,
        DocumentType,
        Prefix || null,
        nextNumberValue,
        Suffix || null,
        FormatString || null,
        boolToTinyint(IsElectronic, 1),
        RangeStart || null,
        RangeEnd || null,
        IsActive,
      ]
    );

    const [rows] = await pool.query(
      `SELECT
         DocumentSequenceID,
         CompanyID,
         DocumentType,
         Prefix,
         NextNumber,
         Suffix,
         FormatString,
         IsElectronic,
         RangeStart,
         RangeEnd,
         LastUsedAt,
         IsActive
       FROM DocumentSequences
       WHERE DocumentSequenceID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error:
          "Sequence already exists for this document type and electronic flag",
      });
    }
    console.error("Error creating document sequence:", err);
    res.status(500).json({ error: "Failed to create document sequence" });
  }
});

// PUT /api/document-sequences/:id
router.put("/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const body = req.body || {};

  const {
    Prefix,
    NextNumber,
    Suffix,
    FormatString,
    IsElectronic,
    RangeStart,
    RangeEnd,
    IsActive,
  } = body;

  try {
    const [result] = await pool.query(
      `UPDATE DocumentSequences
       SET
         Prefix = ?,
         NextNumber = COALESCE(?, NextNumber),
         Suffix = ?,
         FormatString = ?,
         IsElectronic = COALESCE(?, IsElectronic),
         RangeStart = ?,
         RangeEnd = ?,
         IsActive = COALESCE(?, IsActive)
       WHERE DocumentSequenceID = ? AND CompanyID = ?`,
      [
        Prefix || null,
        NextNumber != null ? Number(NextNumber) : null,
        Suffix || null,
        FormatString || null,
        IsElectronic != null ? boolToTinyint(IsElectronic) : null,
        RangeStart || null,
        RangeEnd || null,
        IsActive,
        id,
        companyId,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Document sequence not found" });
    }

    const [rows] = await pool.query(
      `SELECT
         DocumentSequenceID,
         CompanyID,
         DocumentType,
         Prefix,
         NextNumber,
         Suffix,
         FormatString,
         IsElectronic,
         RangeStart,
         RangeEnd,
         LastUsedAt,
         IsActive
       FROM DocumentSequences
       WHERE DocumentSequenceID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error:
          "Sequence already exists for this document type and electronic flag",
      });
    }
    console.error("Error updating document sequence:", err);
    res.status(500).json({ error: "Failed to update document sequence" });
  }
});

// DELETE /api/document-sequences/:id -> soft delete
router.delete("/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE DocumentSequences
       SET IsActive = 0
       WHERE DocumentSequenceID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Document sequence not found" });
    }

    res.json({ message: "Document sequence deactivated" });
  } catch (err) {
    console.error("Error deleting document sequence:", err);
    res.status(500).json({ error: "Failed to delete document sequence" });
  }
});

module.exports = router;
