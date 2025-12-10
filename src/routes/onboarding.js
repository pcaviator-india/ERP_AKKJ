const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");

const router = express.Router();
const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

async function ensureRoleColumn(conn) {
  const [columns] = await conn.query(
    "SHOW COLUMNS FROM Employees LIKE 'Role'"
  );
  if (!columns.length) {
    await conn.query(
      "ALTER TABLE Employees ADD COLUMN Role VARCHAR(100) DEFAULT 'Employee' AFTER PasswordHash"
    );
  }
}

router.post("/register", async (req, res) => {
  const {
    CompanyName,
    LegalName,
    TaxID,
    AddressLine1,
    City,
    CountryCode = "CL",
    AdminFirstName,
    AdminLastName,
    AdminEmail,
    Password,
  } = req.body || {};

  if (
    !CompanyName ||
    !AdminFirstName ||
    !AdminLastName ||
    !AdminEmail ||
    !Password
  ) {
    return res.status(400).json({
      error:
        "CompanyName, AdminFirstName, AdminLastName, AdminEmail and Password are required",
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    await ensureRoleColumn(conn);

    const [companyResult] = await conn.query(
      `INSERT INTO Companies
        (CompanyName, LegalName, TaxID, AddressLine1, City, CountryCode, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        CompanyName,
        LegalName || null,
        TaxID || null,
        AddressLine1 || null,
        City || null,
        CountryCode || "CL",
      ]
    );

    const companyId = companyResult.insertId;
    const hash = bcrypt.hashSync(Password, 10);

    const [employeeResult] = await conn.query(
      `INSERT INTO Employees
        (CompanyID, FirstName, LastName, Email, PasswordHash, Role, IsActive, CreatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        companyId,
        AdminFirstName,
        AdminLastName,
        AdminEmail,
        hash,
        "CompanyAdmin",
      ]
    );

    const employeeId = employeeResult.insertId;

    const payload = {
      EmployeeID: employeeId,
      CompanyID: companyId,
      Email: AdminEmail,
      Role: "CompanyAdmin",
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN,
    });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
      expiresIn: REFRESH_EXPIRES_IN,
    });

    await conn.commit();

    res.status(201).json({
      message: "Company and administrator created",
      token,
      refreshToken,
      company: {
        CompanyID: companyId,
        CompanyName,
        LegalName: LegalName || CompanyName,
      },
      admin: {
        EmployeeID: employeeId,
        FirstName: AdminFirstName,
        LastName: AdminLastName,
        Email: AdminEmail,
        Role: "CompanyAdmin",
      },
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Onboarding register error:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error: "A company or user with this identifier already exists",
      });
    }

    res.status(500).json({ error: "Failed to register account" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
