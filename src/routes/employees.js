const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const { pool } = require("../db");

// GET /api/employees -> list employees by company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT
         EmployeeID,
         CompanyID,
         FirstName,
         LastName,
         Email,
         Role,
         PhoneNumber,
         JobTitle,
         DepartmentID,
         ReportsToEmployeeID,
         LastLoginAt,
         IsActive,
         CreatedAt
       FROM Employees
       WHERE CompanyID = ?
       ORDER BY CreatedAt DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

module.exports = router;

// PUT /api/employees/:id -> update employee (basic info, optional password)
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const {
    FirstName,
    LastName,
    Email,
    Password,
    Role,
    PhoneNumber,
    JobTitle,
    DepartmentID,
    ReportsToEmployeeID,
    IsActive,
  } = req.body || {};

  try {
    const updates = [
      "FirstName = ?",
      "LastName = ?",
      "Email = ?",
      "Role = ?",
      "PhoneNumber = ?",
      "JobTitle = ?",
      "DepartmentID = ?",
      "ReportsToEmployeeID = ?",
      "IsActive = ?",
    ];
    const params = [
      FirstName,
      LastName,
      Email,
      Role || "Employee",
      PhoneNumber || null,
      JobTitle || null,
      DepartmentID || null,
      ReportsToEmployeeID || null,
      IsActive ?? 1,
    ];
    if (Password) {
      const hash = bcrypt.hashSync(Password, 10);
      updates.push("PasswordHash = ?");
      params.push(hash);
    }
    params.push(id, companyId);

    const [result] = await pool.query(
      `
      UPDATE Employees
      SET ${updates.join(", ")}
      WHERE EmployeeID = ? AND CompanyID = ?
    `,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating employee:", err);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

// DELETE /api/employees/:id -> soft delete (IsActive = 0)
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      `UPDATE Employees SET IsActive = 0 WHERE EmployeeID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});
