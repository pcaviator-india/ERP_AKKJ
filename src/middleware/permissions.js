const { pool } = require("../db");

const CORE_ROLE_PERMS = {
  SuperAdmin: new Set([
    "roles.manage",
    "employees.manage",
    "customers.manage",
    "products.manage",
    "inventory.view",
    "inventory.adjust",
    "warehouses.manage",
    "priceLists.manage",
    "sales.create",
    "sales.view",
    "pos.use",
    "suppliers.manage",
    "purchaseOrders.manage",
    "payments.manage",
    "config.manage",
    "reports.view",
  ]),
  CompanyAdmin: new Set([
    "roles.manage",
    "employees.manage",
    "customers.manage",
    "products.manage",
    "inventory.view",
    "inventory.adjust",
    "warehouses.manage",
    "priceLists.manage",
    "sales.create",
    "sales.view",
    "pos.use",
    "suppliers.manage",
    "purchaseOrders.manage",
    "payments.manage",
    "config.manage",
    "reports.view",
  ]),
  Admin: new Set([
    "employees.manage",
    "customers.manage",
    "products.manage",
    "inventory.view",
    "inventory.adjust",
    "warehouses.manage",
    "priceLists.manage",
    "sales.create",
    "sales.view",
    "pos.use",
    "suppliers.manage",
    "purchaseOrders.manage",
    "reports.view",
  ]),
  Cashier: new Set(["pos.use", "sales.create", "sales.view", "customers.manage"]),
  Sales: new Set(["pos.use", "sales.create", "sales.view"]),
  Warehouse: new Set(["inventory.view", "inventory.adjust", "warehouses.manage", "products.manage"]),
  Finance: new Set(["payments.manage", "suppliers.manage", "purchaseOrders.manage", "reports.view"]),
};

async function computeUserPermissions(employeeId, companyId, roleName) {
  const perms = new Set();
  if (CORE_ROLE_PERMS[roleName]) {
    CORE_ROLE_PERMS[roleName].forEach((p) => perms.add(p));
  }
  // Custom roles via EmployeeRoles / RolePermissions
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT rp.PermissionName
       FROM EmployeeRoles er
       INNER JOIN Roles r ON er.RoleID = r.RoleID
       INNER JOIN RolePermissions rp ON rp.RoleID = r.RoleID
       WHERE er.EmployeeID = ? AND r.CompanyID = ?`,
      [employeeId, companyId]
    );
    rows.forEach((row) => {
      if (row.PermissionName) perms.add(row.PermissionName);
    });
  } catch (err) {
    console.warn("computeUserPermissions failed", err);
  }
  return Array.from(perms);
}

function requirePermission(permission) {
  return async function (req, res, next) {
    try {
      const { EmployeeID, CompanyID, Role } = req.user || {};
      if (!EmployeeID || !CompanyID) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userPerms = await computeUserPermissions(EmployeeID, CompanyID, Role);
      if (userPerms.includes(permission)) return next();
      return res.status(403).json({ error: "Forbidden" });
    } catch (err) {
      console.error("Permission check failed:", err);
      return res.status(500).json({ error: "Permission check failed" });
    }
  };
}

function requireWritePermission(permission) {
  const guard = requirePermission(permission);
  return function (req, res, next) {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return guard(req, res, next);
    }
    return next();
  };
}

function requireMethodPermission(map) {
  const guards = {};
  Object.entries(map).forEach(([method, perm]) => {
    guards[method] = perm ? requirePermission(perm) : null;
  });
  return function (req, res, next) {
    const perm = guards[req.method] || guards["*"];
    if (!perm) return next();
    return perm(req, res, next);
  };
}

module.exports = { computeUserPermissions, requirePermission, requireWritePermission, requireMethodPermission };
