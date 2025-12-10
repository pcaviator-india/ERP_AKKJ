import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/http";

const money = (val) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(
    Number(val || 0)
  );

const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saleDetail, setSaleDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setStatus({ type: "", message: "" });
      try {
        const [detailRes, invRes] = await Promise.all([
          api.get(`/api/customers/${id}`),
          api.get(`/api/ar/customers/${id}/invoices`),
        ]);
        setCustomer(detailRes.data);
        setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      } catch (err) {
        const message = err.response?.data?.error || "Failed to load customer";
        setStatus({ type: "error", message });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const { purchases, returns } = useMemo(() => {
    const data = Array.isArray(invoices) ? invoices : [];
    const positive = [];
    const negative = [];
    data.forEach((inv) => {
      const amt = Number(inv.FinalAmount ?? inv.Total ?? 0);
      if (amt < 0) negative.push(inv);
      else positive.push(inv);
    });
    return { purchases: positive, returns: negative };
  }, [invoices]);

  const loadSaleDetail = async (saleId) => {
    if (!saleId) return;
    setDetailModalOpen(true);
    setDetailLoading(true);
    setSaleDetail(null);
    try {
      const { data } = await api.get(`/api/ar/invoices/${saleId}`);
      setSaleDetail(data);
    } catch (err) {
      const message = err.response?.data?.error || "Failed to load sale detail";
      setStatus({ type: "error", message });
    } finally {
      setDetailLoading(false);
    }
  };

  const computeLineTax = (item) => {
    const qty = Number(item.Quantity) || 0;
    const unit = Number(item.UnitPrice) || 0;
    const discount = Number(item.DiscountAmount || 0);
    const lineTotal = Number(item.LineTotal ?? item.Total ?? unit * qty);
    const base = unit * qty - discount;
    const calc = lineTotal - base;
    const taxFromField = Number(item.TaxAmount || 0);
    return calc > 0 ? calc : taxFromField;
  };

  const computedSaleTotals = useMemo(() => {
    if (!saleDetail) return { tax: 0, subtotal: 0, total: 0, discount: 0 };
    const items = Array.isArray(saleDetail.items) ? saleDetail.items : [];
    const total = Number(saleDetail.header?.FinalAmount || 0);
    const discountFromHeader = Number(saleDetail.header?.DiscountValue || saleDetail.header?.DiscountAmount || 0);
    let baseSum = 0;
    let taxSum = 0;
    items.forEach((it) => {
      const qty = Number(it.Quantity) || 0;
      const unit = Number(it.UnitPrice) || 0;
      const discount = Number(it.DiscountAmount || 0);
      baseSum += unit * qty - discount;
      taxSum += computeLineTax(it);
    });
    const subtotal = saleDetail.header?.SubtotalAmount != null ? Number(saleDetail.header.SubtotalAmount) : baseSum || total - taxSum;
    const tax = saleDetail.header?.TaxAmount != null ? Number(saleDetail.header.TaxAmount) : taxSum;
    const discount = discountFromHeader || items.reduce((sum, it) => sum + Number(it.DiscountAmount || 0), 0);
    return { tax, subtotal, total: total || subtotal + tax, discount };
  }, [saleDetail]);

  return (
    <div className="page wide">
      <header className="list-header">
        <div>
          <h2>Customer details</h2>
          <p className="muted">Review customer profile, purchases, and returns.</p>
        </div>
        <div className="list-actions inline">
          <button className="btn ghost" onClick={() => navigate("/customers")}>
            ← Back to customers
          </button>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      {loading ? (
        <div className="card">
          <p className="muted">Loading...</p>
        </div>
      ) : !customer ? (
        <div className="card">
          <p className="muted">Customer not found.</p>
        </div>
      ) : (
        <div className="detail-grid">
          <div className="card">
            <h3>Purchases</h3>
            {purchases.length === 0 ? (
              <p className="muted">No purchases yet.</p>
            ) : (
              <ul className="simple-list">
                {purchases.map((p) => (
                  <li key={p.SaleID} className="clickable" onClick={() => loadSaleDetail(p.SaleID)}>
                    <div className="inline-row">
                      <strong>{p.DocumentType || "Invoice"}</strong>
                      <span className="muted small">{p.DocumentNumber || p.SaleID}</span>
                      <span className="muted small">{formatDate(p.SaleDate)}</span>
                      <span className="muted small">Total: {money(p.FinalAmount)}</span>
                      <span className="muted small">Paid: {money(p.AmountPaid)}</span>
                      <span className="muted small">Balance: {money(p.Balance)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h3 style={{ marginTop: 20 }}>Returns</h3>
            {returns.length === 0 ? (
              <p className="muted">No returns.</p>
            ) : (
              <ul className="simple-list">
                {returns.map((r) => (
                  <li key={r.SaleID} className="clickable" onClick={() => loadSaleDetail(r.SaleID)}>
                    <div className="inline-row">
                      <strong>{r.DocumentType || "Return"}</strong>
                      <span className="muted small">{r.DocumentNumber || r.SaleID}</span>
                      <span className="muted small">{formatDate(r.SaleDate)}</span>
                      <span className="muted small">Total: {money(r.FinalAmount)}</span>
                      <span className="muted small">Paid: {money(r.AmountPaid)}</span>
                      <span className="muted small">Balance: {money(r.Balance)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3>Profile</h3>
            <dl className="profile-grid">
              <div>
                <dt>Name</dt>
                <dd>{customer.CustomerName}</dd>
              </div>
              <div>
                <dt>RUT</dt>
                <dd>{customer.TaxID || "—"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{customer.Email || "—"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{customer.PhoneNumber || "—"}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{customer.ContactPerson || "—"}</dd>
              </div>
              <div>
                <dt>Billing</dt>
                <dd>{[customer.BillingAddressLine1, customer.BillingCity].filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd>{[customer.ShippingAddressLine1, customer.ShippingCity].filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Credit limit</dt>
                <dd>{customer.CreditLimit != null ? money(customer.CreditLimit) : "—"}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(customer.CreatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {detailModalOpen && (
        <div className="modal-overlay">
          <div className="modal receipt-modal">
            <div className="row spread" style={{ alignItems: "center" }}>
              <h3>Sale details</h3>
              <button className="btn ghost" onClick={() => setDetailModalOpen(false)}>
                Close
              </button>
            </div>
            {detailLoading && <p className="muted">Loading...</p>}
            {!detailLoading && !saleDetail && <p className="muted">No details available.</p>}
            {!detailLoading && saleDetail && (
              <div className="receipt-grid">
                <div className="receipt-card">
                  <div className="row spread">
                    <div>
                      <div className="muted small">Document</div>
                      <strong>
                        {saleDetail.header?.DocumentType || "Sale"}{" "}
                        {saleDetail.header?.DocumentNumber || saleDetail.header?.SaleID}
                      </strong>
                    </div>
                    <div className="muted small" style={{ textAlign: "right" }}>
                      <div>{formatDate(saleDetail.header?.SaleDate)}</div>
                      <div>Status: {saleDetail.header?.Status || "—"}</div>
                    </div>
                  </div>
                  <div className="muted small" style={{ marginTop: "0.35rem" }}>
                    Customer: {saleDetail.header?.CustomerName || "—"}
                  </div>
                  <div className="pill-row" style={{ marginTop: "0.5rem" }}>
                    <span>Total: {money(saleDetail.header?.FinalAmount)}</span>
                    <span>Paid: {money(saleDetail.header?.AmountPaid || saleDetail.header?.AlreadyPaid)}</span>
                      <span>
                        Balance:{" "}
                        {money(
                          Number(saleDetail.header?.FinalAmount || 0) -
                            Number(saleDetail.header?.AmountPaid || saleDetail.header?.AlreadyPaid || 0)
                      )}
                    </span>
                  </div>
                    <div className="receipt-summary">
                      <div className="row spread">
                        <span>Subtotal</span>
                        <strong>{money(computedSaleTotals.subtotal)}</strong>
                      </div>
                      <div className="row spread">
                        <span>Tax</span>
                        <strong>{money(computedSaleTotals.tax)}</strong>
                      </div>
                      <div className="row spread">
                        <span>Discount</span>
                        <strong>{money(computedSaleTotals.discount)}</strong>
                      </div>
                      <div className="row spread total-line">
                        <span>Total</span>
                        <strong>{money(computedSaleTotals.total)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="receipt-card">
                  <h4>Items</h4>
                  {saleDetail.items?.length ? (
                    <div className="table receipt-table">
                      <div className="table-head">
                        <span>Product</span>
                        <span>Qty</span>
                        <span>Price</span>
                        <span>Tax</span>
                        <span>Total</span>
                      </div>
                      {saleDetail.items.map((it) => (
                        <div className="table-row" key={it.SalesItemID || `${it.ProductID}-${it.SaleID}`}>
                          <span>{it.ProductName || it.ProductID}</span>
                          <span>{Number(it.Quantity).toLocaleString()}</span>
                          <span>{money(it.UnitPrice)}</span>
                          <span>{money(computeLineTax(it))}</span>
                          <span>{money(it.LineTotal || it.Total)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No items.</p>
                  )}
                </div>

                <div className="receipt-card">
                  <h4>Payments</h4>
                  {saleDetail.payments?.length ? (
                    <ul className="simple-list">
                      {saleDetail.payments.map((pay) => (
                        <li key={pay.SalesPaymentID}>
                          <div className="row spread">
                            <span>{pay.PaymentMethodName || "Payment"}</span>
                            <strong>{money(pay.Amount)}</strong>
                          </div>
                          <div className="muted small">
                            {formatDate(pay.PaymentDate)} {pay.ReferenceNumber ? `• Ref: ${pay.ReferenceNumber}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No payments recorded.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
