import { useEffect, useState } from "react";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

export default function SuppliersPage() {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    SupplierName: "",
    ContactPerson: "",
    Email: "",
    PhoneNumber: "",
    TaxID: "",
    AddressLine1: "",
    City: "",
  });

  const load = async (term = "") => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/suppliers", {
        params: term ? { q: term } : {},
      });
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.SupplierName.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/api/suppliers", form);
      setForm({
        SupplierName: "",
        ContactPerson: "",
        Email: "",
        PhoneNumber: "",
        TaxID: "",
        AddressLine1: "",
        City: "",
      });
      await load(search);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        "Failed to save supplier.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="muted small">{t("nav.suppliers") || "Suppliers"}</p>
          <h2>{t("nav.suppliers") || "Suppliers"}</h2>
          <p className="muted small">
            Register vendors to use in purchase orders and invoices.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers"
          />
          <button className="btn ghost" onClick={() => load(search)} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {error && <p className="status error">{error}</p>}

      <div className="grid two">
        <div className="card">
          <div className="table">
            <div className="table-head" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr" }}>
              <span>Name</span>
              <span>Contact</span>
              <span>Tax ID</span>
              <span>Phone</span>
            </div>
            {(suppliers || []).map((s) => (
              <div
                key={s.SupplierID}
                className="table-row"
                style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr" }}
              >
                <div>
                  <strong>{s.SupplierName}</strong>
                  <div className="muted small">{s.Email || s.AddressLine1 || ""}</div>
                </div>
                <span className="muted small">{s.ContactPerson || "-"}</span>
                <span className="muted small">{s.TaxID || "-"}</span>
                <span className="muted small">{s.PhoneNumber || "-"}</span>
              </div>
            ))}
            {!loading && suppliers.length === 0 && (
              <div className="table-row muted">No suppliers yet.</div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Add supplier</h3>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Name*
              <input
                value={form.SupplierName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, SupplierName: e.target.value }))
                }
                required
              />
            </label>
            <label>
              Contact
              <input
                value={form.ContactPerson}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ContactPerson: e.target.value }))
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.Email}
                onChange={(e) => setForm((prev) => ({ ...prev, Email: e.target.value }))}
              />
            </label>
            <label>
              Phone
              <input
                value={form.PhoneNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, PhoneNumber: e.target.value }))
                }
              />
            </label>
            <label>
              Tax ID
              <input
                value={form.TaxID}
                onChange={(e) => setForm((prev) => ({ ...prev, TaxID: e.target.value }))}
              />
            </label>
            <label>
              Address
              <input
                value={form.AddressLine1}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, AddressLine1: e.target.value }))
                }
              />
            </label>
            <label>
              City
              <input
                value={form.City}
                onChange={(e) => setForm((prev) => ({ ...prev, City: e.target.value }))}
              />
            </label>
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save supplier"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
