const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");
const { computeUserPermissions } = require("../middleware/permissions");

const ADMIN_ROLES = new Set(["SuperAdmin", "CompanyAdmin"]);
const SUPER_ADMIN_ROLE = "SuperAdmin";

const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;

function canManageEmployees(user = {}) {
  return user && ADMIN_ROLES.has(user.Role);
}

function buildTokens(payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
  return { token, refreshToken };
}

function isValidPin(pin) {
  return typeof pin === "string" && /^\d+$/.test(pin) && pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH;
}

async function hashPin(pin) {
  const saltRounds = 8; // small enough for PIN but still hashed
  return bcrypt.hash(pin, saltRounds);
}

// POST /api/auth/register
router.post("/register", authMiddleware, async (req, res) => {
  const actor = req.user;
  if (!canManageEmployees(actor)) {
    return res
      .status(403)
      .json({ error: "Only admins can register new employees" });
  }

  const {
    CompanyID: companyIdFromBody,
    FirstName,
    LastName,
    Email,
    Password,
    Role: requestedRole,
    PhoneNumber,
    JobTitle,
    DepartmentID,
    ReportsToEmployeeID,
    IsActive,
  } = req.body;

  const targetCompanyId =
    actor.Role === SUPER_ADMIN_ROLE
      ? companyIdFromBody || actor.CompanyID
      : actor.CompanyID;

  if (!targetCompanyId) {
    return res.status(400).json({ error: "CompanyID is required" });
  }

  if (!FirstName || !LastName || !Email || !Password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Ensure email is unique inside the company
    const [existing] = await pool.query(
      `SELECT EmployeeID FROM Employees WHERE CompanyID = ? AND Email = ? LIMIT 1`,
      [targetCompanyId, Email]
    );

    if (existing.length) {
      return res
        .status(409)
        .json({ error: "Email already registered for this company" });
    }

    const newEmployeeRole =
      requestedRole && requestedRole.trim().length > 0
        ? requestedRole.trim()
        : "Employee";

    if (
      newEmployeeRole === SUPER_ADMIN_ROLE &&
      actor.Role !== SUPER_ADMIN_ROLE
    ) {
      return res
        .status(403)
        .json({ error: "Only SuperAdmin can assign the SuperAdmin role" });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(Password, salt);

    const [result] = await pool.query(
      `INSERT INTO Employees 
        (CompanyID, FirstName, LastName, Email, PasswordHash, Role, PhoneNumber, JobTitle, DepartmentID, ReportsToEmployeeID, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetCompanyId,
        FirstName,
        LastName,
        Email,
        hash,
        newEmployeeRole,
        PhoneNumber || null,
        JobTitle || null,
        DepartmentID || null,
        ReportsToEmployeeID || null,
        IsActive ?? 1,
      ]
    );

    res.json({ message: "Employee registered", EmployeeID: result.insertId });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register employee" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { Email, Password } = req.body;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM Employees WHERE Email = ? AND IsActive = 1`,
      [Email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = rows[0];

    const valid = bcrypt.compareSync(Password, user.PasswordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const payload = {
      EmployeeID: user.EmployeeID,
      CompanyID: user.CompanyID,
      Email: user.Email,
      Role: user.Role,
    };

    const { token, refreshToken } = buildTokens(payload);

    // Update last login timestamp (fire-and-forget; errors won't block login)
    pool
      .query(`UPDATE Employees SET LastLoginAt = NOW() WHERE EmployeeID = ?`, [
        user.EmployeeID,
      ])
      .catch((err) => console.warn("Failed to update LastLoginAt", err));

    res.json({ token, refreshToken });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

// POST /api/auth/set-pin -> set or reset PIN (self or admin can set others in same company)
router.post("/set-pin", authMiddleware, async (req, res) => {
  const actor = req.user;
  const { EmployeeID, Pin } = req.body || {};

  if (!isValidPin(Pin)) {
    return res.status(400).json({ error: `PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits` });
  }

  const targetEmployeeId = Number(EmployeeID || actor.EmployeeID);
  if (!targetEmployeeId) {
    return res.status(400).json({ error: "EmployeeID is required" });
  }

  if (targetEmployeeId !== actor.EmployeeID && !canManageEmployees(actor)) {
    return res.status(403).json({ error: "Not authorized to set this PIN" });
  }

  try {
    const pinHash = await hashPin(Pin);
    const [result] = await pool.query(
      `UPDATE Employees SET PinHash = ? WHERE EmployeeID = ? AND CompanyID = ?`,
      [pinHash, targetEmployeeId, actor.CompanyID]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json({ message: "PIN updated" });
  } catch (err) {
    console.error("Set PIN error:", err);
    res.status(500).json({ error: "Failed to set PIN" });
  }
});

// POST /api/auth/verify-pin -> verify PIN for employee in same company
router.post("/verify-pin", authMiddleware, async (req, res) => {
  const actor = req.user;
  const { EmployeeID, Pin } = req.body || {};

  if (!isValidPin(Pin)) {
    return res.status(400).json({ error: `PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits` });
  }

  const targetEmployeeId = Number(EmployeeID);
  if (!targetEmployeeId) {
    return res.status(400).json({ error: "EmployeeID is required" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT EmployeeID, CompanyID, PinHash FROM Employees WHERE EmployeeID = ? AND CompanyID = ? LIMIT 1`,
      [targetEmployeeId, actor.CompanyID]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Employee not found" });
    }
    const emp = rows[0];
    if (!emp.PinHash) {
      return res.status(400).json({ error: "PIN not set for this employee" });
    }
    const ok = await bcrypt.compare(Pin, emp.PinHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid PIN" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Verify PIN error:", err);
    res.status(500).json({ error: "Failed to verify PIN" });
  }
});

// POST /api/auth/refresh -> issue a new access/refresh pair
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token required" });
  }
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const payload = {
      EmployeeID: decoded.EmployeeID,
      CompanyID: decoded.CompanyID,
      Email: decoded.Email,
      Role: decoded.Role,
    };
    const tokens = buildTokens(payload);
    res.json(tokens);
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// GET /api/auth/me  -> current logged-in user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const { EmployeeID } = req.user;

    const [rows] = await pool.query(
      `SELECT * FROM Employees WHERE EmployeeID = ?`,
      [EmployeeID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // we can hide password hash before returning
    const user = rows[0];
    delete user.PasswordHash;

    const perms = await computeUserPermissions(user.EmployeeID, user.CompanyID, user.Role);
    res.json({ ...user, Permissions: perms });
  } catch (err) {
    console.error("Error in /me:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

module.exports = router;
