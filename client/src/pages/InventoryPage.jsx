import { useEffect, useMemo, useState } from "react";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
const resolveImg = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function InventoryPage() {
  const { company } = useAuth();
  const { t } = useLanguage();
  const rowKey = (p) => `${p.ProductID}-${p.WarehouseID || "0"}-${p.ProductLotID || "null"}`;
  const [levels, setLevels] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [drafts, setDrafts] = useState({});
  const [initialDrafts, setInitialDrafts] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortField, setSortField] = useState("ProductName");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    document.title = t("inventory.title");
  }, [t]);

  useEffect(() => {
    const loadInventory = async () => {
      setLoading(true);
      setStatus({ type: "", message: "" });
      try {
        const [invRes, catRes, whRes] = await Promise.all([
          api.get("/api/inventory/levels", {
            params: {
              includeZero: 1,
              warehouseId: selectedWarehouse || undefined,
            },
          }),
          api.get("/api/categories"),
          api.get("/api/warehouses"),
        ]);
        const invData = Array.isArray(invRes.data) ? invRes.data : [];
        setLevels(invData);
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        const whData = Array.isArray(whRes.data) ? whRes.data : [];
        setWarehouses(whData);
        if (!selectedWarehouse) {
          const defaultWh = whData.find((w) => w.IsDefault) || whData[0];
          if (defaultWh) setSelectedWarehouse(String(defaultWh.WarehouseID));
        }
        const mappedDrafts = {};
        invData.forEach((p) => {
          mappedDrafts[rowKey(p)] = {
            stock: p.StockQuantity ?? 0,
            lowStock: p.MinStockLevel ?? "",
            maxStock: p.MaxStockLevel ?? "",
          };
        });
        setDrafts(mappedDrafts);
        setInitialDrafts(mappedDrafts);
        setSelectedIds(new Set());
      } catch (err) {
        console.error("Failed to load inventory", err);
        setStatus({ type: "error", message: t("inventory.loadError") });
      } finally {
        setLoading(false);
      }
    };
    loadInventory();
  }, [t, selectedWarehouse]);

  const filteredLevels = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = levels.filter((p) => {
      if (selectedWarehouse && String(p.WarehouseID) !== selectedWarehouse) return false;
      if (categoryFilter && String(p.ProductCategoryID) !== categoryFilter) {
        return false;
      }
      if (typeFilter === "active" && !p.IsActive) return false;
      if (typeFilter === "inactive" && p.IsActive) return false;
      if (!term) return true;
      return (
        (p.ProductName || "").toLowerCase().includes(term) ||
        (p.SKU || "").toLowerCase().includes(term) ||
        (p.Barcode || "").toLowerCase().includes(term)
      );
    });

    const sorted = [...base].sort((a, b) => {
      const order = sortDir === "asc" ? 1 : -1;
      const draftA = drafts[rowKey(a)] || {};
      const draftB = drafts[rowKey(b)] || {};
      const valueMap = {
        ProductName: (p) => (p.ProductName || "").toString(),
        SKU: (p) => (p.SKU || "").toString(),
        Stock: (p, draft) =>
          draft.stock !== undefined && draft.stock !== "" ? Number(draft.stock) : Number(p.StockQuantity || 0),
        MinStockLevel: (p, draft) =>
          draft.lowStock !== undefined && draft.lowStock !== "" ? Number(draft.lowStock) : Number(p.MinStockLevel || 0),
        MaxStockLevel: (p, draft) =>
          draft.maxStock !== undefined && draft.maxStock !== "" ? Number(draft.maxStock) : Number(p.MaxStockLevel || 0),
      };
      const getter = valueMap[sortField] || valueMap.ProductName;
      const aVal = getter(a, draftA);
      const bVal = getter(b, draftB);

      if (aVal == null && bVal != null) return -1 * order;
      if (aVal != null && bVal == null) return 1 * order;
      if (aVal == null && bVal == null) return 0;

      if (typeof aVal === "number" && typeof bVal === "number") {
        if (aVal === bVal) return 0;
        return aVal > bVal ? order : -order;
      }

      return String(aVal).localeCompare(String(bVal)) * order;
    });

    return sorted.slice(0, 500);
  }, [levels, search, categoryFilter, typeFilter, drafts, sortField, sortDir]);

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(filteredLevels.map((p) => rowKey(p))));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleRow = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked ?? !next.has(id)) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const updateDraft = (id, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
      },
    }));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const caretFor = (field) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? "^" : "v";
  };

  const normalizeNumber = (val) => {
    if (val === "" || val === null || val === undefined) return null;
    const n = Number(val);
    return Number.isNaN(n) ? null : n;
  };

  const handleSave = async () => {
    setStatus({ type: "", message: "" });
    const source = levels;
    const changes = source
      .map((p) => {
        const key = rowKey(p);
        const draft = drafts[key] || {};
        const initial = initialDrafts[key] || {};
        const stock = normalizeNumber(draft.stock);
        const min = normalizeNumber(draft.lowStock);
        const max = normalizeNumber(draft.maxStock);

        const stockChanged = stock !== normalizeNumber(initial.stock);
        const minChanged = min !== normalizeNumber(initial.lowStock);
        const maxChanged = max !== normalizeNumber(initial.maxStock);

        if (!stockChanged && !minChanged && !maxChanged) return null;

        return {
          ProductID: p.ProductID,
          WarehouseID: p.WarehouseID,
          StockQuantity: stock ?? 0,
          MinStockLevel: min,
          MaxStockLevel: max,
          ProductLotID: p.ProductLotID || null,
        };
      })
      .filter(Boolean);

    if (changes.length === 0) {
      setStatus({ type: "info", message: t("inventory.noChanges") });
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/inventory/levels/bulk-save", { entries: changes });
      setStatus({ type: "success", message: t("inventory.saveSuccess") });
      setLevels((prev) =>
        prev.map((lvl) => {
          const match = changes.find(
            (c) =>
              c.ProductID === lvl.ProductID &&
              c.WarehouseID === lvl.WarehouseID &&
              (lvl.ProductLotID || null) === (c.ProductLotID || null)
          );
          if (!match) return lvl;
          return {
            ...lvl,
            StockQuantity: match.StockQuantity,
            MinStockLevel: match.MinStockLevel,
            MaxStockLevel: match.MaxStockLevel,
          };
        })
      );
      setInitialDrafts((prev) => {
        const next = { ...prev };
        changes.forEach((c) => {
          const key = rowKey({
            ProductID: c.ProductID,
            WarehouseID: c.WarehouseID,
            ProductLotID: c.ProductLotID,
          });
          next[key] = {
            stock: c.StockQuantity,
            lowStock: c.MinStockLevel,
            maxStock: c.MaxStockLevel,
          };
        });
        return next;
      });
    } catch (err) {
      console.error("Failed to save inventory", err);
      setStatus({ type: "error", message: t("inventory.saveError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page inventory-page">
      <header className="list-header inventory-header">
        <div>
          <h2>
            {t("inventory.title")}{" "}
            {company?.CompanyName ? `- ${company.CompanyName}` : ""}
          </h2>
          <p className="muted">{t("inventory.description")}</p>
        </div>
        <div className="inventory-actions">
          <button className="btn ghost">{t("inventory.import")}</button>
          <button className="btn ghost">{t("inventory.export")}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? t("inventory.saving") : t("inventory.save")}
          </button>
        </div>
      </header>

      {status.message && (
        <p className={`status ${status.type}`}>{status.message}</p>
      )}

      <div className="card inventory-card">
        <div className="inventory-toolbar">
          <div className="inventory-search">
            <span role="img" aria-hidden="true">🔍</span>
            <input
              placeholder={t("inventory.search")}
              aria-label={t("inventory.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t("inventory.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.ProductCategoryID} value={c.ProductCategoryID}>
                {c.CategoryName}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">{t("inventory.filterAll")}</option>
            <option value="active">{t("inventory.filterActive")}</option>
            <option value="inactive">{t("inventory.filterInactive")}</option>
          </select>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="">{t("inventory.allWarehouses")}</option>
            {warehouses.map((w) => (
              <option key={w.WarehouseID} value={w.WarehouseID}>
                {w.WarehouseName}
              </option>
            ))}
          </select>
          <div className="inventory-count muted small">
            {t("inventory.count", { count: filteredLevels.length })}
          </div>
        </div>

        <div className="inventory-table">
          {loading ? (
            <p className="muted table-message">{t("inventory.loading")}</p>
          ) : filteredLevels.length === 0 ? (
            <p className="muted table-message">{t("inventory.empty")}</p>
          ) : (
            <>
              <div className="inventory-table-head">
                <input
                  type="checkbox"
                  checked={filteredLevels.length > 0 && filteredLevels.every((p) => selectedIds.has(rowKey(p)))}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
                <button type="button" className="sort-head" onClick={() => handleSort("ProductName")}>
                  {t("inventory.product")} <span className="sort-caret">{caretFor("ProductName")}</span>
                </button>
                <button type="button" className="sort-head" onClick={() => handleSort("SKU")}>
                  {t("inventory.sku")} <span className="sort-caret">{caretFor("SKU")}</span>
                </button>
                <button type="button" className="sort-head" onClick={() => handleSort("Stock")}>
                  {t("inventory.stock")} <span className="sort-caret">{caretFor("Stock")}</span>
                </button>
                <button type="button" className="sort-head" onClick={() => handleSort("MinStockLevel")}>
                  {t("inventory.lowStock")} <span className="sort-caret">{caretFor("MinStockLevel")}</span>
                </button>
                <button type="button" className="sort-head" onClick={() => handleSort("MaxStockLevel")}>
                  {t("inventory.maxStock")} <span className="sort-caret">{caretFor("MaxStockLevel")}</span>
                </button>
              </div>
              {filteredLevels.map((p) => {
                const key = rowKey(p);
                const draft = drafts[key] || {
                  stock: "",
                  lowStock: "",
                  maxStock: "",
                };
                return (
                  <div className="inventory-row" key={key}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(key)}
                      onChange={(e) => toggleRow(key, e.target.checked)}
                    />
                    <div className="inventory-product">
                      <div className="inventory-thumb">
                        {p.ImageURL ? (
                          <img
                            src={resolveImg(p.ImageURL)}
                            alt={p.ProductName}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="inventory-thumb-fallback">
                            {(p.ProductName || p.SKU || "?").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="inventory-name">{p.ProductName}</div>
                        <div className="muted small">{p.Barcode || p.SKU}</div>
                        <div className="muted small">{p.WarehouseName}</div>
                      </div>
                    </div>
                    <div className="inventory-sku">
                      <input value={p.SKU || ""} readOnly />
                    </div>
                    <div className="inventory-stock">
                      <input
                        type="number"
                        min="0"
                        value={draft.stock}
                        onChange={(e) =>
                          updateDraft(key, "stock", e.target.value === "" ? "" : Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="inventory-low">
                      <input
                        type="number"
                        min="0"
                        placeholder={t("inventory.noThreshold")}
                        value={draft.lowStock}
                        onChange={(e) =>
                          updateDraft(
                            key,
                            "lowStock",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div className="inventory-high">
                      <input
                        type="number"
                        min="0"
                        placeholder={t("inventory.noMax")}
                        value={draft.maxStock}
                        onChange={(e) =>
                          updateDraft(
                            key,
                            "maxStock",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <p className="muted small helper-text">{t("inventory.saveHint")}</p>
      </div>
    </div>
  );
}

