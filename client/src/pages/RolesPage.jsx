import { useEffect, useState } from "react";
import api from "../api/http";

const CORE_ROLES = ["SuperAdmin", "CompanyAdmin", "Admin", "Cashier", "Sales", "Warehouse", "Finance"];
const CORE_ROLE_PERMS = {
  SuperAdmin: [
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
  ],
  CompanyAdmin: [
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
  ],
  Admin: [
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
  ],
  Cashier: ["pos.use", "sales.create", "sales.view", "customers.manage"],
  Sales: ["pos.use", "sales.create", "sales.view", "customers.manage"],
  Warehouse: ["inventory.view", "inventory.adjust", "warehouses.manage", "products.manage"],
  Finance: ["payments.manage", "suppliers.manage", "purchaseOrders.manage", "reports.view"],
};
const PERMISSION_OPTIONS = [
  { key: "roles.manage", label: "Manage roles" },
  { key: "employees.manage", label: "Manage employees" },
  { key: "customers.manage", label: "Manage customers" },
  { key: "products.manage", label: "Manage products" },
  { key: "inventory.view", label: "View inventory" },
  { key: "inventory.adjust", label: "Adjust inventory" },
  { key: "warehouses.manage", label: "Manage warehouses" },
  { key: "priceLists.manage", label: "Manage price lists" },
  { key: "sales.create", label: "Create sales/documents" },
  { key: "sales.view", label: "View sales/documents" },
  { key: "pos.use", label: "Use POS" },
  { key: "suppliers.manage", label: "Manage suppliers" },
  { key: "purchaseOrders.manage", label: "Manage purchase orders" },
  { key: "payments.manage", label: "Manage payments" },
  { key: "config.manage", label: "Manage configuration" },
  { key: "reports.view", label: "View reports" },
];

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [form, setForm] = useState({ RoleID: null, RoleName: "", Description: "" });
  const [rolePerms, setRolePerms] = useState(new Set());
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsSaving, setPermsSaving] = useState(false);

  const loadRoles = async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const { data } = await api.get("/api/roles");
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setStatus({ type: "error", message: "Failed to load roles" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    if (form.RoleID && !isCore(form.RoleName)) {
      loadPermissions(form.RoleID);
    } else if (isCore(form.RoleName)) {
      setRolePerms(new Set(CORE_ROLE_PERMS[form.RoleName] || []));
    } else {
      setRolePerms(new Set());
    }
  }, [form.RoleID, form.RoleName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.RoleName.trim()) {
      setStatus({ type: "error", message: "Role name is required" });
      return;
    }
    setStatus({ type: "", message: "" });
    try {
      if (form.RoleID) {
        await api.put(`/api/roles/${form.RoleID}`, {
          RoleName: form.RoleName.trim(),
          Description: form.Description.trim() || null,
        });
        setStatus({ type: "success", message: "Role updated" });
      } else {
        await api.post("/api/roles", {
          RoleName: form.RoleName.trim(),
          Description: form.Description.trim() || null,
        });
        setStatus({ type: "success", message: "Role added" });
      }
      setForm({ RoleID: null, RoleName: "", Description: "" });
      setRolePerms(new Set());
      loadRoles();
    } catch (err) {
      const message = err.response?.data?.error || "Failed to save role";
      setStatus({ type: "error", message });
    }
  };

  const loadPermissions = async (roleId) => {
    setPermsLoading(true);
    try {
      const { data } = await api.get(`/api/roles/${roleId}/permissions`);
      const set = new Set();
      (data || []).forEach((p) => {
        if (p.PermissionName) set.add(p.PermissionName);
      });
      setRolePerms(set);
    } catch (err) {
      setStatus({ type: "error", message: "Failed to load permissions" });
      setRolePerms(new Set());
    } finally {
      setPermsLoading(false);
    }
  };

  const savePermissions = async () => {
    if (!form.RoleID || isCore(form.RoleName)) return;
    setPermsSaving(true);
    setStatus({ type: "", message: "" });
    try {
      await api.put(`/api/roles/${form.RoleID}/permissions`, {
        permissions: Array.from(rolePerms),
      });
      setStatus({ type: "success", message: "Permissions updated" });
      await loadPermissions(form.RoleID);
    } catch (err) {
      const message = err.response?.data?.error || "Failed to save permissions";
      setStatus({ type: "error", message });
    } finally {
      setPermsSaving(false);
    }
  };

  const isCore = (name) => CORE_ROLES.includes(name);

  const mergedRoles = [
    ...CORE_ROLES.map((name) => ({
      RoleID: `core-${name}`,
      RoleName: name,
      Description: "",
      _core: true,
    })),
    ...roles.filter((r) => !CORE_ROLES.includes(r.RoleName)),
  ];

  return (
    <div className="page wide">
      <header className="list-header">
        <div>
          <h2>Roles</h2>
          <p className="muted">Manage custom roles. Core roles are locked.</p>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="roles-layout">
        <div className="card roles-left">
          <form className="form two-col" onSubmit={handleSubmit}>
            <div className="form-row">
              <label style={{ flex: 1 }}>
                Role name
                <input
                  value={form.RoleName}
                  onChange={(e) => setForm((prev) => ({ ...prev, RoleName: e.target.value }))}
                  required
                  disabled={isCore(form.RoleName)}
                />
              </label>
              <label style={{ flex: 1 }}>
                Description
                <input
                  value={form.Description}
                  onChange={(e) => setForm((prev) => ({ ...prev, Description: e.target.value }))}
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <button className="btn primary" type="submit" disabled={loading || isCore(form.RoleName)}>
                {form.RoleID ? "Update Role" : "Add Role"}
              </button>
              {form.RoleID && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setForm({ RoleID: null, RoleName: "", Description: "" });
                    setRolePerms(new Set());
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="card">
            <h3>Role list</h3>
            {loading ? (
              <p className="muted">Loading...</p>
            ) : mergedRoles.length === 0 ? (
              <p className="muted">No roles yet.</p>
            ) : (
              <div className="entity-list" style={{ maxHeight: "50vh", overflowY: "auto" }}>
                {mergedRoles.map((r) => (
                  <div
                    key={r.RoleID}
                    className={`entity-row ${form.RoleID === r.RoleID ? "active" : ""}`}
                    onClick={() => {
                      if (isCore(r.RoleName) || r._core) {
                        setForm({ RoleID: null, RoleName: r.RoleName, Description: r.Description || "" });
                        setRolePerms(new Set());
                        return;
                      }
                      setForm({ RoleID: r.RoleID, RoleName: r.RoleName, Description: r.Description || "" });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="role-info">
                      <div className="role-title">
                        <strong>{r.RoleName}</strong>
                        {(isCore(r.RoleName) || r._core) && <span className="pill ghost">🔒</span>}
                      </div>
                      {r.Description && <div className="muted small">{r.Description}</div>}
                    </div>
                    <div className="list-actions inline">
                      <button
                        className="icon-btn"
                        title="Edit"
                        disabled={isCore(r.RoleName) || r._core}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCore(r.RoleName) || r._core) return;
                          setForm({ RoleID: r.RoleID, RoleName: r.RoleName, Description: r.Description || "" });
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="icon-btn"
                        title="Delete"
                        disabled={isCore(r.RoleName) || r._core}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (isCore(r.RoleName) || r._core) return;
                          try {
                            await api.delete(`/api/roles/${r.RoleID}`);
                            loadRoles();
                            setStatus({ type: "success", message: "Role deleted" });
                            setForm({ RoleID: null, RoleName: "", Description: "" });
                            setRolePerms(new Set());
                          } catch (err) {
                            const message = err.response?.data?.error || "Failed to delete role";
                            setStatus({ type: "error", message });
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card roles-right">
          <h3>Permissions</h3>
          {isCore(form.RoleName) ? (
            <>
              <p className="muted">Core roles have fixed permissions.</p>
              <div className="permissions-list">
                {PERMISSION_OPTIONS.map((p) => (
                  <label key={p.key} className="checkbox perm-check">
                    <input type="checkbox" checked={rolePerms.has(p.key)} disabled />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </>
          ) : form.RoleID ? (
            <>
              {permsLoading ? (
                <p className="muted">Loading permissions...</p>
              ) : (
                <div className="permissions-list">
                  {PERMISSION_OPTIONS.map((p) => (
                    <label key={p.key} className="checkbox perm-check">
                      <input
                        type="checkbox"
                        checked={rolePerms.has(p.key)}
                        onChange={(e) => {
                          const next = new Set(rolePerms);
                          if (e.target.checked) next.add(p.key);
                          else next.delete(p.key);
                          setRolePerms(next);
                        }}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="form-actions" style={{ justifyContent: "flex-end" }}>
                <button className="btn primary" onClick={savePermissions} disabled={permsSaving || permsLoading}>
                  {permsSaving ? "Saving..." : "Save Permissions"}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Select a role to view or manage permissions.</p>
          )}
        </div>
      </div>
    </div>
  );
}
