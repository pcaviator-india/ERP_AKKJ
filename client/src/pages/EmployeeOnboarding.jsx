import { useEffect, useState } from "react";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";

export default function EmployeeOnboarding() {
  const { company } = useAuth();
  const CORE_ROLES = ["SuperAdmin", "CompanyAdmin", "Admin", "Cashier", "Sales", "Warehouse", "Finance"];
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "Sales",
    password: "",
    phoneNumber: "",
    jobTitle: "",
    departmentId: "",
    reportsToEmployeeId: "",
    isActive: true,
    employeeId: null,
  });
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [pinModal, setPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinTarget, setPinTarget] = useState(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinStatus, setPinStatus] = useState({ type: "", message: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    loadEmployees();
    loadRoles();
  }, []);

  const loadEmployees = async () => {
    try {
      const { data } = await api.get("/api/employees");
      setEmployees(data);
    } catch (error) {
      console.warn("Unable to load employees", error);
    }
  };

  const loadRoles = async () => {
    try {
      const { data } = await api.get("/api/roles");
      const custom = Array.isArray(data) ? data.map((r) => r.RoleName) : [];
      const merged = Array.from(new Set([...CORE_ROLES, ...custom]));
      setRoles(merged);
    } catch (error) {
      console.warn("Unable to load roles", error);
      setRoles(CORE_ROLES);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.password && !form.employeeId) {
      setStatus({ type: "error", message: "Password is required for new employees." });
      return;
    }
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const payload = {
        CompanyID: company?.CompanyID,
        FirstName: form.firstName,
        LastName: form.lastName,
        Email: form.email,
        Password: form.password || undefined,
        Role: form.role,
        PhoneNumber: form.phoneNumber || null,
        JobTitle: form.jobTitle || null,
        DepartmentID: form.departmentId || null,
        ReportsToEmployeeID: form.reportsToEmployeeId || null,
        IsActive: form.isActive ? 1 : 0,
      };
      if (form.employeeId) {
        await api.put(`/api/employees/${form.employeeId}`, payload);
        setStatus({ type: "success", message: "Employee updated." });
      } else {
        await api.post("/api/auth/register", payload);
        setStatus({ type: "success", message: "Employee added." });
      }
      await loadEmployees();
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        role: "Sales",
        password: "",
        phoneNumber: "",
        jobTitle: "",
        departmentId: "",
        reportsToEmployeeId: "",
        isActive: true,
        employeeId: null,
      });
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Failed to save employee";
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page wide">
      <h2>Invite your team</h2>
      <p className="muted">
        Each entry mirrors a POST to <code>/api/auth/register</code> with the company context. Assign roles according to
        your authorization model.
      </p>

      <div className="grid">
        <form className="card form two-col" onSubmit={handleSubmit}>
          <div className="form-row">
            <label style={{ flex: 1 }}>
              First name
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
              />
            </label>
            <label style={{ flex: 1 }}>
              Last name
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label style={{ flex: 1 }}>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>
            <label style={{ flex: 1 }}>
              Phone
              <input
                type="tel"
                name="phoneNumber"
                value={form.phoneNumber}
                onChange={handleChange}
              />
            </label>
          </div>
          <div className="form-row">
            <label style={{ flex: 1 }}>
              Password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Temporary password"
                required
              />
            </label>
            <label style={{ flex: 1 }}>
              Role
              <select name="role" value={form.role} onChange={handleChange}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label style={{ flex: 1 }}>
              Job title
              <input
                type="text"
                name="jobTitle"
                value={form.jobTitle}
                onChange={handleChange}
              />
            </label>
            <label style={{ flex: 1 }}>
              Department
              <input
                type="text"
                name="departmentId"
                value={form.departmentId}
                onChange={handleChange}
              />
            </label>
          </div>
          <div className="form-row">
            <label style={{ flex: 1 }}>
              Reports to
              <select
                name="reportsToEmployeeId"
                value={form.reportsToEmployeeId}
                onChange={handleChange}
              >
                <option value="">None</option>
                {employees.map((e) => (
                  <option key={e.EmployeeID} value={e.EmployeeID}>
                    {e.FirstName} {e.LastName}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <span>Active</span>
            </label>
          </div>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <button className="btn primary" type="submit" disabled={loading}>
                {loading ? "Saving..." : form.employeeId ? "Update Employee" : "Add Employee"}
              </button>
              {form.employeeId && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    setForm({
                      firstName: "",
                      lastName: "",
                      email: "",
                      role: "Sales",
                      password: "",
                      phoneNumber: "",
                      jobTitle: "",
                      departmentId: "",
                      reportsToEmployeeId: "",
                      isActive: true,
                      employeeId: null,
                    })
                  }
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          {status.message && (
            <p className={`status ${status.type}`}>{status.message}</p>
          )}
        </form>

        <section className="card">
          <h3>Team</h3>
          {employees.length === 0 ? (
            <p className="muted">No employees added yet.</p>
          ) : (
            <ul className="list">
              {employees.map((emp) => {
                const firstName = emp.FirstName || emp.firstName || "";
                const lastName = emp.LastName || emp.lastName || "";
                const email = emp.Email || emp.email || "";
                const role = emp.Role || emp.role || "Employee";
                const phone = emp.PhoneNumber || emp.phoneNumber || "";
                const jobTitle = emp.JobTitle || emp.jobTitle || "";
                const key = emp.EmployeeID || emp.id || email;
                return (
                  <li key={key}>
                    <strong>
                      {firstName} {lastName}
                    </strong>
                    <div className="muted small">
                      {[email, phone].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className="pill">{role}</span>
                      {jobTitle && <span className="pill ghost">{jobTitle}</span>}
                      {emp.IsActive === 0 && <span className="pill danger">Inactive</span>}
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: "0.3rem 0.75rem" }}
                        onClick={() => {
                          setPinTarget({ id: key, name: `${firstName} ${lastName}`.trim() || email });
                          setPinValue("");
                          setPinConfirm("");
                          setPinStatus({ type: "", message: "" });
                          setPinModal(true);
                        }}
                      >
                        Set PIN
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: "0.3rem 0.75rem" }}
                        onClick={() =>
                          setForm({
                            firstName,
                            lastName,
                            email,
                            role,
                            password: "",
                            phoneNumber: phone || "",
                            jobTitle: jobTitle || "",
                            departmentId: emp.DepartmentID || "",
                            reportsToEmployeeId: emp.ReportsToEmployeeID || "",
                            isActive: emp.IsActive !== 0,
                            employeeId: emp.EmployeeID,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: "0.3rem 0.75rem" }}
                        onClick={async () => {
                          try {
                            await api.delete(`/api/employees/${emp.EmployeeID}`);
                            await loadEmployees();
                            setStatus({ type: "success", message: "Employee deleted (inactivated)." });
                          } catch (err) {
                            const message = err.response?.data?.error || "Failed to delete employee";
                            setStatus({ type: "error", message });
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {pinModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Set PIN</h3>
            <p className="muted small">
              4-6 digits, numbers only. Applies to {pinTarget?.name || "employee"}.
            </p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter PIN"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D+/g, ""))}
              autoFocus
            />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Confirm PIN"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D+/g, ""))}
              style={{ marginTop: "0.5rem" }}
            />
            {pinStatus.message && <p className={`status ${pinStatus.type}`}>{pinStatus.message}</p>}
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setPinModal(false);
                  setPinStatus({ type: "", message: "" });
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={
                  pinSaving ||
                  !pinValue ||
                  !pinConfirm ||
                  pinValue !== pinConfirm ||
                  pinValue.length < 4
                }
                onClick={async () => {
                  if (!pinTarget?.id) return;
                  if (pinValue !== pinConfirm) {
                    setPinStatus({ type: "error", message: "PINs must match" });
                    return;
                  }
                  setPinSaving(true);
                  setPinStatus({ type: "", message: "" });
                  try {
                    await api.post("/api/auth/set-pin", { EmployeeID: pinTarget.id, Pin: pinValue });
                    setPinStatus({ type: "success", message: "PIN updated" });
                    setPinModal(false);
                  } catch (err) {
                    const message = err.response?.data?.error || "Failed to update PIN";
                    setPinStatus({ type: "error", message });
                  } finally {
                    setPinSaving(false);
                    setPinValue("");
                    setPinConfirm("");
                  }
                }}
              >
                {pinSaving ? "Saving..." : "Save PIN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
