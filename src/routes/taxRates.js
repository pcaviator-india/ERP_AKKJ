const express = require("express");
const router = express.Router();
const { pool } = require("../db");

const VALID_APPLIES = new Set(["goods", "services", "all"]);

function normalizeRate(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : Math.max(0, n);
}

router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const [rows] = await pool.query(
      `SELECT TaxRateID, Name, RatePercentage, AppliesTo, IsDefault, EffectiveFrom, EffectiveTo, IsActive
         FROM TaxRates
        WHERE CompanyID = ?
        ORDER BY IsDefault DESC, Name ASC`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching tax rates:", err);
    res.status(500).json({ error: "Failed to fetch tax rates" });
  }
});

router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { Name, RatePercentage, AppliesTo = "all", IsDefault = false, EffectiveFrom = null, EffectiveTo = null, IsActive = true } =
    req.body || {};

  if (!Name || !Name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!VALID_APPLIES.has(AppliesTo)) {
    return res.status(400).json({ error: "AppliesTo must be goods, services, or all" });
  }
  const rate = normalizeRate(RatePercentage);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (IsDefault) {
      await conn.query(`UPDATE TaxRates SET IsDefault = 0 WHERE CompanyID = ?`, [companyId]);
    }
    const [result] = await conn.query(
      `INSERT INTO TaxRates
        (CompanyID, Name, RatePercentage, AppliesTo, IsDefault, EffectiveFrom, EffectiveTo, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, Name.trim(), rate, AppliesTo, IsDefault ? 1 : 0, EffectiveFrom || null, EffectiveTo || null, IsActive ? 1 : 0]
    );
    await conn.commit();
    res.status(201).json({ TaxRateID: result.insertId });
  } catch (err) {
    await conn.rollback();
    console.error("Error creating tax rate:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "A tax rate with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create tax rate" });
  } finally {
    conn.release();
  }
});

router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const {
    Name,
    RatePercentage,
    AppliesTo,
    IsDefault,
    EffectiveFrom = null,
    EffectiveTo = null,
    IsActive,
  } = req.body || {};

  if (Name !== undefined && !Name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (AppliesTo !== undefined && !VALID_APPLIES.has(AppliesTo)) {
    return res.status(400).json({ error: "AppliesTo must be goods, services, or all" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (IsDefault === true) {
      await conn.query(`UPDATE TaxRates SET IsDefault = 0 WHERE CompanyID = ?`, [companyId]);
    }

    const [result] = await conn.query(
      `UPDATE TaxRates
          SET Name = COALESCE(?, Name),
              RatePercentage = COALESCE(?, RatePercentage),
              AppliesTo = COALESCE(?, AppliesTo),
              IsDefault = COALESCE(?, IsDefault),
              EffectiveFrom = ?,
              EffectiveTo = ?,
              IsActive = COALESCE(?, IsActive)
        WHERE TaxRateID = ? AND CompanyID = ?`,
      [
        Name ? Name.trim() : null,
        RatePercentage !== undefined ? normalizeRate(RatePercentage) : null,
        AppliesTo || null,
        IsDefault === undefined ? null : IsDefault ? 1 : 0,
        EffectiveFrom || null,
        EffectiveTo || null,
        IsActive === undefined ? null : IsActive ? 1 : 0,
        id,
        companyId,
      ]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Tax rate not found" });
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error("Error updating tax rate:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "A tax rate with this name already exists" });
    }
    res.status(500).json({ error: "Failed to update tax rate" });
  } finally {
    conn.release();
  }
});

router.put("/:id/default", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [found] = await conn.query(`SELECT TaxRateID FROM TaxRates WHERE TaxRateID = ? AND CompanyID = ?`, [id, companyId]);
      if (found.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ error: "Tax rate not found" });
      }
      await conn.query(`UPDATE TaxRates SET IsDefault = 0 WHERE CompanyID = ?`, [companyId]);
      await conn.query(`UPDATE TaxRates SET IsDefault = 1 WHERE TaxRateID = ? AND CompanyID = ?`, [id, companyId]);
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Error setting default tax rate:", err);
    res.status(500).json({ error: "Failed to set default tax rate" });
  }
});

module.exports = router;
