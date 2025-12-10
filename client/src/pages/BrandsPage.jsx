import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/http";

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      const res = await api.get("/api/products/brands");
      setBrands(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to load brands" });
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
      if (editingId) {
        await api.put(`/api/products/brands/${editingId}`, { BrandName: name.trim() });
        setStatus({ type: "success", message: "Brand updated" });
      } else {
        await api.post("/api/products/brands", { BrandName: name.trim() });
        setStatus({ type: "success", message: "Brand added" });
      }
      setName("");
      setEditingId(null);
      await load();
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to save brand" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (brand) => {
    setEditingId(brand.ProductBrandID || brand.BrandID);
    setName(brand.BrandName);
    setStatus({ type: "", message: "" });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/products/brands/${id}`);
      await load();
    } catch (err) {
      setStatus({ type: "error", message: "Failed to delete brand" });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setStatus({ type: "", message: "" });
  };

  return (
    <div className="page">
      <header className="list-header">
        <div>
          <h2>Brands</h2>
          <p className="muted">View and manage brands.</p>
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
            Brand name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" />
          </label>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update brand" : "Add brand"}
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
        {brands.length === 0 ? (
          <p className="muted">No brands.</p>
        ) : (
          <div className="entity-list">
            {brands.map((b) => {
              const id = b.ProductBrandID || b.BrandID;
              return (
                <div key={id || b.BrandName} className="entity-row">
                  <span className="entity-name">{b.BrandName}</span>
                  <div className="list-actions inline">
                    <button className="icon-btn" title="Edit" onClick={() => startEdit(b)}>
                      Edit
                    </button>
                    <button className="icon-btn" title="Delete" onClick={() => handleDelete(id)}>
                      Del
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
