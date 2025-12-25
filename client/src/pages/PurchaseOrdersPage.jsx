import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

const generatePoNumber = () => `PO-${Date.now().toString().slice(-6)}`;

export default function PurchaseOrdersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(0);
  const resultRefs = useRef([]);
  const [receiveModal, setReceiveModal] = useState({
    open: false,
    receiptNumber: "",
    guiaNumber: "",
    date: "",
    warehouseId: "",
    items: [],
    submitting: false,
    error: "",
  });
  const [form, setForm] = useState({
    SupplierID: "",
    PurchaseOrderNumber: generatePoNumber(),
    OrderDate: "",
    ExpectedDeliveryDate: "",
    Notes: "",
    Items: [],
  });

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/purchase-orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to load purchase orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [supRes, prodRes, whRes] = await Promise.all([
          api.get("/api/suppliers"),
          api.get("/api/products"),
          api.get("/api/warehouses"),
        ]);
        setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
        setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
      } catch (err) {
        // soft fail; form will still work with manual entry
      }
    };
    loadMeta();
  }, []);

  const selectOrder = async (id) => {
    setSelectedId(id);
    setDetail(null);
    if (!id) return;
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/api/purchase-orders/${id}`);
      setDetail(data || null);
    } catch (err) {
      setError("Failed to load purchase order details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const openReceiveModal = () => {
    if (!detail) return;
    const items =
      detail.items?.map((it) => ({
        PurchaseOrderItemID: it.PurchaseOrderItemID,
        ProductID: it.ProductID,
        ProductName: it.ProductName,
        Remaining: Math.max(0, Number(it.Quantity || 0) - Number(it.ReceivedQuantity || 0)),
        QuantityReceived: Math.max(0, Number(it.Quantity || 0) - Number(it.ReceivedQuantity || 0)),
        UnitPrice: Number(it.UnitPrice || 0),
        UsesLots: Number(it.UsesLots || 0),
        UsesSerials: Number(it.UsesSerials || 0),
      })) || [];
    setReceiveModal((prev) => ({
      ...prev,
      open: true,
      receiptNumber: "",
      guiaNumber: "",
      date: new Date().toISOString().slice(0, 10),
      warehouseId: warehouses[0]?.WarehouseID || "",
      items,
      error: "",
    }));
  };

  const submitReceive = async (e) => {
    e.preventDefault();
    if (receiveModal.submitting || !detail?.header) return;
    const items = (receiveModal.items || []).filter((it) => Number(it.QuantityReceived) > 0);
    if (!items.length) {
      setReceiveModal((prev) => ({ ...prev, error: "Enter a received qty for at least one line." }));
      return;
    }
    if (!receiveModal.receiptNumber.trim()) {
      setReceiveModal((prev) => ({ ...prev, error: "Receipt/Factura number is required." }));
      return;
    }
    if (!receiveModal.warehouseId) {
      setReceiveModal((prev) => ({ ...prev, error: "Select a warehouse." }));
      return;
    }
    setReceiveModal((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      await api.post("/api/goods-receipts", {
        SupplierID: detail.header.SupplierID,
        PurchaseOrderID: detail.header.PurchaseOrderID,
        ReceiptNumber: receiveModal.receiptNumber,
        SupplierGuiaDespachoNumber: receiveModal.guiaNumber || null,
        ReceiptDate: receiveModal.date || null,
        WarehouseID: receiveModal.warehouseId,
        Items: items.map((it) => ({
          PurchaseOrderItemID: it.PurchaseOrderItemID,
          ProductID: it.ProductID,
          QuantityReceived: Number(it.QuantityReceived),
          UnitPrice: Number(it.UnitPrice || 0),
        })),
      });
      setReceiveModal((prev) => ({ ...prev, open: false, submitting: false }));
      await selectOrder(detail.header.PurchaseOrderID);
      await loadOrders();
    } catch (err) {
      const msg =
        err.response?.data?.error || err.message || "Failed to receive goods.";
      setReceiveModal((prev) => ({ ...prev, error: msg, submitting: false }));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!form.SupplierID) {
      setCreateError("Supplier is required.");
      return;
    }
    if (!form.PurchaseOrderNumber) {
      setCreateError("PO number is required.");
      return;
    }
    const items = (form.Items || []).filter(
      (it) => it.ProductID && Number(it.Quantity) > 0
    );
    if (!items.length) {
      setCreateError("Add at least one item with quantity.");
      return;
    }
    const tracked = items
      .map((it) => {
        const prod = products.find((p) => Number(p.ProductID) === Number(it.ProductID));
        return { it, prod };
      })
      .filter(({ prod }) => Number(prod?.UsesLots || 0) === 1 || Number(prod?.UsesSerials || 0) === 1);

    if (
      tracked.length > 0 &&
      !window.confirm(
        "Some items use lots/serials. You'll need to capture lot/serial numbers when receiving. Continue?"
      )
    ) {
      return;
    }
    setCreating(true);
    try {
      const payload = {
        SupplierID: Number(form.SupplierID),
        PurchaseOrderNumber: form.PurchaseOrderNumber,
        OrderDate: form.OrderDate || null,
        ExpectedDeliveryDate: form.ExpectedDeliveryDate || null,
        Notes: form.Notes || null,
        Items: items.map((it) => ({
          ProductID: Number(it.ProductID),
          Quantity: Number(it.Quantity),
          UnitPrice: Number(it.UnitPrice || 0),
          TaxAmount: Number(it.TaxAmount || 0),
          Description:
            products.find((p) => Number(p.ProductID) === Number(it.ProductID))
              ?.ProductName || "",
        })),
      };
      const { data } = await api.post("/api/purchase-orders", payload);
      await loadOrders();
      setForm({
        SupplierID: "",
        PurchaseOrderNumber: generatePoNumber(),
        OrderDate: "",
        ExpectedDeliveryDate: "",
        Notes: "",
        Items: [],
      });
      if (data?.header?.PurchaseOrderID) {
        selectOrder(data.header.PurchaseOrderID);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        "Failed to create purchase order.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const statusLabel = useMemo(
    () => ({
      Draft: "Draft",
      Submitted: "Submitted",
      Approved: "Approved",
      PartiallyReceived: "Partially received",
      Received: "Received",
      Cancelled: "Cancelled",
    }),
    []
  );

  const addItemFromProduct = (product) => {
    if (!product) return;
    const productId = product.ProductID || product.id;
    const defaultPrice =
      product.SellingPrice || product.Price || product.UnitPrice || 0;
    setForm((prev) => {
      const existingIdx = prev.Items.findIndex(
        (it) => Number(it.ProductID) === Number(productId)
      );
      if (existingIdx >= 0) {
        const copy = [...prev.Items];
        const currentQty = Number(copy[existingIdx].Quantity || 0);
        copy[existingIdx] = {
          ...copy[existingIdx],
          Quantity: currentQty + 1,
          // keep existing price/tax if already set
        };
        return { ...prev, Items: copy };
      }
      return {
        ...prev,
        Items: [
          ...prev.Items,
          {
            ProductID: productId,
            Quantity: 1,
            UnitPrice: Number(defaultPrice) || 0,
            TaxAmount: 0,
          },
        ],
      };
    });
    setSearchTerm("");
    setSearchOpen(false);
  };

  const getProductName = (p) =>
    p?.ProductName || p?.Name || p?.productName || p?.name || "";

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, 10);
    const term = searchTerm.toLowerCase();
    return products
      .filter((p) => {
        const name = getProductName(p).toLowerCase();
        const sku =
          (p.SKU || p.Sku || p.sku || p.Barcode || p.barcode || "").toLowerCase();
        return name.includes(term) || sku.includes(term);
      })
      .slice(0, 10);
  }, [products, searchTerm]);

  useEffect(() => {
    setSearchHighlight(0);
    resultRefs.current = [];
  }, [searchTerm, filteredProducts.length]);

  useEffect(() => {
    const el = resultRefs.current[searchHighlight];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [searchHighlight]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="muted small">Purchases</p>
          <h2>Purchase orders</h2>
          <p className="muted small">
            View and create purchase orders. Receiving and invoices will come next.
          </p>
        </div>
      </div>

      {error && <p className="status error">{error}</p>}

      <div className="card" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <div>
          <div className="list-head">
            <strong>Recent purchase orders</strong>
            {loading && <span className="muted small">Loading...</span>}
          </div>
          <div className="table">
            <div className="table-head" style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1fr" }}>
              <span>PO #</span>
              <span>Supplier</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Total</span>
            </div>
            {(orders || []).map((po) => (
              <button
                key={po.PurchaseOrderID}
                className={`table-row ${selectedId === po.PurchaseOrderID ? "active" : ""}`}
                style={{ gridTemplateColumns: "1.6fr 1fr 1fr 1fr" }}
                onClick={() => selectOrder(po.PurchaseOrderID)}
              >
                <span>{po.PurchaseOrderNumber}</span>
                <span className="muted small">{po.SupplierName || "-"}</span>
                <span className="badge">{statusLabel[po.Status] || po.Status || "-"}</span>
                <span style={{ textAlign: "right" }}>
                  {currencyFormatter.format(po.TotalAmount || 0)}
                </span>
              </button>
            ))}
            {!loading && (!orders || orders.length === 0) && (
              <div className="table-row muted">No purchase orders yet.</div>
            )}
          </div>
        </div>

        <div className="card soft" style={{ minHeight: 260 }}>
          {!selectedId && <p className="muted">Select a purchase order to view details.</p>}
          {detailLoading && <p className="muted">Loading details...</p>}
          {detail && (
            <div className="stack" style={{ gap: 8 }}>
              <div>
                <p className="muted small">PO Number</p>
                <strong>{detail.header?.PurchaseOrderNumber}</strong>
              </div>
              <div className="grid two-col gap">
                <div>
                  <p className="muted small">Supplier</p>
                  <strong>{detail.header?.SupplierName || "-"}</strong>
                </div>
                <div>
                  <p className="muted small">Status</p>
                  <strong>{statusLabel[detail.header?.Status] || detail.header?.Status}</strong>
                </div>
              </div>
              <div>
                <p className="muted small">Expected</p>
                <strong>{detail.header?.ExpectedDeliveryDate || "-"}</strong>
              </div>
              <div>
                <p className="muted small">Items</p>
                <ul className="list">
                  {(detail.items || []).map((it) => (
                    <li key={it.PurchaseOrderItemID} className="list-row">
                      <div className="stack">
                        <span className="entity-name">{it.ProductName || it.Description}</span>
                        <span className="muted small">
                          Qty {it.Quantity} @ {currencyFormatter.format(it.UnitPrice || 0)} | Received{" "}
                          {Number(it.ReceivedQuantity || 0)}
                        </span>
                      </div>
                      <span className="muted small">
                        {currencyFormatter.format(it.LineTotal || it.Quantity * it.UnitPrice || 0)}
                      </span>
                    </li>
                  ))}
                  {(!detail.items || detail.items.length === 0) && (
                    <li className="list-row muted small">No items found.</li>
                  )}
                </ul>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <div>
                  <p className="muted small">Total</p>
                  <strong>{currencyFormatter.format(detail.header?.TotalAmount || 0)}</strong>
                </div>
                <button
                  type="button"
                  className="btn primary"
                  onClick={openReceiveModal}
                  disabled={detail.header?.Status === "Received" || detail.items?.every?.((it) => Number(it.ReceivedQuantity || 0) >= Number(it.Quantity || 0))}
                >
                  Receive
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {receiveModal.open && (
        <div className="modal">
          <div className="modal-content">
            <h3>Receive against PO</h3>
            <form onSubmit={submitReceive} className="form">
              <div className="grid two-col gap">
                <label>
                  Receipt/Factura number
                  <input
                    value={receiveModal.receiptNumber}
                    onChange={(e) =>
                      setReceiveModal((prev) => ({ ...prev, receiptNumber: e.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Guia number (optional)
                  <input
                    value={receiveModal.guiaNumber}
                    onChange={(e) =>
                      setReceiveModal((prev) => ({ ...prev, guiaNumber: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="grid two-col gap">
                <label>
                  Date
                  <input
                    type="date"
                    value={receiveModal.date}
                    onChange={(e) =>
                      setReceiveModal((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Warehouse
                  <select
                    value={receiveModal.warehouseId}
                    onChange={(e) =>
                      setReceiveModal((prev) => ({ ...prev, warehouseId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.WarehouseID} value={w.WarehouseID}>
                        {w.WarehouseName || w.Name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="muted small">Lines</div>
              <div className="list" style={{ maxHeight: 300, overflowY: "auto" }}>
                {receiveModal.items.map((it, idx) => (
                  <div key={it.PurchaseOrderItemID} className="list-row" style={{ gap: 8 }}>
                    <div className="stack">
                      <strong>{it.ProductName}</strong>
                      <span className="muted small">
                        Remaining {it.Remaining}
                        {it.UsesLots ? " • Uses lots" : ""}
                        {it.UsesSerials ? " • Uses serials" : ""}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.QuantityReceived}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReceiveModal((prev) => {
                          const copy = [...prev.items];
                          copy[idx] = { ...copy[idx], QuantityReceived: val };
                          return { ...prev, items: copy };
                        });
                      }}
                      style={{ width: 110 }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.UnitPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReceiveModal((prev) => {
                          const copy = [...prev.items];
                          copy[idx] = { ...copy[idx], UnitPrice: val };
                          return { ...prev, items: copy };
                        });
                      }}
                      style={{ width: 110 }}
                      placeholder="Unit cost"
                    />
                  </div>
                ))}
                {receiveModal.items.length === 0 && (
                  <div className="list-row muted small">No lines to receive.</div>
                )}
              </div>

              {receiveModal.error && <p className="status error">{receiveModal.error}</p>}

              <div className="form-actions" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setReceiveModal((prev) => ({ ...prev, open: false, error: "" }))}
                  disabled={receiveModal.submitting}
                >
                  Cancel
                </button>
                <button className="btn primary" type="submit" disabled={receiveModal.submitting}>
                  {receiveModal.submitting ? "Receiving..." : "Receive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Create purchase order</h3>
        {createError && <p className="status error">{createError}</p>}
        <form className="form" onSubmit={handleCreate}>
          <div className="grid three-col gap">
            <label>
              Supplier
              <select
                value={form.SupplierID}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, SupplierID: e.target.value }))
                }
                required
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.SupplierID} value={s.SupplierID}>
                    {s.SupplierName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              PO number
              <input
                value={form.PurchaseOrderNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, PurchaseOrderNumber: e.target.value }))
                }
                required
              />
            </label>
            <label>
              Expected date
              <input
                type="date"
                value={form.ExpectedDeliveryDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ExpectedDeliveryDate: e.target.value }))
                }
              />
            </label>
          </div>
          <label>
            Notes
            <textarea
              value={form.Notes}
              onChange={(e) => setForm((prev) => ({ ...prev, Notes: e.target.value }))}
              rows={2}
            />
          </label>

          <div className="stack" style={{ gap: 6, marginTop: 8 }}>
            <div className="input-with-dropdown" style={{ position: "relative", display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  value={searchTerm}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSearchOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (!filteredProducts.length) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSearchHighlight((prev) =>
                        Math.min(prev + 1, filteredProducts.length - 1)
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSearchHighlight((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const pick = filteredProducts[searchHighlight];
                      if (pick) addItemFromProduct(pick);
                    } else if (e.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                  placeholder="Search product to add (catalog only)"
                />
                {searchOpen && filteredProducts.length > 0 && (
                  <ul
                    className="dropdown"
                    style={{ maxHeight: 220, overflowY: "auto", zIndex: 5 }}
                  >
                    {filteredProducts.map((p, idx) => (
                      <li
                        key={p.ProductID}
                        ref={(el) => (resultRefs.current[idx] = el)}
                        className={idx === searchHighlight ? "active" : ""}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addItemFromProduct(p);
                        }}
                        onMouseEnter={() => setSearchHighlight(idx)}
                      >
                        <span>{getProductName(p)}</span>
                        <span className="muted small">{p.SKU || p.Barcode || ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate("/products/new")}
                title="Create product before adding to PO"
              >
                + Product
              </button>
            </div>

            <div className="list" style={{ marginBottom: 8 }}>
              {form.Items.map((it, idx) => {
                const prod = products.find((p) => Number(p.ProductID) === Number(it.ProductID));
                return (
                  <div key={idx} className="list-row" style={{ gap: 8 }}>
                    <div className="stack">
                      <strong>{getProductName(prod) || "Product"}</strong>
                      <span className="muted small">
                        {prod?.SKU || prod?.Barcode || ""} #{it.ProductID}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.Quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => {
                          const copy = [...prev.Items];
                          copy[idx] = { ...copy[idx], Quantity: val };
                          return { ...prev, Items: copy };
                        });
                      }}
                      style={{ width: 90 }}
                      placeholder="Qty"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.UnitPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => {
                          const copy = [...prev.Items];
                          copy[idx] = { ...copy[idx], UnitPrice: val };
                          return { ...prev, Items: copy };
                        });
                      }}
                      style={{ width: 110 }}
                      placeholder="Unit price"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.TaxAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((prev) => {
                          const copy = [...prev.Items];
                          copy[idx] = { ...copy[idx], TaxAmount: val };
                          return { ...prev, Items: copy };
                        });
                      }}
                      style={{ width: 110 }}
                      placeholder="Tax"
                    />
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          Items: prev.Items.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              {form.Items.length === 0 && (
                <div className="list-row muted small">Add products using the search above.</div>
              )}
            </div>
          </div>

          <div className="form-actions" style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn primary" type="submit" disabled={creating}>
              {creating ? "Saving..." : "Save PO"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
