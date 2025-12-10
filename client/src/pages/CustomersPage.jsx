import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/http";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [search, setSearch] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const { data } = await api.get("/api/customers");
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load customers", err);
      setStatus({ type: "error", message: "Failed to load customers" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter((c) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      (c.CustomerName || "").toLowerCase().includes(term) ||
      (c.TaxID || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="page wide">
      <header className="list-header">
        <div>
          <h2>Customers</h2>
          <p className="muted">Manage customers used in POS and invoicing.</p>
        </div>
        <div className="list-actions inline">
          <button className="btn primary" title="Add customer" onClick={() => navigate("/customers/new")}>
            ➕ Add
          </button>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <h3>Customer list</h3>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <input
            placeholder="Search by name or RUT"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="muted">No customers yet.</p>
        ) : (
          <div className="entity-list compact">
            {filteredCustomers.map((c) => (
              <div
                key={c.CustomerID}
                className="entity-row"
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/customers/${c.CustomerID}`)}
              >
                <div>
                  <strong>{c.CustomerName}</strong>
                  <div className="muted small">{c.TaxID || "No RUT"}</div>
                </div>
                <div className="list-actions inline">
                  <button
                    className="icon-btn"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/customers/${c.CustomerID}/edit`);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await api.delete(`/api/customers/${c.CustomerID}`);
                        setStatus({ type: "success", message: "Customer deleted" });
                        loadCustomers();
                      } catch (err) {
                        const message = err.response?.data?.error || "Failed to delete customer";
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
  );
}
