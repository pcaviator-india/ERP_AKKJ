import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
const resolveImg = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function PriceListsPage() {
  const { t } = useLanguage();
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [search, setSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [newItem, setNewItem] = useState({ productId: "", minQty: 1, price: "" });
  const [highlighted, setHighlighted] = useState(-1);
  const itemRefs = useRef([]);
  const [editingKey, setEditingKey] = useState(null);

  useEffect(() => {
    document.title = t("priceLists.title");
  }, [t]);

  const loadLists = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/price-lists");
      const data = Array.isArray(res.data) ? res.data : [];
      setLists(data);
      if (!activeListId && data.length) {
        setActiveListId(String(data[0].PriceListID));
      }
    } catch (err) {
      console.error("Failed to load price lists", err);
      setStatus({ type: "error", message: t("priceLists.loadError") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    const loadItems = async () => {
      if (!activeListId) {
        setItems([]);
        return;
      }
      try {
        const res = await api.get(`/api/price-lists/${activeListId}/items`);
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load items", err);
        setStatus({ type: "error", message: t("priceLists.loadItemsError") });
      }
    };
    loadItems();
  }, [activeListId, t]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (search.trim().length < 2) {
        setProductResults([]);
        setHighlighted(-1);
        return;
      }
      try {
        const res = await api.get("/api/products", { params: { q: search.trim(), type: "active" } });
        setProductResults(Array.isArray(res.data) ? res.data.slice(0, 20) : []);
        setHighlighted(-1);
      } catch (err) {
        console.error("Product search failed", err);
      }
    };
    const timer = setTimeout(fetchProducts, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const createList = async () => {
    if (!newListName.trim()) return;
    setStatus({ type: "", message: "" });
    try {
      const res = await api.post("/api/price-lists", { Name: newListName.trim() });
      setNewListName("");
      await loadLists();
      setActiveListId(String(res.data.PriceListID));
      setStatus({ type: "success", message: t("priceLists.created") });
    } catch (err) {
      console.error("Failed to create list", err);
      setStatus({ type: "error", message: t("priceLists.createError") });
    }
  };

  useEffect(() => {
    itemRefs.current = [];
  }, [productResults]);

  useEffect(() => {
    if (highlighted >= 0 && itemRefs.current[highlighted]) {
      itemRefs.current[highlighted].scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  const addItem = () => {
    if (!newItem.productId || newItem.price === "") return;
    const product = productResults.find((p) => String(p.ProductID) === String(newItem.productId));
    const entry = {
      PriceListItemID: `tmp-${Date.now()}`,
      ProductID: Number(newItem.productId),
      ProductName: product?.ProductName || "",
      SKU: product?.SKU || "",
      PrimaryImageURL: product?.PrimaryImageURL || product?.ImageURL || "",
      MinQty: Number(newItem.minQty || 1),
      Price: Number(newItem.price),
      IsActive: 1,
    };
    setItems((prev) => [...prev, entry]);
    setNewItem({ productId: "", minQty: 1, price: "" });
    setProductResults([]);
    setSearch("");
    setEditingKey(null);
  };

  const saveItems = async () => {
    if (!activeListId) return;
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const payload = items.map((i) => ({
        ProductID: i.ProductID,
        MinQty: i.MinQty,
        Price: i.Price,
        IsActive: i.IsActive,
      }));
      await api.put(`/api/price-lists/${activeListId}/items`, { items: payload });
      setStatus({ type: "success", message: t("priceLists.saveSuccess") });
      const res = await api.get(`/api/price-lists/${activeListId}/items`);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to save items", err);
      setStatus({ type: "error", message: t("priceLists.saveError") });
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(
    () => items.sort((a, b) => (a.ProductName || "").localeCompare(b.ProductName || "")),
    [items]
  );

  const removeItem = (key) => {
    setItems((prev) => prev.filter((i) => `${i.ProductID}-${i.MinQty}-${i.PriceListItemID}` !== key));
  };

  const updateItemField = (key, field, value) => {
    setItems((prev) =>
      prev.map((i) => {
        const rowKey = `${i.ProductID}-${i.MinQty}-${i.PriceListItemID}`;
        if (rowKey !== key) return i;
        return { ...i, [field]: value };
      })
    );
  };

  return (
    <div className="page product-list-page">
      <header className="list-header">
        <div>
          <h2>{t("priceLists.title")}</h2>
          <p className="muted">{t("priceLists.subtitle")}</p>
        </div>
        <div className="list-actions">
          <button className="btn primary" onClick={saveItems} disabled={saving || !activeListId}>
            {saving ? t("priceLists.saving") : t("priceLists.save")}
          </button>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <div className="form-grid two-col gap">
          <label>
            {t("priceLists.newList")}
            <div className="inline-inputs">
              <input value={newListName} onChange={(e) => setNewListName(e.target.value)} />
              <button className="btn secondary" onClick={createList} disabled={!newListName.trim()}>
                {t("priceLists.create")}
              </button>
            </div>
          </label>
          <label>
            {t("priceLists.selectList")}
            <select value={activeListId} onChange={(e) => setActiveListId(e.target.value)} disabled={loading}>
              <option value="">{t("priceLists.choose")}</option>
              {lists.map((l) => (
                <option key={l.PriceListID} value={l.PriceListID}>
                  {l.Name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {activeListId && (
        <div className="card mt-16">
          <h3>{t("priceLists.tiers")}</h3>
          <div className="form-grid three-col gap">
            <label style={{ position: "relative" }}>
              {t("priceLists.product")}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("priceLists.searchProduct")}
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
                      productResults[highlighted >= 0 ? highlighted : productResults.length === 1 ? 0 : 0];
                    if (pick) {
                      setNewItem((prev) => ({ ...prev, productId: pick.ProductID }));
                      setSearch(`${pick.ProductName} (${pick.SKU || ""})`);
                      setProductResults([]);
                      setHighlighted(-1);
                    }
                  } else if (e.key === "Escape") {
                    setProductResults([]);
                    setHighlighted(-1);
                  }
                }}
              />
              {search.trim().length >= 2 && productResults.length > 0 && (
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
                        setNewItem((prev) => ({ ...prev, productId: p.ProductID }));
                        setSearch(`${p.ProductName} (${p.SKU || ""})`);
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
              {t("priceLists.minQty")}
              <input
                type="number"
                min="1"
                value={newItem.minQty}
                onChange={(e) => setNewItem((prev) => ({ ...prev, minQty: e.target.value }))}
              />
            </label>
            <label>
              {t("priceLists.price")}
              <input
                type="number"
                min="0"
                step="0.01"
                value={newItem.price}
                onChange={(e) => setNewItem((prev) => ({ ...prev, price: e.target.value }))}
              />
            </label>
          </div>
          <div className="list-actions mt-12">
            <button className="btn secondary" onClick={addItem} disabled={!newItem.productId || newItem.price === ""}>
              {t("priceLists.addItem")}
            </button>
          </div>

          <div className="table mt-12">
            <div className="table-head" style={{ display: "grid", gridTemplateColumns: "0.8fr 2fr 1fr 1fr 1fr 0.6fr" }}>
              <span>{t("priceLists.image")}</span>
              <span>{t("priceLists.product")}</span>
              <span>{t("priceLists.sku")}</span>
              <span>{t("priceLists.minQty")}</span>
              <span>{t("priceLists.price")}</span>
              <span>{t("priceLists.actions")}</span>
            </div>
            {filteredItems.map((i, idx) => {
              const rowKey = `${i.ProductID}-${i.MinQty}-${i.PriceListItemID}`;
              const isEditing = editingKey === rowKey;
              return (
                <div
                  className="table-row"
                  style={{ display: "grid", gridTemplateColumns: "0.8fr 2fr 1fr 1fr 1fr 0.6fr", alignItems: "center" }}
                  key={rowKey}
                >
                  <div className="inventory-thumb">
                    {i.PrimaryImageURL ? (
                      <img src={resolveImg(i.PrimaryImageURL)} alt={i.ProductName} />
                    ) : (
                      <div className="inventory-thumb-fallback">
                        {(i.ProductName || i.SKU || "").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>{i.ProductName}</div>
                  <div className="muted small">{i.SKU}</div>
                  <div>
                    {isEditing ? (
                      <input
                        type="number"
                        min="1"
                        value={i.MinQty}
                        onChange={(e) => updateItemField(rowKey, "MinQty", Number(e.target.value))}
                      />
                    ) : (
                      i.MinQty
                    )}
                  </div>
                  <div>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={i.Price}
                        onChange={(e) => updateItemField(rowKey, "Price", Number(e.target.value))}
                      />
                    ) : (
                      i.Price
                    )}
                  </div>
                  <div className="list-actions inline" style={{ justifyContent: "flex-end" }}>
                    {isEditing ? (
                      <button className="icon-btn" onClick={() => setEditingKey(null)}>
                        ✓
                      </button>
                    ) : (
                      <button className="icon-btn" onClick={() => setEditingKey(rowKey)}>
                        ✎
                      </button>
                    )}
                    <button className="icon-btn" onClick={() => removeItem(rowKey)}>
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && <p className="muted small mt-8">{t("priceLists.noItems")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
