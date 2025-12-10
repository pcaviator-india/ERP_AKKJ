import { useEffect, useState } from "react";
import api from "../api/http";

const appliesOptions = [
  { value: "all", label: "All items" },
  { value: "goods", label: "Goods" },
  { value: "services", label: "Services" },
];

export default function TaxRatesPage() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [form, setForm] = useState({ TaxRateID: null, Name: "", RatePercentage: 0, AppliesTo: "all", IsDefault: false, IsActive: true });
  const [saving, setSaving] = useState(false);

  const loadRates = async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const { data } = await api.get("/api/tax-rates");
      setRates(Array.isArray(data) ? data : []);
    } catch (err) {
      setStatus({ type: "error", message: "Failed to load tax rates" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const payload = {
        Name: form.Name,
        RatePercentage: Number(form.RatePercentage) || 0,
        AppliesTo: form.AppliesTo || "all",
        IsDefault: !!form.IsDefault,
        IsActive: form.IsActive ? 1 : 0,
      };
      if (form.TaxRateID) {
        await api.put(`/api/tax-rates/${form.TaxRateID}`, payload);
        setStatus({ type: "success", message: "Tax rate updated" });
      } else {
        await api.post("/api/tax-rates", payload);
        setStatus({ type: "success", message: "Tax rate added" });
      }
      setForm({ TaxRateID: null, Name: "", RatePercentage: 0, AppliesTo: "all", IsDefault: false, IsActive: true });
      await loadRates();
    } catch (err) {
      const message = err.response?.data?.error || "Failed to save tax rate";
      setStatus({ type: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id) => {
    try {
      await api.put(`/api/tax-rates/${id}/default`);
      setStatus({ type: "success", message: "Default tax rate updated" });
      loadRates();
    } catch (err) {
      const message = err.response?.data?.error || "Failed to set default";
      setStatus({ type: "error", message });
    }
  };

  return (
    <div className="page">
      <header className="list-header">
        <div>
          <h2>Tax Rates</h2>
          <p className="muted">Manage IVA rates for goods and services.</p>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card form" style={{ gap: "0.75rem" }}>
        <h3>{form.TaxRateID ? "Edit rate" : "Add rate"}</h3>
        <form className="grid two" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={form.Name} onChange={(e) => setForm((p) => ({ ...p, Name: e.target.value }))} required />
          </label>
          <label>
            Rate (%)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.RatePercentage}
              onChange={(e) => setForm((p) => ({ ...p, RatePercentage: e.target.value }))}
              required
            />
          </label>
          <label>
            Applies to
            <select value={form.AppliesTo} onChange={(e) => setForm((p) => ({ ...p, AppliesTo: e.target.value }))}>
              {appliesOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle inline-check">
            <span>Default</span>
            <input
              type="checkbox"
              checked={!!form.IsDefault}
              onChange={(e) => setForm((p) => ({ ...p, IsDefault: e.target.checked }))}
            />
          </label>
          <label className="toggle inline-check">
            <span>Active</span>
            <input
              type="checkbox"
              checked={!!form.IsActive}
              onChange={(e) => setForm((p) => ({ ...p, IsActive: e.target.checked }))}
            />
          </label>
          <div className="form-actions" style={{ justifyContent: "flex-end", gridColumn: "1 / -1" }}>
            <button type="button" className="btn ghost" onClick={() => setForm({ TaxRateID: null, Name: "", RatePercentage: 0, AppliesTo: "all", IsDefault: false, IsActive: true })}>
              Clear
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving..." : form.TaxRateID ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Rates</h3>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : rates.length === 0 ? (
          <p className="muted">No tax rates yet.</p>
        ) : (
          <div className="table">
            <div className="table-head" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr 1fr" }}>
              <span>Name</span>
              <span>Rate</span>
              <span>Applies</span>
              <span>Default</span>
              <span>Actions</span>
            </div>
            {rates.map((r) => (
              <div key={r.TaxRateID} className="table-row" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr 1fr" }}>
                <span>{r.Name}</span>
                <span>{Number(r.RatePercentage || 0).toFixed(2)}%</span>
                <span>{r.AppliesTo}</span>
                <span>{r.IsDefault ? "Yes" : "No"}</span>
                <div className="list-actions inline">
                  <button
                    className="btn ghost"
                    onClick={() =>
                      setForm({
                        TaxRateID: r.TaxRateID,
                        Name: r.Name || "",
                        RatePercentage: r.RatePercentage || 0,
                        AppliesTo: r.AppliesTo || "all",
                        IsDefault: !!r.IsDefault,
                        IsActive: r.IsActive !== 0,
                      })
                    }
                  >
                    Edit
                  </button>
                  {!r.IsDefault && (
                    <button className="btn ghost" onClick={() => setDefault(r.TaxRateID)}>
                      Set default
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
