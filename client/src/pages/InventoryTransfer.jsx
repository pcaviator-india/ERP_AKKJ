import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

const SEARCH_MIN_LENGTH = 2;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

export default function InventoryTransfer() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [warehousesError, setWarehousesError] = useState("");

  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");

  const [inventoryLevels, setInventoryLevels] = useState([]);
  const [levelsLoading, setLevelsLoading] = useState(false);

  const [status, setStatus] = useState({ type: "", message: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentQuantity, setCurrentQuantity] = useState("");
  const [currentLotList, setCurrentLotList] = useState([]);
  const [currentLotId, setCurrentLotId] = useState("");
  const [currentLotLoading, setCurrentLotLoading] = useState(false);
  const [currentSerials, setCurrentSerials] = useState("");
  const [currentError, setCurrentError] = useState("");

  const [stagedItems, setStagedItems] = useState([]);
  const [overallNote, setOverallNote] = useState("");
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    document.title = t("inventory.transferPage.title");
  }, [t]);

  const loadWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    setWarehousesError("");
    try {
      const { data } = await api.get("/api/warehouses");
      const list = Array.isArray(data) ? data : [];
      setWarehouses(list);
      if (list.length) {
        const defaultSource = list.find((w) => w.IsDefault) || list[0];
        const defaultSourceId = defaultSource ? String(defaultSource.WarehouseID) : "";
        setFromWarehouse((prev) => {
          if (prev) return prev;
          return defaultSourceId;
        });
        setToWarehouse((prev) => {
          if (prev && list.some((w) => String(w.WarehouseID) === String(prev))) {
            if (String(prev) === defaultSourceId) {
              const alt = list.find(
                (w) => String(w.WarehouseID) !== defaultSourceId
              );
              return alt ? String(alt.WarehouseID) : prev;
            }
            return prev;
          }
          const alt = list.find(
            (w) => !defaultSourceId || String(w.WarehouseID) !== defaultSourceId
          );
          return alt ? String(alt.WarehouseID) : "";
        });
      }
    } catch (err) {
      console.error("Failed to load warehouses", err);
      setWarehousesError(t("inventory.transferPage.errors.loadWarehouses"));
    } finally {
      setWarehousesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    if (!warehouses.length) return;
    if (!fromWarehouse) return;
    if (toWarehouse && toWarehouse === fromWarehouse) {
      const alt = warehouses.find(
        (w) => String(w.WarehouseID) !== String(fromWarehouse)
      );
      setToWarehouse(alt ? String(alt.WarehouseID) : "");
    }
  }, [fromWarehouse, toWarehouse, warehouses]);

  const loadInventoryLevels = useCallback(
    async (warehouseId) => {
      if (!warehouseId) {
        setInventoryLevels([]);
        return;
      }
      setLevelsLoading(true);
      try {
        const { data } = await api.get("/api/inventory/levels", {
          params: {
            warehouseId,
            includeZero: 0,
          },
        });
        setInventoryLevels(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load inventory levels", err);
        setStatus({ type: "error", message: t("inventory.transferPage.errors.loadLevels") });
        setInventoryLevels([]);
      } finally {
        setLevelsLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    setSearchTerm("");
    setCurrentProduct(null);
    setCurrentQuantity("");
    setCurrentSerials("");
    setCurrentLotId("");
    setCurrentLotList([]);
    setStagedItems([]);
    if (fromWarehouse) {
      loadInventoryLevels(fromWarehouse);
    } else {
      setInventoryLevels([]);
    }
  }, [fromWarehouse, loadInventoryLevels]);

  useEffect(() => {
    if (!currentProduct) {
      setCurrentLotList([]);
      setCurrentLotId("");
      return;
    }
    const usesLots = Number(currentProduct.UsesLots || 0) === 1;
    if (!usesLots) {
      setCurrentLotList([]);
      setCurrentLotId("");
      return;
    }
    if (!fromWarehouse) {
      setCurrentLotList([]);
      setCurrentLotId("");
      return;
    }
    let cancelled = false;
    const fetchLots = async () => {
      setCurrentLotLoading(true);
      try {
        const { data } = await api.get("/api/product-lots", {
          params: {
            productId: currentProduct.ProductID,
            warehouseId: fromWarehouse,
            includeZero: 1,
          },
        });
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setCurrentLotList(list);
        if (list.length) {
          const preferred = list.find((lot) => Number(lot.Quantity || 0) > 0) || list[0];
          setCurrentLotId(String(preferred.ProductLotID));
        } else {
          setCurrentLotId("");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load product lots", err);
        setCurrentError(t("inventory.transferPage.errors.loadLots"));
        setCurrentLotList([]);
        setCurrentLotId("");
      } finally {
        if (!cancelled) {
          setCurrentLotLoading(false);
        }
      }
    };
    fetchLots();
    return () => {
      cancelled = true;
    };
  }, [currentProduct, fromWarehouse, t]);

  const aggregatedProducts = useMemo(() => {
    if (!inventoryLevels.length) return [];
    const map = new Map();
    inventoryLevels.forEach((row) => {
      const key = row.ProductID;
      const existing = map.get(key);
      const available = Math.max(
        0,
        Number(row.AvailableQuantity || row.StockQuantity || 0)
      );
      if (!existing) {
        map.set(key, {
          ProductID: row.ProductID,
          ProductName: row.ProductName,
          SKU: row.SKU,
          UsesLots: row.UsesLots,
          UsesSerials: row.UsesSerials,
          AvailableQuantity: available,
        });
      } else {
        existing.AvailableQuantity += available;
      }
    });
    return Array.from(map.values());
  }, [inventoryLevels]);

  const filteredResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length < SEARCH_MIN_LENGTH) return [];
    return aggregatedProducts
      .filter((product) => {
        const name = (product.ProductName || "").toLowerCase();
        const sku = (product.SKU || "").toLowerCase();
        return name.includes(term) || sku.includes(term);
      })
      .filter((product) => Number(product.AvailableQuantity || 0) > 0)
      .slice(0, 25);
  }, [aggregatedProducts, searchTerm]);

  const destinationWarehouses = useMemo(() => {
    return warehouses.filter(
      (w) => String(w.WarehouseID) !== String(fromWarehouse || "")
    );
  }, [warehouses, fromWarehouse]);

  const openAddDialog = (product) => {
    if (!fromWarehouse) {
      setStatus({ type: "error", message: t("inventory.transferPage.errors.fromRequired") });
      return;
    }
    setCurrentProduct(product);
    setCurrentQuantity("");
    setCurrentSerials("");
    setCurrentLotId("");
    setCurrentLotList([]);
    setCurrentError("");
  };

  const closeAddDialog = () => {
    setCurrentProduct(null);
    setCurrentQuantity("");
    setCurrentSerials("");
    setCurrentLotId("");
    setCurrentLotList([]);
    setCurrentError("");
  };

  const handleConfirmItem = () => {
    if (!currentProduct) return;
    const usesLots = Number(currentProduct.UsesLots || 0) === 1;
    const usesSerials = Number(currentProduct.UsesSerials || 0) === 1;
    const available = Number(currentProduct.AvailableQuantity || 0);

    if (usesLots) {
      if (!currentLotId) {
        setCurrentError(t("inventory.transferPage.errors.lotRequired"));
        return;
      }
      const lot = currentLotList.find(
        (item) => String(item.ProductLotID) === String(currentLotId)
      );
      const lotQty = Number(lot?.Quantity || 0);
      const qty = normalizeNumber(currentQuantity);
      if (qty === null || qty <= 0) {
        setCurrentError(t("inventory.transferPage.errors.quantityInvalid"));
        return;
      }
      if (qty > lotQty) {
        setCurrentError(t("inventory.transferPage.errors.quantityExceeded"));
        return;
      }
      const item = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        productId: currentProduct.ProductID,
        productName: currentProduct.ProductName,
        sku: currentProduct.SKU,
        quantity: qty,
        usesLots: true,
        usesSerials: false,
        lotId: Number(currentLotId),
        lotNumber: lot?.LotNumber || "",
        lotExpiration: lot?.ExpirationDate || null,
        serials: [],
      };
      setStagedItems((prev) => [...prev, item]);
      closeAddDialog();
      return;
    }

    if (usesSerials) {
      const serialLines = currentSerials
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!serialLines.length) {
        setCurrentError(t("inventory.transferPage.errors.serialsRequired"));
        return;
      }
      const seen = new Set();
      const uniqueSerials = [];
      serialLines.forEach((serial) => {
        const key = serial.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSerials.push(serial);
        }
      });
      const qty = uniqueSerials.length;
      if (qty > available) {
        setCurrentError(t("inventory.transferPage.errors.quantityExceeded"));
        return;
      }
      const item = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        productId: currentProduct.ProductID,
        productName: currentProduct.ProductName,
        sku: currentProduct.SKU,
        quantity: qty,
        usesLots: false,
        usesSerials: true,
        lotId: null,
        lotNumber: null,
        lotExpiration: null,
        serials: uniqueSerials,
      };
      setStagedItems((prev) => [...prev, item]);
      closeAddDialog();
      return;
    }

    const qty = normalizeNumber(currentQuantity);
    if (qty === null || qty <= 0) {
      setCurrentError(t("inventory.transferPage.errors.quantityInvalid"));
      return;
    }
    if (qty > available) {
      setCurrentError(t("inventory.transferPage.errors.quantityExceeded"));
      return;
    }
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      productId: currentProduct.ProductID,
      productName: currentProduct.ProductName,
      sku: currentProduct.SKU,
      quantity: qty,
      usesLots: false,
      usesSerials: false,
      lotId: null,
      lotNumber: null,
      lotExpiration: null,
      serials: [],
    };
    setStagedItems((prev) => [...prev, item]);
    closeAddDialog();
  };

  const handleRemoveItem = (id) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleApproveTransfer = async () => {
    if (!fromWarehouse) {
      setStatus({ type: "error", message: t("inventory.transferPage.errors.fromRequired") });
      return;
    }
    if (!toWarehouse) {
      setStatus({ type: "error", message: t("inventory.transferPage.errors.toRequired") });
      return;
    }
    if (fromWarehouse === toWarehouse) {
      setStatus({ type: "error", message: t("inventory.transferPage.errors.sameWarehouse") });
      return;
    }
    if (!stagedItems.length) {
      setStatus({ type: "error", message: t("inventory.transferPage.errors.noItems") });
      return;
    }

    setApproving(true);
    setStatus({ type: "", message: "" });

    try {
      for (const item of stagedItems) {
        const payload = {
          ProductID: item.productId,
          FromWarehouseID: Number(fromWarehouse),
          ToWarehouseID: Number(toWarehouse),
          Quantity: item.quantity,
        };
        if (item.usesLots && item.lotId) {
          payload.ProductLotID = item.lotId;
        }
        const reasonParts = [];
        const note = overallNote.trim();
        if (note) reasonParts.push(note);
        if (item.usesLots && item.lotNumber) {
          reasonParts.push(`Lot ${item.lotNumber}`);
        }
        if (item.usesSerials && item.serials.length) {
          reasonParts.push(`Serials: ${item.serials.join(", ")}`);
        }
        if (reasonParts.length) {
          payload.Reason = reasonParts.join(" | ");
        }
        await api.post("/api/inventory/transfer", payload);
      }
      setStatus({ type: "success", message: t("inventory.transferPage.success") });
      setStagedItems([]);
      setOverallNote("");
      setSearchTerm("");
      await loadInventoryLevels(fromWarehouse);
    } catch (err) {
      console.error("Failed to approve inventory transfer", err);
      const message = err?.response?.data?.error || t("inventory.transferPage.error");
      setStatus({ type: "error", message });
    } finally {
      setApproving(false);
    }
  };

  const currentAvailable = () => {
    if (!currentProduct) return 0;
    if (Number(currentProduct.UsesLots || 0) === 1) {
      const lot = currentLotList.find(
        (item) => String(item.ProductLotID) === String(currentLotId)
      );
      return Number(lot?.Quantity || 0);
    }
    if (Number(currentProduct.UsesSerials || 0) === 1) {
      return Number(currentProduct.AvailableQuantity || 0);
    }
    return Number(currentProduct.AvailableQuantity || 0);
  };

  return (
    <div className="page wide inventory-transfer-page">
      <header className="list-header">
        <div>
          <h2>{t("inventory.transferPage.title")}</h2>
          <p className="muted">
            {t("inventory.transferPage.description")}
          </p>
        </div>
        <div className="inventory-actions">
          <button className="btn ghost" onClick={() => navigate("/inventory")}>
            {t("inventory.transferPage.back")}
          </button>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}
      {warehousesError && <p className="status error">{warehousesError}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid three" style={{ gap: 16 }}>
          <label>
            {t("inventory.transferPage.fromLabel")}
            <select
              value={fromWarehouse}
              onChange={(e) => setFromWarehouse(e.target.value)}
              disabled={warehousesLoading}
            >
              <option value="">{t("inventory.transferPage.selectPlaceholder")}</option>
              {warehouses.map((w) => (
                <option key={w.WarehouseID} value={w.WarehouseID}>
                  {w.WarehouseName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("inventory.transferPage.toLabel")}
            <select
              value={toWarehouse}
              onChange={(e) => setToWarehouse(e.target.value)}
              disabled={warehousesLoading}
            >
              <option value="">{t("inventory.transferPage.selectPlaceholder")}</option>
              {destinationWarehouses.map((w) => (
                <option key={w.WarehouseID} value={w.WarehouseID}>
                  {w.WarehouseName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("inventory.transferPage.noteLabel")}
            <input
              value={overallNote}
              onChange={(e) => setOverallNote(e.target.value)}
              placeholder={t("inventory.transferPage.notePlaceholder")}
            />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="inventory-toolbar" style={{ marginBottom: 12 }}>
          <div className="inventory-search">
            <span role="img" aria-hidden="true">
              🔍
            </span>
            <input
              placeholder={t("inventory.transferPage.searchPlaceholder")}
              aria-label={t("inventory.transferPage.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!fromWarehouse || levelsLoading}
            />
          </div>
          <span className="muted small">
            {t("inventory.transferPage.searchHint")}
          </span>
        </div>
        {!fromWarehouse ? (
          <p className="muted small">
            {t("inventory.transferPage.errors.searchSource")}
          </p>
        ) : levelsLoading ? (
          <p className="muted small">{t("inventory.transferPage.loadingLevels")}</p>
        ) : searchTerm.trim().length < SEARCH_MIN_LENGTH ? (
          <p className="muted small">{t("inventory.transferPage.typeMore")}</p>
        ) : filteredResults.length === 0 ? (
          <p className="muted small">{t("inventory.transferPage.noResults")}</p>
        ) : (
          <ul className="list">
            {filteredResults.map((product) => (
              <li key={product.ProductID} className="list-row">
                <div className="stack">
                  <span className="entity-name">{product.ProductName}</span>
                  <span className="muted small">
                    {product.SKU || t("inventory.transferPage.noSku")}
                    {` · ${t("inventory.transferPage.available", {
                      value: Number(product.AvailableQuantity || 0),
                    })}`}
                  </span>
                </div>
                <div className="list-actions inline">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => openAddDialog(product)}
                  >
                    {t("inventory.transferPage.openDialog")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="list-row" style={{ justifyContent: "space-between" }}>
          <strong>
            {t("inventory.transferPage.stagedHeading", { count: stagedItems.length })}
          </strong>
          {stagedItems.length > 0 && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => setStagedItems([])}
              disabled={approving}
            >
              {t("inventory.transferPage.clearList")}
            </button>
          )}
        </div>
        {stagedItems.length === 0 ? (
          <p className="muted small">{t("inventory.transferPage.stagedEmpty")}</p>
        ) : (
          <ul className="list">
            {stagedItems.map((item) => (
              <li key={item.id} className="list-row">
                <div className="stack">
                  <span className="entity-name">{item.productName}</span>
                  <span className="muted small">
                    {item.sku || t("inventory.transferPage.noSku")}
                    {` · ${t("inventory.transferPage.quantityLabelShort", {
                      quantity: item.quantity,
                    })}`}
                    {item.usesLots && item.lotNumber
                      ? ` · ${t("inventory.transferPage.stagedLotSuffix", {
                          lot: item.lotNumber,
                        })}`
                      : ""}
                    {item.usesSerials && item.serials.length
                      ? ` · ${t("inventory.transferPage.stagedSerialSuffix", {
                          count: item.serials.length,
                        })}`
                      : ""}
                  </span>
                  {item.usesLots && item.lotExpiration ? (
                    <span className="muted small">
                      {t("inventory.transferPage.expiration", {
                        value: formatDate(item.lotExpiration),
                      })}
                    </span>
                  ) : null}
                </div>
                <div className="list-actions inline">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={approving}
                  >
                    {t("inventory.transferPage.remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="actions">
        <button
          className="btn primary"
          onClick={handleApproveTransfer}
          disabled={approving || !stagedItems.length}
        >
          {approving
            ? t("inventory.transferPage.approving")
            : t("inventory.transferPage.approve")}
        </button>
      </div>

      {currentProduct && (
        <div className="modal">
          <div className="modal-content" style={{ width: "min(96%, 520px)" }}>
            <h3>{t("inventory.transferPage.dialogTitle")}</h3>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="stack">
                <strong>{currentProduct.ProductName}</strong>
                <span className="muted small">{currentProduct.SKU}</span>
                <span className="muted small">
                  {t("inventory.transferPage.dialogAvailable", {
                    value: currentAvailable(),
                  })}
                </span>
              </div>
            </div>

            {Number(currentProduct.UsesLots || 0) === 1 ? (
              <>
                <label>
                  {t("inventory.transferPage.dialogLot")}
                  <select
                    value={currentLotId}
                    onChange={(e) => {
                      setCurrentLotId(e.target.value);
                      setCurrentError("");
                    }}
                    disabled={currentLotLoading}
                  >
                    <option value="">
                      {t("inventory.transferPage.dialogLotPlaceholder")}
                    </option>
                    {currentLotList.map((lot) => (
                      <option key={lot.ProductLotID} value={lot.ProductLotID}>
                        {`${lot.LotNumber || t("inventory.transferPage.noLot")}`}
                        {` · ${t("inventory.transferPage.dialogLotInfo", {
                          quantity: Number(lot.Quantity || 0),
                          date: formatDate(lot.ExpirationDate) || t("inventory.transferPage.noExpiration"),
                        })}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("inventory.transferPage.dialogQuantity")}
                  <input
                    type="number"
                    min="0"
                    value={currentQuantity}
                    onChange={(e) => {
                      setCurrentQuantity(e.target.value);
                      setCurrentError("");
                    }}
                  />
                </label>
              </>
            ) : Number(currentProduct.UsesSerials || 0) === 1 ? (
              <label>
                {t("inventory.transferPage.dialogSerials")}
                <textarea
                  rows={4}
                  value={currentSerials}
                  onChange={(e) => {
                    setCurrentSerials(e.target.value);
                    setCurrentError("");
                  }}
                  placeholder={t("inventory.transferPage.dialogSerialsPlaceholder")}
                />
              </label>
            ) : (
              <label>
                {t("inventory.transferPage.dialogQuantity")}
                <input
                  type="number"
                  min="0"
                  value={currentQuantity}
                  onChange={(e) => {
                    setCurrentQuantity(e.target.value);
                    setCurrentError("");
                  }}
                />
              </label>
            )}

            {currentError && <p className="status error">{currentError}</p>}

            <div className="modal-actions">
              <button className="btn ghost" onClick={closeAddDialog}>
                {t("common.cancel")}
              </button>
              <button
                className="btn primary"
                onClick={handleConfirmItem}
                disabled={currentLotLoading}
              >
                {t("inventory.transferPage.dialogAdd")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
