import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

export default function WarehouseAddStock() {
  const { t } = useLanguage();
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [highlighted, setHighlighted] = useState(-1);
  const [stock, setStock] = useState("");
  const [lowStock, setLowStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    document.title = t("warehouseAdd.title");
  }, [t]);

  useEffect(() => {
    const loadWarehouses = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/warehouses");
        const list = Array.isArray(res.data) ? res.data : [];
        setWarehouses(list);
        const def = list.find((w) => w.IsDefault) || list[0];
        if (def) setSelectedWarehouse(String(def.WarehouseID));
      } catch (err) {
        console.error("Failed to load warehouses", err);
        setStatus({ type: "error", message: t("warehouseAdd.loadError") });
      } finally {
        setLoading(false);
      }
    };
    loadWarehouses();
  }, [t]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (productQuery.trim().length < 2) {
        setProductResults([]);
        setHighlighted(-1);
        return;
      }
      try {
        const res = await api.get("/api/products", { params: { q: productQuery.trim(), type: "active" } });
        setProductResults(Array.isArray(res.data) ? res.data.slice(0, 20) : []);
        setHighlighted(-1);
      } catch (err) {
        console.error("Failed to search products", err);
      }
    };
    const timer = setTimeout(fetchProducts, 250);
    return () => clearTimeout(timer);
  }, [productQuery]);

  const itemRefs = useRef([]);
  useEffect(() => {
    itemRefs.current = [];
  }, [productResults]);

  useEffect(() => {
    if (highlighted >= 0 && itemRefs.current[highlighted]) {
      itemRefs.current[highlighted].scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  const selectedProduct = useMemo(
    () => productResults.find((p) => String(p.ProductID) === String(selectedProductId)),
    [productResults, selectedProductId]
  );

  const resetForm = () => {
    setProductQuery("");
    setProductResults([]);
    setSelectedProductId("");
    setStock("");
    setLowStock("");
    setMaxStock("");
  };

  const handleAdd = async () => {
    setStatus({ type: "", message: "" });
    if (!selectedWarehouse) {
      setStatus({ type: "error", message: t("warehouseAdd.warehouseRequired") });
      return;
    }
    if (!selectedProductId) {
      setStatus({ type: "error", message: t("warehouseAdd.productRequired") });
      return;
    }
    const entry = {
      ProductID: Number(selectedProductId),
      WarehouseID: Number(selectedWarehouse),
      StockQuantity: stock === "" ? 0 : Number(stock),
      MinStockLevel: lowStock === "" ? null : Number(lowStock),
      MaxStockLevel: maxStock === "" ? null : Number(maxStock),
      ProductLotID: null,
    };

    setSaving(true);
    try {
      await api.post("/api/inventory/levels/bulk-save", { entries: [entry] });
      setStatus({ type: "success", message: t("warehouseAdd.saveSuccess") });
      resetForm();
    } catch (err) {
      console.error("Failed to save inventory level", err);
      setStatus({ type: "error", message: t("warehouseAdd.saveError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="list-header">
        <div>
          <h2>{t("warehouseAdd.title")}</h2>
          <p className="muted">{t("warehouseAdd.description")}</p>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <div className="form-grid two-col gap">
          <label>
            {t("warehouseAdd.warehouse")}
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              disabled={loading}
            >
              {warehouses.map((w) => (
                <option key={w.WarehouseID} value={w.WarehouseID}>
                  {w.WarehouseName}
                </option>
              ))}
            </select>
          </label>
          <label style={{ position: "relative" }}>
            {t("warehouseAdd.productSearch")}
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={t("warehouseAdd.productPlaceholder")}
              autoComplete="off"
              onKeyDown={(e) => {
                if (productResults.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlighted((prev) => Math.min(productResults.length - 1, prev + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlighted((prev) => Math.max(0, prev - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const pick =
                    productResults[
                      highlighted >= 0 ? highlighted : productResults.length === 1 ? 0 : 0
                    ];
                  if (pick) {
                    setSelectedProductId(String(pick.ProductID));
                    setProductQuery(`${pick.ProductName} (${pick.SKU || ""})`);
                    setProductResults([]);
                    setHighlighted(-1);
                  }
                } else if (e.key === "Escape") {
                  setProductResults([]);
                  setHighlighted(-1);
                }
              }}
            />
            {productQuery.trim().length >= 2 && productResults.length > 0 && (
              <ul
                className="dropdown-list"
                style={{
                  position: "absolute",
                  zIndex: 5,
                  width: "100%",
                  background: "#fff",
                  border: "1px solid #d8deff",
                  borderRadius: "10px",
                  top: "calc(100% + 4px)",
                  maxHeight: "240px",
                  overflowY: "auto",
                  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)",
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {productResults.map((p, idx) => (
                  <li
                    key={p.ProductID}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eef1ff",
                      background: highlighted === idx ? "#eef2ff" : "transparent",
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedProductId(String(p.ProductID));
                      setProductQuery(`${p.ProductName} (${p.SKU || ""})`);
                      setProductResults([]);
                      setHighlighted(-1);
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{p.ProductName}</div>
                    <div className="muted small">{p.SKU}</div>
                  </li>
                ))}
              </ul>
            )}
          </label>
          <label>
            {t("warehouseAdd.stock")}
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            {t("warehouseAdd.lowStock")}
            <input
              type="number"
              min="0"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
              placeholder={t("inventory.noThreshold")}
            />
          </label>
          <label>
            {t("warehouseAdd.maxStock")}
            <input
              type="number"
              min="0"
              value={maxStock}
              onChange={(e) => setMaxStock(e.target.value)}
              placeholder={t("inventory.noMax")}
            />
          </label>
        </div>
        <div className="actions mt-16">
          <button className="btn primary" onClick={handleAdd} disabled={saving}>
            {saving ? t("warehouseAdd.saving") : t("warehouseAdd.add")}
          </button>
        </div>
        {selectedProduct && (
          <div className="muted small mt-12">
            {t("warehouseAdd.selectedLabel")}: {selectedProduct.ProductName} ({selectedProduct.SKU})
          </div>
        )}
      </div>
    </div>
  );
}
