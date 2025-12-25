import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";
import InvoiceOCRUpload, {
  ExtractedDataReview,
} from "../components/InvoiceOCRUpload";

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

export default function DirectPurchasesPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showOCR, setShowOCR] = useState(false);
  const [extractedOCRData, setExtractedOCRData] = useState(null);
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
    ReceiptNumber: "",
    PurchaseDate: "",
    Notes: "",
    Items: [],
  });
  const [productSearch, setProductSearch] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedProductIdx, setSelectedProductIdx] = useState(-1);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef(null);

  const loadPurchases = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/direct-purchases");
      setPurchases(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to load direct purchases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [supRes, prodRes, whRes, taxRes] = await Promise.all([
          api.get("/api/suppliers"),
          api.get("/api/products"),
          api.get("/api/warehouses"),
          api.get("/api/tax-rates"),
        ]);
        setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
        setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
        setTaxRates(Array.isArray(taxRes.data) ? taxRes.data : []);
      } catch (err) {
        // soft fail
      }
    };
    loadMeta();
  }, []);

  // Handle product search
  useEffect(() => {
    if (productSearch.trim()) {
      const filtered = products.filter((p) =>
        p.ProductName.toLowerCase().includes(productSearch.toLowerCase())
      );
      setFilteredProducts(filtered);
      setSelectedProductIdx(-1);
      setShowProductDropdown(true);
    } else {
      setFilteredProducts([]);
      setShowProductDropdown(false);
    }
  }, [productSearch, products]);

  const addProductToItems = (product) => {
    const defaultRate =
      taxRates.find((r) => r.IsDefault) || taxRates[0] || null;
    const qty = 1;
    const unit = Number(product.CostPrice || product.UnitPrice || 0) || 0;
    const ratePct = defaultRate ? Number(defaultRate.RatePercentage || 0) : 0;
    const taxAmount = (qty * unit * ratePct) / 100;
    const newItems = [
      ...form.Items,
      {
        ProductID: product.ProductID,
        ProductName: product.ProductName,
        Quantity: qty,
        UnitPrice: unit,
        TaxAmount: taxAmount,
        TaxRateID: defaultRate ? defaultRate.TaxRateID : null,
      },
    ];
    setForm({ ...form, Items: newItems });
    setProductSearch("");
    setFilteredProducts([]);
    setShowProductDropdown(false);
    setSelectedProductIdx(-1);
  };

  const handleProductSearchKeydown = (e) => {
    if (!showProductDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedProductIdx((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedProductIdx((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        const productIdx = selectedProductIdx >= 0 ? selectedProductIdx : 0;
        if (filteredProducts[productIdx]) {
          addProductToItems(filteredProducts[productIdx]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowProductDropdown(false);
        setProductSearch("");
        break;
      default:
        break;
    }
  };

  const selectPurchase = async (id) => {
    setSelectedId(id);
    setDetail(null);
    if (!id) return;
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/api/direct-purchases/${id}`);
      setDetail(data || null);
    } catch (err) {
      setError("Failed to load direct purchase details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const openReceiveModal = () => {
    if (!detail) return;
    const items =
      detail.items?.map((it) => ({
        DirectPurchaseItemID: it.DirectPurchaseItemID,
        ProductID: it.ProductID,
        ProductName: it.ProductName,
        Remaining: Math.max(
          0,
          Number(it.Quantity || 0) - Number(it.ReceivedQuantity || 0)
        ),
        QuantityReceived: Math.max(
          0,
          Number(it.Quantity || 0) - Number(it.ReceivedQuantity || 0)
        ),
        UnitPrice: Number(it.UnitPrice || 0),
        UsesLots: Number(it.UsesLots || 0),
        UsesSerials: Number(it.UsesSerials || 0),
      })) || [];
    setReceiveModal((prev) => ({
      ...prev,
      open: true,
      receiptNumber: detail.header.ReceiptNumber || "",
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
    const items = (receiveModal.items || []).filter(
      (it) => Number(it.QuantityReceived) > 0
    );
    if (!items.length) {
      setReceiveModal((prev) => ({
        ...prev,
        error: "Enter a received qty for at least one line.",
      }));
      return;
    }
    if (!receiveModal.receiptNumber.trim()) {
      setReceiveModal((prev) => ({
        ...prev,
        error: "Receipt number is required.",
      }));
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
        DirectPurchaseID: detail.header.DirectPurchaseID,
        ReceiptNumber: receiveModal.receiptNumber,
        SupplierGuiaDespachoNumber: receiveModal.guiaNumber || null,
        ReceiptDate: receiveModal.date || null,
        WarehouseID: receiveModal.warehouseId,
        Items: items.map((it) => ({
          DirectPurchaseItemID: it.DirectPurchaseItemID,
          ProductID: it.ProductID,
          QuantityReceived: Number(it.QuantityReceived),
          UnitPrice: Number(it.UnitPrice || 0),
        })),
      });
      setReceiveModal((prev) => ({ ...prev, open: false, submitting: false }));
      await selectPurchase(detail.header.DirectPurchaseID);
      await loadPurchases();
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
    if (!form.ReceiptNumber) {
      setCreateError("Receipt number is required.");
      return;
    }
    const items = (form.Items || []).filter(
      (it) => it.ProductID && Number(it.Quantity) > 0
    );
    if (!items.length) {
      setCreateError("Add at least one item with quantity.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        SupplierID: Number(form.SupplierID),
        ReceiptNumber: form.ReceiptNumber,
        PurchaseDate: form.PurchaseDate || null,
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
      const { data } = await api.post("/api/direct-purchases", payload);
      await loadPurchases();
      setForm({
        SupplierID: "",
        ReceiptNumber: "",
        PurchaseDate: "",
        Notes: "",
        Items: [],
      });
      if (data?.header?.DirectPurchaseID) {
        selectPurchase(data.header.DirectPurchaseID);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        "Failed to create direct purchase.";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const statusLabel = useMemo(
    () => ({
      Pending: "Pending",
      PartiallyReceived: "Partially received",
      Received: "Received",
      Cancelled: "Cancelled",
    }),
    []
  );

  const statusColor = (status) => {
    const colors = {
      Pending: "#FFA500",
      PartiallyReceived: "#FFD700",
      Received: "#28a745",
      Cancelled: "#dc3545",
    };
    return colors[status] || "#666";
  };

  const filteredPurchases = useMemo(() => {
    if (!searchTerm) return purchases;
    return purchases.filter(
      (p) =>
        p.SupplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.ReceiptNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [purchases, searchTerm]);

  return (
    <div style={styles.container}>
      <h1>Direct Purchases</h1>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.mainGrid}>
        {/* LEFT: Form + List */}
        <div style={styles.leftPanel}>
          {/* OCR Upload Section */}
          {showOCR && (
            <div style={styles.formSection}>
              <button
                onClick={() => {
                  setShowOCR(false);
                  setExtractedOCRData(null);
                }}
                style={{ marginBottom: "10px", ...styles.secondaryBtn }}
              >
                ← Back to Manual Entry
              </button>
              <InvoiceOCRUpload
                onDataExtracted={(data) => {
                  setExtractedOCRData(data);
                  // Auto-fill form from OCR data
                  if (data.supplierRut) {
                    // Try to find supplier by RUT
                    const supplier = suppliers.find(
                      (s) => s.TaxID === data.supplierRut
                    );
                    if (supplier) {
                      setForm({
                        ...form,
                        SupplierID: supplier.SupplierID,
                      });
                    }
                  }
                  if (data.invoiceNumber) {
                    setForm({
                      ...form,
                      ReceiptNumber: data.invoiceNumber,
                    });
                  }
                  if (data.invoiceDate) {
                    setForm({
                      ...form,
                      PurchaseDate: data.invoiceDate,
                    });
                  }
                  if (data.items && data.items.length > 0) {
                    setForm({
                      ...form,
                      Items: data.items.map((item) => ({
                        ProductID: item.ProductID || "",
                        Quantity: item.quantity || 0,
                        UnitPrice: item.unitPrice || 0,
                        TaxAmount: 0,
                      })),
                    });
                  }
                }}
              />
            </div>
          )}

          {/* Create Form */}
          <div style={styles.formSection}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h2>New Direct Purchase</h2>
              {!showOCR && (
                <button
                  onClick={() => setShowOCR(true)}
                  style={{
                    ...styles.secondaryBtn,
                    padding: "8px 15px",
                    fontSize: "13px",
                  }}
                >
                  📸 Upload Invoice Image
                </button>
              )}
            </div>
            {createError && <div style={styles.error}>{createError}</div>}
            <form onSubmit={handleCreate}>
              <div style={styles.formRow}>
                <label>
                  Supplier:
                  <select
                    value={form.SupplierID}
                    onChange={(e) =>
                      setForm({ ...form, SupplierID: e.target.value })
                    }
                    style={styles.input}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.SupplierID} value={s.SupplierID}>
                        {s.SupplierName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={styles.formRow}>
                <label>
                  Receipt Number (Supplier Invoice#):
                  <input
                    type="text"
                    value={form.ReceiptNumber}
                    onChange={(e) =>
                      setForm({ ...form, ReceiptNumber: e.target.value })
                    }
                    style={styles.input}
                  />
                </label>
              </div>

              <div style={styles.formRow}>
                <label>
                  Purchase Date:
                  <input
                    type="date"
                    value={form.PurchaseDate}
                    onChange={(e) =>
                      setForm({ ...form, PurchaseDate: e.target.value })
                    }
                    style={styles.input}
                  />
                </label>
              </div>

              <div style={styles.formRow}>
                <label>
                  Notes:
                  <textarea
                    value={form.Notes}
                    onChange={(e) =>
                      setForm({ ...form, Notes: e.target.value })
                    }
                    style={{ ...styles.input, minHeight: "60px" }}
                  />
                </label>
              </div>

              {/* Items Table */}
              <div style={styles.itemsSection}>
                <h3>Items</h3>

                {/* Product Search Box */}
                <div style={styles.productSearchContainer}>
                  <input
                    ref={productSearchRef}
                    type="text"
                    placeholder="🔍 Search and select products... (Arrow keys + Enter)"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={handleProductSearchKeydown}
                    onFocus={() =>
                      productSearch && setShowProductDropdown(true)
                    }
                    style={styles.productSearchInput}
                  />
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div style={styles.productDropdown}>
                      {filteredProducts.map((product, idx) => (
                        <div
                          key={product.ProductID}
                          onClick={() => addProductToItems(product)}
                          onMouseEnter={() => setSelectedProductIdx(idx)}
                          style={{
                            ...styles.productDropdownItem,
                            backgroundColor:
                              selectedProductIdx === idx ? "#e3f2fd" : "white",
                          }}
                        >
                          {product.ProductName}
                        </div>
                      ))}
                    </div>
                  )}
                  {showProductDropdown &&
                    productSearch &&
                    filteredProducts.length === 0 && (
                      <div style={styles.productDropdown}>
                        <div style={{ padding: "10px", color: "#999" }}>
                          No products found
                        </div>
                      </div>
                    )}
                </div>

                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Tax</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.Items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: "500" }}>
                          {item.ProductName || "-- No product selected --"}
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.Quantity || ""}
                            onChange={(e) => {
                              const newItems = [...form.Items];
                              const qty = parseFloat(e.target.value) || 0;
                              newItems[idx].Quantity = qty;
                              const unit =
                                parseFloat(newItems[idx].UnitPrice || 0) || 0;
                              const rateObj = taxRates.find(
                                (r) => r.TaxRateID === newItems[idx].TaxRateID
                              );
                              const pct = rateObj
                                ? Number(rateObj.RatePercentage || 0)
                                : 0;
                              newItems[idx].TaxAmount =
                                (qty * unit * pct) / 100;
                              setForm({ ...form, Items: newItems });
                            }}
                            style={{ width: "80px" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={item.UnitPrice || ""}
                            onChange={(e) => {
                              const newItems = [...form.Items];
                              const unit = parseFloat(e.target.value) || 0;
                              newItems[idx].UnitPrice = unit;
                              const qty =
                                parseFloat(newItems[idx].Quantity || 0) || 0;
                              const rateObj = taxRates.find(
                                (r) => r.TaxRateID === newItems[idx].TaxRateID
                              );
                              const pct = rateObj
                                ? Number(rateObj.RatePercentage || 0)
                                : 0;
                              newItems[idx].TaxAmount =
                                (qty * unit * pct) / 100;
                              setForm({ ...form, Items: newItems });
                            }}
                            style={{ width: "100px" }}
                          />
                        </td>
                        <td>
                          <select
                            value={item.TaxRateID || ""}
                            onChange={(e) => {
                              const newItems = [...form.Items];
                              const rateId = e.target.value
                                ? Number(e.target.value)
                                : null;
                              newItems[idx].TaxRateID = rateId;
                              const qty =
                                parseFloat(newItems[idx].Quantity || 0) || 0;
                              const unit =
                                parseFloat(newItems[idx].UnitPrice || 0) || 0;
                              const rateObj = taxRates.find(
                                (r) => r.TaxRateID === rateId
                              );
                              const pct = rateObj
                                ? Number(rateObj.RatePercentage || 0)
                                : 0;
                              newItems[idx].TaxAmount =
                                (qty * unit * pct) / 100;
                              setForm({ ...form, Items: newItems });
                            }}
                            style={{ width: "160px" }}
                          >
                            <option value="">-- Tax Rate --</option>
                            {taxRates.map((tr) => (
                              <option key={tr.TaxRateID} value={tr.TaxRateID}>
                                {tr.Name} ({tr.RatePercentage}%)
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = form.Items.filter(
                                (_, i) => i !== idx
                              );
                              setForm({ ...form, Items: newItems });
                            }}
                            style={styles.dangerBtn}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="submit"
                disabled={creating}
                style={styles.primaryBtn}
              >
                {creating ? "Creating..." : "Create Direct Purchase"}
              </button>
            </form>
          </div>

          {/* List */}
          <div style={styles.listSection}>
            <h2>Direct Purchases</h2>
            <input
              type="text"
              placeholder="Search by supplier or receipt#..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.input}
            />
            {loading ? (
              <p>Loading...</p>
            ) : filteredPurchases.length === 0 ? (
              <p style={styles.noData}>No direct purchases found.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Receipt#</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map((p) => (
                    <tr
                      key={p.DirectPurchaseID}
                      style={{
                        backgroundColor:
                          selectedId === p.DirectPurchaseID ? "#f0f0f0" : "",
                      }}
                    >
                      <td>{p.SupplierName}</td>
                      <td>{p.ReceiptNumber}</td>
                      <td>
                        <span
                          style={{
                            color: statusColor(p.Status),
                            fontWeight: "bold",
                          }}
                        >
                          {statusLabel[p.Status] || p.Status}
                        </span>
                      </td>
                      <td>{currencyFormatter.format(p.TotalAmount)}</td>
                      <td>{new Date(p.PurchaseDate).toLocaleDateString()}</td>
                      <td>
                        <button
                          onClick={() => selectPurchase(p.DirectPurchaseID)}
                          style={styles.linkBtn}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT: Detail Panel */}
        {selectedId && (
          <div style={styles.rightPanel}>
            {detailLoading ? (
              <p>Loading details...</p>
            ) : detail ? (
              <>
                <h2>
                  {detail.header.SupplierName} - {detail.header.ReceiptNumber}
                </h2>

                <div style={styles.detailSection}>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span style={{ color: statusColor(detail.header.Status) }}>
                      {statusLabel[detail.header.Status] ||
                        detail.header.Status}
                    </span>
                  </p>
                  <p>
                    <strong>Total:</strong>{" "}
                    {currencyFormatter.format(detail.header.TotalAmount)}
                  </p>
                  <p>
                    <strong>Tax:</strong>{" "}
                    {currencyFormatter.format(detail.header.TaxAmount || 0)}
                  </p>
                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(detail.header.PurchaseDate).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Notes:</strong> {detail.header.Notes || "—"}
                  </p>
                </div>

                <div style={styles.detailSection}>
                  <h3>Items</h3>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty Ordered</th>
                        <th>Qty Received</th>
                        <th>Unit Price</th>
                        <th>Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items?.map((item) => (
                        <tr key={item.DirectPurchaseItemID}>
                          <td>{item.ProductName}</td>
                          <td>{item.Quantity}</td>
                          <td>
                            <strong>{item.ReceivedQuantity}</strong>
                          </td>
                          <td>{currencyFormatter.format(item.UnitPrice)}</td>
                          <td>
                            {currencyFormatter.format(item.TaxAmount || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {detail.header.Status !== "Received" &&
                  detail.header.Status !== "Cancelled" && (
                    <button
                      onClick={openReceiveModal}
                      style={styles.primaryBtn}
                    >
                      Receive Goods
                    </button>
                  )}
              </>
            ) : (
              <p>No details available</p>
            )}
          </div>
        )}
      </div>

      {/* Receive Modal */}
      {receiveModal.open && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2>Receive Goods</h2>
            {receiveModal.error && (
              <div style={styles.error}>{receiveModal.error}</div>
            )}

            <form onSubmit={submitReceive}>
              <div style={styles.formRow}>
                <label>
                  Receipt Number:
                  <input
                    type="text"
                    value={receiveModal.receiptNumber}
                    onChange={(e) =>
                      setReceiveModal({
                        ...receiveModal,
                        receiptNumber: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                </label>
              </div>

              <div style={styles.formRow}>
                <label>
                  Guía Despacho Number (optional):
                  <input
                    type="text"
                    value={receiveModal.guiaNumber}
                    onChange={(e) =>
                      setReceiveModal({
                        ...receiveModal,
                        guiaNumber: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                </label>
              </div>

              <div style={styles.formRow}>
                <label>
                  Receipt Date:
                  <input
                    type="date"
                    value={receiveModal.date}
                    onChange={(e) =>
                      setReceiveModal({ ...receiveModal, date: e.target.value })
                    }
                    style={styles.input}
                  />
                </label>
              </div>

              <div style={styles.formRow}>
                <label>
                  Warehouse:
                  <select
                    value={receiveModal.warehouseId}
                    onChange={(e) =>
                      setReceiveModal({
                        ...receiveModal,
                        warehouseId: e.target.value,
                      })
                    }
                    style={styles.input}
                  >
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map((w) => (
                      <option key={w.WarehouseID} value={w.WarehouseID}>
                        {w.WarehouseName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={styles.itemsSection}>
                <h3>Quantities to Receive</h3>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Remaining</th>
                      <th>Qty to Receive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiveModal.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.ProductName}</td>
                        <td>{item.Remaining}</td>
                        <td>
                          <input
                            type="number"
                            value={item.QuantityReceived || ""}
                            onChange={(e) => {
                              const newItems = [...receiveModal.items];
                              newItems[idx].QuantityReceived = Math.min(
                                Number(e.target.value),
                                item.Remaining
                              );
                              setReceiveModal({
                                ...receiveModal,
                                items: newItems,
                              });
                            }}
                            style={{ width: "100px" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="submit"
                  disabled={receiveModal.submitting}
                  style={styles.primaryBtn}
                >
                  {receiveModal.submitting ? "Receiving..." : "Confirm Receipt"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReceiveModal({ ...receiveModal, open: false })
                  }
                  style={styles.secondaryBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginTop: "20px",
  },
  leftPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  rightPanel: {
    border: "1px solid #ddd",
    padding: "15px",
    borderRadius: "4px",
    backgroundColor: "#f9f9f9",
    maxHeight: "80vh",
    overflowY: "auto",
  },
  formSection: {
    border: "1px solid #ddd",
    padding: "15px",
    borderRadius: "4px",
    backgroundColor: "#fff",
  },
  listSection: {
    border: "1px solid #ddd",
    padding: "15px",
    borderRadius: "4px",
    backgroundColor: "#fff",
  },
  formRow: {
    marginBottom: "10px",
    display: "flex",
    flexDirection: "column",
  },
  input: {
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "14px",
  },
  itemsSection: {
    marginTop: "15px",
    marginBottom: "15px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px",
  },
  error: {
    color: "red",
    backgroundColor: "#ffe6e6",
    padding: "10px",
    borderRadius: "4px",
    marginBottom: "10px",
  },
  primaryBtn: {
    padding: "10px 20px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    marginTop: "10px",
  },
  secondaryBtn: {
    padding: "8px 15px",
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    marginTop: "10px",
  },
  dangerBtn: {
    padding: "5px 10px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    fontSize: "12px",
  },
  linkBtn: {
    padding: "5px 10px",
    backgroundColor: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    fontSize: "12px",
  },
  detailSection: {
    marginBottom: "15px",
    paddingBottom: "15px",
    borderBottom: "1px solid #eee",
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "4px",
    maxWidth: "600px",
    maxHeight: "80vh",
    overflowY: "auto",
    width: "90%",
  },
  modalActions: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  },
  noData: {
    color: "#999",
    fontStyle: "italic",
    padding: "20px",
    textAlign: "center",
  },
  productSearchContainer: {
    position: "relative",
    marginBottom: "15px",
  },
  productSearchInput: {
    width: "100%",
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  productDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "white",
    border: "1px solid #ccc",
    borderTop: "none",
    borderRadius: "0 0 4px 4px",
    maxHeight: "250px",
    overflowY: "auto",
    zIndex: 10,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  productDropdownItem: {
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #f0f0f0",
    transition: "background-color 0.15s ease",
  },
};
