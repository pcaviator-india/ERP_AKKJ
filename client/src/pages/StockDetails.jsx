import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
};

export default function StockDetails() {
  const { productId, warehouseId } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lots, setLots] = useState([]);
  const [serials, setSerials] = useState([]);
  const [serialStatus, setSerialStatus] = useState("");
  const [lotForm, setLotForm] = useState({ lotNumber: "", expiration: "", quantity: "" });
  const [serialInput, setSerialInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setStatus({ type: "", message: "" });
      try {
        const [prodRes, invRes] = await Promise.all([
          api.get(`/api/products/${productId}`),
          api.get("/api/inventory/levels", {
            params: { productId, warehouseId, includeZero: 1 },
          }),
        ]);
        setProduct(prodRes.data);
        setSummary(invRes.data?.[0] || null);
        if (Number(prodRes.data?.UsesLots || 0) === 1) {
          const { data } = await api.get("/api/product-lots", {
            params: { productId, warehouseId, includeZero: 1 },
          });
          setLots(Array.isArray(data) ? data : []);
        } else if (Number(prodRes.data?.UsesSerials || 0) === 1) {
          const { data } = await api.get("/api/product-serials", {
            params: { productId, status: serialStatus || undefined },
          });
          setSerials(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load stock details", err);
        setStatus({ type: "error", message: "Failed to load stock details." });
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [productId, warehouseId, serialStatus]);

  const handleAddLot = async () => {
    if (!lotForm.lotNumber.trim()) {
      setStatus({ type: "error", message: "Lot number required." });
      return;
    }
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      await api.post("/api/product-lots", {
        ProductID: Number(productId),
        WarehouseID: Number(warehouseId),
        LotNumber: lotForm.lotNumber.trim(),
        ExpirationDate: lotForm.expiration || null,
        Quantity: lotForm.quantity === "" ? 0 : Number(lotForm.quantity),
      });
      const { data } = await api.get("/api/product-lots", {
        params: { productId, warehouseId, includeZero: 1 },
      });
      setLots(Array.isArray(data) ? data : []);
      setLotForm({ lotNumber: "", expiration: "", quantity: "" });
      const inv = await api.get("/api/inventory/levels", {
        params: { productId, warehouseId, includeZero: 1 },
      });
      setSummary(inv.data?.[0] || null);
      setStatus({ type: "success", message: "Lot saved." });
    } catch (err) {
      console.error("Failed to add lot", err);
      setStatus({ type: "error", message: "Failed to save lot." });
    } finally {
      setSaving(false);
    }
  };

  const handleSerialIntake = async () => {
    const lines = serialInput
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(lines));
    if (!unique.length) {
      setStatus({ type: "error", message: "Enter serial numbers." });
      return;
    }
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      await api.post("/api/product-serials/intake", {
        ProductID: Number(productId),
        WarehouseID: Number(warehouseId),
        serials: unique,
      });
      const { data } = await api.get("/api/product-serials", {
        params: { productId, status: serialStatus || undefined },
      });
      setSerials(Array.isArray(data) ? data : []);
      const inv = await api.get("/api/inventory/levels", {
        params: { productId, warehouseId, includeZero: 1 },
      });
      setSummary(inv.data?.[0] || null);
      setSerialInput("");
      setStatus({ type: "success", message: "Serials added." });
    } catch (err) {
      console.error("Failed to intake serials", err);
      setStatus({ type: "error", message: "Failed to intake serials." });
    } finally {
      setSaving(false);
    }
  };

  const trackingLabel =
    Number(product?.UsesLots || 0) === 1
      ? "Lot-tracked"
      : Number(product?.UsesSerials || 0) === 1
        ? "Serial-tracked"
        : "Not tracked";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="muted small">
            <Link to="/inventory">← Back to inventory</Link>
          </p>
          <h2>Stock details</h2>
          <p className="muted">
            {product ? `${product.ProductName} (${product.SKU || ""})` : ""} ·{" "}
            {trackingLabel}
          </p>
          <p className="muted small">Warehouse: {summary?.WarehouseName || warehouseId}</p>
        </div>
        <div>
          <button className="btn ghost" onClick={() => navigate("/inventory")}>
            Close
          </button>
        </div>
      </div>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}
      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <>
          <div className="card">
            <h4>Summary</h4>
            <p className="muted">
              On hand: {summary?.StockQuantity ?? 0} · Reserved: {summary?.ReservedQuantity ?? 0} ·
              Available: {summary?.AvailableQuantity ?? 0}
            </p>
          </div>

          {Number(product?.UsesLots || 0) === 1 && (
            <>
              <div className="card">
                <h4>Add / update lot</h4>
                <div className="grid three">
                  <label>
                    Lot number
                    <input
                      value={lotForm.lotNumber}
                      onChange={(e) => setLotForm((prev) => ({ ...prev, lotNumber: e.target.value }))}
                    />
                  </label>
                  <label>
                    Expiration
                    <input
                      type="date"
                      value={lotForm.expiration}
                      onChange={(e) => setLotForm((prev) => ({ ...prev, expiration: e.target.value }))}
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="0"
                      value={lotForm.quantity}
                      onChange={(e) => setLotForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="actions">
                  <button className="btn primary" onClick={handleAddLot} disabled={saving}>
                    {saving ? "Saving..." : "Save lot"}
                  </button>
                </div>
              </div>
              <div className="card">
                <h4>Lots</h4>
                {lots.length === 0 ? (
                  <p className="muted">No lots.</p>
                ) : (
                  <div className="table">
                    <div className="table-head grid four">
                      <span>Lot</span>
                      <span>Expiration</span>
                      <span>Quantity</span>
                      <span>Warehouse</span>
                    </div>
                    {lots.map((lot) => (
                      <div key={lot.ProductLotID} className="table-row grid four">
                        <span>{lot.LotNumber}</span>
                        <span>{formatDate(lot.ExpirationDate) || "No date"}</span>
                        <span>{lot.Quantity ?? 0}</span>
                        <span>{lot.WarehouseName || "All"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {Number(product?.UsesSerials || 0) === 1 && (
            <>
              <div className="card">
                <h4>Intake serials</h4>
                <label>
                  Serial numbers (one per line)
                  <textarea
                    rows={5}
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                    placeholder="Enter or paste serials"
                  />
                </label>
                <div className="actions">
                  <button className="btn primary" onClick={handleSerialIntake} disabled={saving}>
                    {saving ? "Saving..." : "Add serials"}
                  </button>
                </div>
              </div>
              <div className="card">
                <div className="list-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0 }}>Serials</h4>
                  <select value={serialStatus} onChange={(e) => setSerialStatus(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="InStock">InStock</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Sold">Sold</option>
                    <option value="Returned">Returned</option>
                    <option value="Scrapped">Scrapped</option>
                  </select>
                </div>
                {serials.length === 0 ? (
                  <p className="muted">No serials.</p>
                ) : (
                  <div className="table">
                    <div className="table-head grid four">
                      <span>Serial</span>
                      <span>Status</span>
                      <span>Created</span>
                      <span>Warehouse</span>
                    </div>
                    {serials.map((s) => (
                      <div key={s.ProductSerialID} className="table-row grid four">
                        <span>{s.SerialNumber}</span>
                        <span>{s.Status}</span>
                        <span>{formatDate(s.CreatedAt)}</span>
                        <span>{summary?.WarehouseName || "-"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
