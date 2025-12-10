import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/http";

export default function UnitsPage() {
  const [units, setUnits] = useState([]);
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      const res = await api.get("/api/products/units");
      setUnits(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to load units" });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const payload = { UnitName: name.trim(), Abbreviation: abbr.trim() };
      if (editingId) {
        await api.put(`/api/products/units/${editingId}`, payload);
        setStatus({ type: "success", message: "Unit updated" });
      } else {
        await api.post("/api/products/units", payload);
        setStatus({ type: "success", message: "Unit added" });
      }
      setName("");
      setAbbr("");
      setEditingId(null);
      await load();
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to save unit" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (unit) => {
    setEditingId(unit.UnitID);
    setName(unit.UnitName);
    setAbbr(unit.Abbreviation || "");
    setStatus({ type: "", message: "" });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/products/units/${id}`);
      await load();
    } catch (err) {
      setStatus({ type: "error", message: "Failed to delete unit" });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setAbbr("");
    setStatus({ type: "", message: "" });
  };

  return (
    <div className="page">
      <header className="list-header">
        <div>
          <h2>Units</h2>
          <p className="muted">View and manage units of measure.</p>
        </div>
        <div className="list-actions">
          <Link className="btn ghost" to="/products">
            Products
          </Link>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <form onSubmit={handleSave} className="form">
          <label>
            Unit name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Unit name" />
          </label>
          <label>
            Abbreviation
            <input value={abbr} onChange={(e) => setAbbr(e.target.value)} placeholder="e.g. KG" />
          </label>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update unit" : "Add unit"}
            </button>
            {editingId && (
              <button type="button" className="btn ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        {units.length === 0 ? (
          <p className="muted">No units.</p>
        ) : (
          <div className="entity-list">
            {units.map((u) => (
              <div key={u.UnitID || u.UnitName} className="entity-row">
                <span className="entity-name">
                  {u.UnitName}
                  {u.Abbreviation ? ` (${u.Abbreviation})` : ""}
                </span>
                <div className="list-actions inline">
                  <button className="icon-btn" title="Edit" onClick={() => startEdit(u)}>
                    Edit
                  </button>
                  <button className="icon-btn" title="Delete" onClick={() => handleDelete(u.UnitID)}>
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
