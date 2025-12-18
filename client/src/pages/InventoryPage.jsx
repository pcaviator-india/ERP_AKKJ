import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
const resolveImg = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
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
  const [warehouseInitialized, setWarehouseInitialized] = useState(false);
  const [lotView, setLotView] = useState("all"); // all | lotsTracked | lotsNonTracked
  const [serialView, setSerialView] = useState("all"); // all | serialTracked | serialNonTracked
  const [drafts, setDrafts] = useState({});
  const [initialDrafts, setInitialDrafts] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortField, setSortField] = useState("ProductName");
  const [sortDir, setSortDir] = useState("asc");
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockWarehouseId, setStockWarehouseId] = useState("");
  const [stockProductQuery, setStockProductQuery] = useState("");
  const [stockProductResults, setStockProductResults] = useState([]);
  const [stockHighlight, setStockHighlight] = useState(-1);
  const [stockSelectedProduct, setStockSelectedProduct] = useState(null);
  const [lotList, setLotList] = useState([]);
  const [lotDrafts, setLotDrafts] = useState({});
  const [lotNumber, setLotNumber] = useState("");
  const [lotExpiration, setLotExpiration] = useState("");
  const [lotQuantity, setLotQuantity] = useState("");
  const [lotLoading, setLotLoading] = useState(false);
  const [lotSaving, setLotSaving] = useState(false);
  const [lotStatus, setLotStatus] = useState({ type: "", message: "" });
  const [serialInput, setSerialInput] = useState("");
  const [plainQuantity, setPlainQuantity] = useState("");
  const [plainLow, setPlainLow] = useState("");
  const [plainMax, setPlainMax] = useState("");
  const [addToExisting, setAddToExisting] = useState(false);
  const [stagedEntries, setStagedEntries] = useState([]);

  useEffect(() => {
    document.title = t("inventory.title");
  }, [t]);

  const loadInventory = useCallback(async () => {
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
      if (!warehouseInitialized && !selectedWarehouse) {
        const defaultWh = whData.find((w) => w.IsDefault) || whData[0];
        if (defaultWh) setSelectedWarehouse(String(defaultWh.WarehouseID));
        setWarehouseInitialized(true);
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
  }, [selectedWarehouse, t, warehouseInitialized]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const loadLots = async (productId, warehouseId) => {
    if (!productId || !warehouseId) return;
    setLotLoading(true);
    setLotStatus({ type: "", message: "" });
    try {
      const { data } = await api.get("/api/product-lots", {
        params: {
          productId,
          warehouseId,
          includeZero: 1,
        },
      });
      const list = Array.isArray(data) ? data : [];
      setLotList(list);
      const nextDrafts = {};
      list.forEach((lot) => {
        nextDrafts[lot.ProductLotID] = lot.Quantity ?? 0;
      });
      setLotDrafts(nextDrafts);
    } catch (err) {
      console.error("Failed to load lots", err);
      setLotStatus({ type: "error", message: "Failed to load lots." });
    } finally {
      setLotLoading(false);
    }
  };

  useEffect(() => {
    if (!stockModalOpen) return;
    const term = stockProductQuery.trim();
    if (term.length < 2) {
      setStockProductResults([]);
      setStockHighlight(-1);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/api/products", {
          params: { q: term, type: "active" },
        });
        const list = Array.isArray(res.data) ? res.data : [];
        setStockProductResults(list.slice(0, 20));
        setStockHighlight(list.length ? 0 : -1);
      } catch (err) {
        console.error("Failed to search products for lots", err);
        setStockProductResults([]);
        setStockHighlight(-1);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [stockModalOpen, stockProductQuery]);

  useEffect(() => {
    if (!stockModalOpen) return;
    if (!stockSelectedProduct || !stockWarehouseId) {
      setLotList([]);
      setLotDrafts({});
      return;
    }
    if (Number(stockSelectedProduct?.UsesLots || 0) === 1) {
      loadLots(stockSelectedProduct.ProductID, stockWarehouseId);
    } else {
      setLotList([]);
      setLotDrafts({});
    }
  }, [stockModalOpen, stockSelectedProduct, stockWarehouseId]);

  const openStockModal = () => {
    setLotStatus({ type: "", message: "" });
    setStockWarehouseId(selectedWarehouse || "");
    setStockProductQuery("");
    setStockProductResults([]);
    setStockHighlight(-1);
    setStockSelectedProduct(null);
    setLotList([]);
    setLotDrafts({});
    setLotNumber("");
    setLotExpiration("");
    setLotQuantity("");
    setSerialInput("");
    setPlainQuantity("");
    setPlainLow("");
    setPlainMax("");
    setAddToExisting(false);
    setStagedEntries([]);
    setStockModalOpen(true);
  };

  const closeStockModal = () => {
    setStockModalOpen(false);
  };

  const handleSelectProduct = (p) => {
    setStockSelectedProduct(p);
    setStockProductResults([]);
    setStockProductQuery(`${p.ProductName} (${p.SKU || ""})`);
    setStockHighlight(-1);
  };

  const handleAddStock = () => {
    setLotStatus({ type: "", message: "" });
    if (!stockSelectedProduct || !stockWarehouseId) {
      setLotStatus({ type: "error", message: "Select a warehouse and product." });
      return;
    }
    const usesLots = Number(stockSelectedProduct.UsesLots || 0) === 1;
    const usesSerials = Number(stockSelectedProduct.UsesSerials || 0) === 1;
    if (usesSerials) {
      const lines = serialInput
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const unique = Array.from(new Set(lines));
      if (!unique.length) {
        setLotStatus({ type: "error", message: "Enter one or more serial numbers." });
        return;
      }
      const warehouseName =
        warehouses.find((w) => String(w.WarehouseID) === String(stockWarehouseId))?.WarehouseName ||
        "";
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        productId: Number(stockSelectedProduct.ProductID),
        productName: stockSelectedProduct.ProductName,
        sku: stockSelectedProduct.SKU,
        warehouseId: Number(stockWarehouseId),
        warehouseName,
        usesSerials: true,
        serials: unique,
      };
      setStagedEntries((prev) => [...prev, entry]);
      setSerialInput("");
      setStockSelectedProduct(null);
      setStockProductQuery("");
      setStockProductResults([]);
      setStockHighlight(-1);
      setLotStatus({ type: "success", message: "Serials added to list." });
      return;
    }
    const warehouseName =
      warehouses.find((w) => String(w.WarehouseID) === String(stockWarehouseId))?.WarehouseName ||
      "";
    const entryId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    if (usesLots) {
      if (!lotNumber.trim()) {
        setLotStatus({ type: "error", message: "Lot number is required." });
        return;
      }
      const qty = lotQuantity === "" ? 0 : Number(lotQuantity);
      if (Number.isNaN(qty)) {
        setLotStatus({ type: "error", message: "Enter a valid quantity." });
        return;
      }
      const existingLot =
        lotList.find(
          (l) => String(l.LotNumber || "").toLowerCase() === lotNumber.trim().toLowerCase()
        ) || null;
      const entry = {
        id: entryId,
        productId: Number(stockSelectedProduct.ProductID),
        productName: stockSelectedProduct.ProductName,
        sku: stockSelectedProduct.SKU,
        warehouseId: Number(stockWarehouseId),
        warehouseName,
        usesLots: true,
        lotNumber: lotNumber.trim(),
        lotExpiration: lotExpiration || "",
        quantity: qty,
        addToExisting,
        existingLotId: existingLot?.ProductLotID || null,
        existingLotQuantity: existingLot?.Quantity ?? null,
      };
      setStagedEntries((prev) => [...prev, entry]);
      setLotNumber("");
      setLotExpiration("");
      setLotQuantity("");
      setAddToExisting(false);
      setLotStatus({ type: "success", message: "Added to list." });
      setStockSelectedProduct(null);
      setStockProductQuery("");
      setStockProductResults([]);
      setStockHighlight(-1);
      setLotList([]);
      setLotDrafts({});
    } else {
      const qty = plainQuantity === "" ? 0 : Number(plainQuantity);
      if (Number.isNaN(qty)) {
        setLotStatus({ type: "error", message: "Enter a valid quantity." });
        return;
      }
      const entry = {
        id: entryId,
        ProductID: Number(stockSelectedProduct.ProductID),
        WarehouseID: Number(stockWarehouseId),
        productId: Number(stockSelectedProduct.ProductID),
        productName: stockSelectedProduct.ProductName,
        sku: stockSelectedProduct.SKU,
        warehouseId: Number(stockWarehouseId),
        warehouseName,
        usesLots: false,
        StockQuantity: qty,
        MinStockLevel: plainLow === "" ? null : Number(plainLow),
        MaxStockLevel: plainMax === "" ? null : Number(plainMax),
        ProductLotID: null,
        addToExisting,
      };
      setStagedEntries((prev) => [...prev, entry]);
      setPlainQuantity("");
      setPlainLow("");
      setPlainMax("");
      setAddToExisting(false);
      setLotStatus({ type: "success", message: "Added to list." });
      setStockSelectedProduct(null);
      setStockProductQuery("");
      setStockProductResults([]);
      setStockHighlight(-1);
    }
  };

  const processStagedEntries = async () => {
    if (!stagedEntries.length) return;
    setLotSaving(true);
    setLotStatus({ type: "", message: "" });
    const bulkEntries = [];
    try {
      for (const entry of stagedEntries) {
        if (entry.usesLots) {
          if (entry.addToExisting && entry.existingLotId) {
            await api.post("/api/inventory/adjust", {
              ProductID: entry.productId,
              WarehouseID: entry.warehouseId,
              QuantityChange: entry.quantity,
              Reason: "Add stock (lot)",
              ProductLotID: entry.existingLotId,
            });
          } else {
            await api.post("/api/product-lots", {
              ProductID: entry.productId,
              WarehouseID: entry.warehouseId,
              LotNumber: entry.lotNumber,
              ExpirationDate: entry.lotExpiration || null,
              Quantity:
                entry.addToExisting && entry.existingLotQuantity != null
                  ? entry.existingLotQuantity + entry.quantity
                  : entry.quantity,
            });
          }
        } else if (entry.usesSerials) {
          await api.post("/api/product-serials/intake", {
            ProductID: entry.productId,
            WarehouseID: entry.warehouseId,
            serials: entry.serials,
          });
        } else {
          const base = {
            ProductID: entry.productId,
            WarehouseID: entry.warehouseId,
            StockQuantity: entry.StockQuantity,
            MinStockLevel: entry.MinStockLevel,
            MaxStockLevel: entry.MaxStockLevel,
            ProductLotID: null,
          };
          if (entry.addToExisting) {
            await api.post("/api/inventory/adjust", {
              ProductID: base.ProductID,
              WarehouseID: base.WarehouseID,
              QuantityChange: base.StockQuantity,
              Reason: "Add stock",
              ProductLotID: null,
            });
          } else {
            bulkEntries.push(base);
          }
        }
      }

      if (bulkEntries.length) {
        const merged = {};
        bulkEntries.forEach((b) => {
          const key = `${b.ProductID}-${b.WarehouseID}`;
          merged[key] = { ...b };
        });
        await api.post("/api/inventory/levels/bulk-save", {
          entries: Object.values(merged),
        });
      }

      await loadInventory();
      setLotStatus({ type: "success", message: "Staged items saved." });
      setStagedEntries([]);
      setStockSelectedProduct(null);
      setStockProductQuery("");
      setStockProductResults([]);
      setLotList([]);
      setLotDrafts({});
      setLotNumber("");
      setLotExpiration("");
      setLotQuantity("");
      setSerialInput("");
      setPlainQuantity("");
      setPlainLow("");
      setPlainMax("");
      setAddToExisting(false);
    } catch (err) {
      console.error("Failed to process staged entries", err);
      setLotStatus({ type: "error", message: "Failed to save staged entries." });
    } finally {
      setLotSaving(false);
    }
  };

  const handleSaveLot = async (lotId) => {
    if (!lotSelectedProduct || !lotWarehouseId) return;
    setLotSaving(true);
    setLotStatus({ type: "", message: "" });
    try {
      const qty = Number(lotDrafts[lotId] ?? 0);
      await api.put(`/api/product-lots/${lotId}`, {
        WarehouseID: Number(lotWarehouseId),
        Quantity: qty,
      });
      await loadLots(lotSelectedProduct.ProductID, lotWarehouseId);
    } catch (err) {
      console.error("Failed to save lot", err);
      setLotStatus({ type: "error", message: "Failed to update lot." });
    } finally {
      setLotSaving(false);
    }
  };

  const showLotRows = false;

  const filteredLevels = useMemo(() => {
    const term = search.trim().toLowerCase();
    let base = levels.filter((p) => {
      if (selectedWarehouse && String(p.WarehouseID) !== selectedWarehouse) return false;
      if (categoryFilter && String(p.ProductCategoryID) !== categoryFilter) {
        return false;
      }
      if (typeFilter === "active" && !p.IsActive) return false;
      if (typeFilter === "inactive" && p.IsActive) return false;
      if (lotView === "lotsTracked" && Number(p.UsesLots || 0) !== 1) return false;
      if (lotView === "lotsNonTracked" && Number(p.UsesLots || 0) === 1) return false;
      if (serialView === "serialTracked" && Number(p.UsesSerials || 0) !== 1) return false;
      if (serialView === "serialNonTracked" && Number(p.UsesSerials || 0) === 1) return false;
      if (!term) return true;
      return (
        (p.ProductName || "").toLowerCase().includes(term) ||
        (p.SKU || "").toLowerCase().includes(term) ||
        (p.Barcode || "").toLowerCase().includes(term)
      );
    });

    if (!showLotRows) {
      const aggMap = new Map();
      base.forEach((p) => {
        const key = `${p.ProductID}-${p.WarehouseID || "0"}`;
        if (!aggMap.has(key)) {
          aggMap.set(key, {
            ...p,
            ProductLotID: null,
            LotNumber: null,
            ExpirationDate: null,
            StockQuantity: 0,
            ReservedQuantity: 0,
            AvailableQuantity: 0,
          });
        }
        const agg = aggMap.get(key);
        agg.StockQuantity = Number(agg.StockQuantity || 0) + Number(p.StockQuantity || 0);
        agg.ReservedQuantity = Number(agg.ReservedQuantity || 0) + Number(p.ReservedQuantity || 0);
        agg.AvailableQuantity =
          Number(agg.AvailableQuantity || 0) + Number(p.AvailableQuantity || 0);
      });
      base = Array.from(aggMap.values());
    }

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
  }, [levels, search, categoryFilter, typeFilter, lotView, serialView, drafts, sortField, sortDir, showLotRows]);

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

        if (Number(p.UsesLots || 0) === 1 && !p.ProductLotID) {
          return null; // do not allow saving lot-tracked products without a lot
        }

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
          <button className="btn ghost" onClick={openStockModal}>
            Add stock / lots
          </button>
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
              style={{ width: 180 }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ minWidth: 150, maxWidth: 180 }}
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
            style={{ minWidth: 140, maxWidth: 160 }}
          >
            <option value="all">{t("inventory.filterAll")}</option>
            <option value="active">{t("inventory.filterActive")}</option>
            <option value="inactive">{t("inventory.filterInactive")}</option>
          </select>
          <select
            value={lotView}
            onChange={(e) => setLotView(e.target.value)}
            style={{ minWidth: 170, maxWidth: 200 }}
            title="Lot view"
          >
            <option value="all">All products</option>
            <option value="lotsTracked">Lots tracked</option>
            <option value="lotsNonTracked">Non-lot products</option>
          </select>
          <select
            value={serialView}
            onChange={(e) => setSerialView(e.target.value)}
            style={{ minWidth: 170, maxWidth: 200 }}
            title="Serial view"
          >
            <option value="all">All products</option>
            <option value="serialTracked">Serial tracked</option>
            <option value="serialNonTracked">Non-serial products</option>
          </select>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            style={{ minWidth: 150, maxWidth: 180 }}
          >
            <option value="">{t("inventory.allWarehouses", "All warehouses")}</option>
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
                <div className="sort-head muted small">{t("inventory.actions", "Actions")}</div>
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
                      <div className="inventory-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {Number(p.UsesLots || 0) === 1 || Number(p.UsesSerials || 0) === 1 ? (
                          <a
                            className="icon-btn"
                            href={`/inventory/${p.ProductID}/${p.WarehouseID || ""}/details`}
                            title={t("inventory.viewDetails", "View details")}
                            style={{ order: 2 }}
                          >
                            ☰
                          </a>
                        ) : null}
                        <span style={{ order: 1 }}>{p.ProductName}</span>
                      </div>
                      <div className="muted small">{p.Barcode || p.SKU}</div>
                      <div className="muted small">{p.WarehouseName}</div>
                      {Number(p.UsesLots || 0) === 1 && (
                        <div className="muted small">Lot-tracked</div>
                      )}
                      {Number(p.UsesSerials || 0) === 1 && (
                        <div className="muted small">Serial-tracked</div>
                      )}
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
                        disabled={Number(p.UsesLots || 0) === 1 || Number(p.UsesSerials || 0) === 1}
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
                        disabled={Number(p.UsesLots || 0) === 1 || Number(p.UsesSerials || 0) === 1}
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
                        disabled={Number(p.UsesLots || 0) === 1 || Number(p.UsesSerials || 0) === 1}
                      />
                    </div>
                    <div className="inventory-actions-col">
                      <span className="muted small">-</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <p className="muted small helper-text">{t("inventory.saveHint")}</p>
      </div>

      {stockModalOpen && (
        <div className="modal">
          <div className="modal-content" style={{ width: "min(96%, 720px)" }}>
            <h3>Add stock / lots</h3>
            {lotStatus.message && (
              <p className={`status ${lotStatus.type}`}>{lotStatus.message}</p>
            )}

            <label>
              Warehouse
              <select
                value={stockWarehouseId}
                onChange={(e) => setStockWarehouseId(e.target.value)}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.WarehouseID} value={w.WarehouseID}>
                    {w.WarehouseName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Product
              <input
                value={stockProductQuery}
                onChange={(e) => setStockProductQuery(e.target.value)}
                placeholder="Search product name or SKU"
                onKeyDown={(e) => {
                  if (!stockProductResults.length) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setStockHighlight((prev) => {
                      const next = prev + 1;
                      return next >= stockProductResults.length ? 0 : next;
                    });
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setStockHighlight((prev) => {
                      if (prev <= 0) return stockProductResults.length - 1;
                      return prev - 1;
                    });
                  } else if (e.key === "Enter") {
                    if (stockHighlight >= 0 && stockHighlight < stockProductResults.length) {
                      e.preventDefault();
                      handleSelectProduct(stockProductResults[stockHighlight]);
                    }
                  }
                }}
              />
            </label>
            {stockProductResults.length > 0 && (
              <ul className="list">
                {stockProductResults.map((p, idx) => (
                  <li
                    key={p.ProductID}
                    className="list-row"
                    style={{
                      cursor: "pointer",
                      background: idx === stockHighlight ? "#eef2ff" : "transparent",
                    }}
                    onClick={() => handleSelectProduct(p)}
                  >
                    <span>
                      {p.SKU ? `${p.SKU} - ` : ""}
                      {p.ProductName}
                    </span>
                    <div className="list-actions inline">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProduct(p);
                        }}
                      >
                        Select
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {stockSelectedProduct && (
              <div className="card">
                <div className="stack">
                  <strong>{stockSelectedProduct.ProductName}</strong>
                  <span className="muted small">{stockSelectedProduct.SKU}</span>
                  <span className="muted small">
                    {Number(stockSelectedProduct.UsesLots || 0) === 1
                      ? "Lot-tracked"
                      : Number(stockSelectedProduct.UsesSerials || 0) === 1
                        ? "Serial-tracked"
                        : "Non-lot"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={addToExisting}
                    onChange={(e) => setAddToExisting(e.target.checked)}
                  />
                  <span>Add to existing</span>
                </div>

                {Number(stockSelectedProduct.UsesLots || 0) === 1 ? (
                  <>
                    <div className="grid three">
                      <label>
                        Lot number
                        <input
                          value={lotNumber}
                          onChange={(e) => setLotNumber(e.target.value)}
                          placeholder="LOT-001"
                        />
                      </label>
                      <label>
                        Expiration
                        <input
                          type="date"
                          value={lotExpiration}
                          onChange={(e) => setLotExpiration(e.target.value)}
                        />
                      </label>
                      <label>
                        Quantity
                        <input
                          type="number"
                          min="0"
                          value={lotQuantity}
                          onChange={(e) => setLotQuantity(e.target.value)}
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <div className="actions">
                      <button
                        className="btn primary"
                        onClick={handleAddStock}
                        disabled={lotSaving}
                      >
                        Add to list
                      </button>
                    </div>
                  </>
                ) : Number(stockSelectedProduct.UsesSerials || 0) === 1 ? (
                  <>
                    <label>
                      Serial numbers (one per line)
                      <textarea
                        rows={4}
                        value={serialInput}
                        onChange={(e) => setSerialInput(e.target.value)}
                        placeholder="Enter or paste serials"
                      />
                    </label>
                    <div className="actions">
                      <button
                        className="btn primary"
                        onClick={handleAddStock}
                        disabled={lotSaving}
                      >
                        Add to list
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid three">
                      <label>
                        Quantity
                        <input
                          type="number"
                          min="0"
                          value={plainQuantity}
                          onChange={(e) => setPlainQuantity(e.target.value)}
                          placeholder="0"
                        />
                      </label>
                      <label>
                        Low stock threshold
                        <input
                          type="number"
                          min="0"
                          value={plainLow}
                          onChange={(e) => setPlainLow(e.target.value)}
                          placeholder={t("inventory.noThreshold")}
                        />
                      </label>
                      <label>
                        Max stock
                        <input
                          type="number"
                          min="0"
                          value={plainMax}
                          onChange={(e) => setPlainMax(e.target.value)}
                          placeholder={t("inventory.noMax")}
                        />
                      </label>
                    </div>
                    <div className="actions">
                      <button
                        className="btn primary"
                        onClick={handleAddStock}
                        disabled={lotSaving}
                      >
                        Add to list
                      </button>
                    </div>
                  </>
                )}

                {Number(stockSelectedProduct.UsesLots || 0) === 1 && (
                  <>
                    {lotLoading ? (
                      <p className="muted">Loading lots...</p>
                    ) : lotList.length === 0 ? (
                      <p className="muted">No lots yet.</p>
                    ) : (
                      <div className="entity-list">
                        {lotList.map((lot) => (
                          <div key={lot.ProductLotID} className="entity-row">
                            <div className="stack">
                              <span className="entity-name">{lot.LotNumber}</span>
                              <span className="muted small">
                                Exp: {formatDate(lot.ExpirationDate) || "No date"}
                              </span>
                            </div>
                            <div className="inline-inputs">
                              <input
                                type="number"
                                min="0"
                                value={lotDrafts[lot.ProductLotID] ?? 0}
                                onChange={(e) =>
                                  setLotDrafts((prev) => ({
                                    ...prev,
                                    [lot.ProductLotID]:
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value),
                                  }))
                                }
                                style={{ width: 110 }}
                              />
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleSaveLot(lot.ProductLotID)}
                                disabled={lotSaving}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {stagedEntries.length > 0 && (
              <div className="card" style={{ marginTop: 12 }}>
                <div className="list-row" style={{ justifyContent: "space-between" }}>
                  <strong>Staged items ({stagedEntries.length})</strong>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setStagedEntries([])}
                    disabled={lotSaving}
                  >
                    Clear list
                  </button>
                </div>
                <ul className="list">
                  {stagedEntries.map((entry) => (
                    <li key={entry.id} className="list-row">
                      <div className="stack">
                        <span className="entity-name">{entry.productName}</span>
                        <span className="muted small">
                          {entry.sku}
                          {entry.warehouseName ? ` · ${entry.warehouseName}` : ""}
                          {entry.usesLots
                            ? ` · Lot ${entry.lotNumber}${entry.lotExpiration ? ` · Exp ${formatDate(entry.lotExpiration)}` : ""}`
                            : entry.usesSerials
                              ? " · Serial-tracked"
                              : " · Non-lot"}
                        </span>
                        <span className="muted small">
                          {entry.usesLots
                            ? `Qty ${entry.quantity}${entry.addToExisting ? " (add)" : " (set)"}`
                            : entry.usesSerials
                              ? `Serials ${entry.serials.length}`
                              : `Qty ${entry.StockQuantity}${entry.addToExisting ? " (add)" : " (set)"}${
                                  entry.MinStockLevel !== null && entry.MinStockLevel !== undefined
                                    ? ` · Min ${entry.MinStockLevel}`
                                    : ""
                                }${
                                  entry.MaxStockLevel !== null && entry.MaxStockLevel !== undefined
                                    ? ` · Max ${entry.MaxStockLevel}`
                                    : ""
                                }`}
                        </span>
                        {entry.usesSerials && entry.serials?.length ? (
                          <span className="muted small">
                            {entry.serials.slice(0, 3).join(", ")}
                            {entry.serials.length > 3 ? ` +${entry.serials.length - 3} more` : ""}
                          </span>
                        ) : null}
                      </div>
                      <div className="list-actions inline">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() =>
                            setStagedEntries((prev) => prev.filter((e) => e.id !== entry.id))
                          }
                          disabled={lotSaving}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn ghost" onClick={closeStockModal}>
                Close
              </button>
              <button
                className="btn ghost"
                onClick={() => setStagedEntries([])}
                disabled={!stagedEntries.length || lotSaving}
              >
                Clear list
              </button>
              <button
                className="btn primary"
                onClick={processStagedEntries}
                disabled={!stagedEntries.length || lotSaving}
              >
                {lotSaving ? "Processing..." : "Process all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
