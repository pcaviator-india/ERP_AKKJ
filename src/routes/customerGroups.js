const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/customer-groups -> list groups for this company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT 
         CustomerGroupID,
         CompanyID,
         GroupName,
         IsActive
       FROM CustomerGroups
       WHERE CompanyID = ?
       ORDER BY GroupName`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching customer groups:", err);
    res.status(500).json({ error: "Failed to fetch customer groups" });
  }
});

// POST /api/customer-groups -> create group
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const body = req.body || {};
  const GroupName = body.GroupName;

  if (!GroupName) {
    return res
      .status(400)
      .json({ error: "GroupName is required and body must be JSON" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO CustomerGroups (CompanyID, GroupName, IsActive)
       VALUES (?, ?, 1)`,
      [companyId, GroupName]
    );

    const [rows] = await pool.query(
      `SELECT 
         CustomerGroupID,
         CompanyID,
         GroupName,
         IsActive
       FROM CustomerGroups
       WHERE CustomerGroupID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating customer group:", err);
    res.status(500).json({ error: "Failed to create customer group" });
  }
});

// PUT /api/customer-groups/:id -> update group
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { GroupName, IsActive } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE CustomerGroups
       SET GroupName = ?, IsActive = ?
       WHERE CustomerGroupID = ? AND CompanyID = ?`,
      [GroupName, IsActive ?? 1, id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer group not found" });
    }

    const [rows] = await pool.query(
      `SELECT 
         CustomerGroupID,
         CompanyID,
         GroupName,
         IsActive
       FROM CustomerGroups
       WHERE CustomerGroupID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating customer group:", err);
    res.status(500).json({ error: "Failed to update customer group" });
  }
});

// DELETE /api/customer-groups/:id -> soft delete (IsActive = 0)
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE CustomerGroups
       SET IsActive = 0
       WHERE CustomerGroupID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer group not found" });
    }

    res.json({ message: "Customer group deactivated" });
  } catch (err) {
    console.error("Error deleting customer group:", err);
    res.status(500).json({ error: "Failed to delete customer group" });
  }
});

module.exports = router;
