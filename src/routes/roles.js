const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { requirePermission } = require("../middleware/permissions");

// GET /api/roles -> list roles for company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const [rows] = await pool.query(
      `SELECT RoleID, CompanyID, RoleName, Description
       FROM Roles
       WHERE CompanyID = ?
       ORDER BY RoleName`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching roles:", err);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// POST /api/roles -> create
router.post("/", requirePermission("roles.manage"), async (req, res) => {
  const companyId = req.user.CompanyID;
  const { RoleName, Description } = req.body || {};
  if (!RoleName || !RoleName.trim()) {
    return res.status(400).json({ error: "RoleName is required" });
  }
  try {
    const [ins] = await pool.query(
      `INSERT INTO Roles (CompanyID, RoleName, Description) VALUES (?, ?, ?)`,
      [companyId, RoleName.trim(), Description || null]
    );
    res.status(201).json({ RoleID: ins.insertId, RoleName: RoleName.trim(), Description: Description || null });
  } catch (err) {
    console.error("Error creating role:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Role name already exists for this company" });
    }
    res.status(500).json({ error: "Failed to create role" });
  }
});

// PUT /api/roles/:id -> update
router.put("/:id", requirePermission("roles.manage"), async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { RoleName, Description } = req.body || {};
  if (!RoleName || !RoleName.trim()) {
    return res.status(400).json({ error: "RoleName is required" });
  }
  try {
    const [result] = await pool.query(
      `UPDATE Roles SET RoleName = ?, Description = ? WHERE RoleID = ? AND CompanyID = ?`,
      [RoleName.trim(), Description || null, id, companyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating role:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Role name already exists for this company" });
    }
    res.status(500).json({ error: "Failed to update role" });
  }
});

// DELETE /api/roles/:id -> delete
router.delete("/:id", requirePermission("roles.manage"), async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    const [result] = await pool.query(`DELETE FROM Roles WHERE RoleID = ? AND CompanyID = ?`, [id, companyId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting role:", err);
    res.status(500).json({ error: "Failed to delete role" });
  }
});

// GET /api/roles/:id/permissions -> list permissions for a role
router.get("/:id/permissions", requirePermission("roles.manage"), async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT PermissionName FROM RolePermissions rp
       INNER JOIN Roles r ON rp.RoleID = r.RoleID
       WHERE rp.RoleID = ? AND r.CompanyID = ?`,
      [id, companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching role permissions:", err);
    res.status(500).json({ error: "Failed to fetch role permissions" });
  }
});

// PUT /api/roles/:id/permissions -> replace permissions list
router.put("/:id/permissions", requirePermission("roles.manage"), async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { permissions } = req.body || {};
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: "permissions must be an array" });
  }
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Ensure role belongs to company
      const [roles] = await conn.query(`SELECT RoleID FROM Roles WHERE RoleID = ? AND CompanyID = ?`, [id, companyId]);
      if (roles.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ error: "Role not found" });
      }
      await conn.query(`DELETE FROM RolePermissions WHERE RoleID = ?`, [id]);
      if (permissions.length) {
        const values = permissions.map((p) => [id, p]);
        await conn.query(
          `INSERT INTO RolePermissions (RoleID, PermissionName) VALUES ?`,
          [values]
        );
      }
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Error saving role permissions:", err);
    res.status(500).json({ error: "Failed to save role permissions" });
  }
});

module.exports = router;
