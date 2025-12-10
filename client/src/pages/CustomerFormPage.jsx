import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/http";

const normalizeRut = (val) => (val || "").toString().replace(/[^0-9kK]/g, "").toUpperCase();
const formatRut = (val) => {
  const clean = normalizeRut(val);
  if (!clean) return "";
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body}-${dv}`;
};
const isValidRut = (val) => {
  const clean = normalizeRut(val);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const mod = 11 - (sum % 11);
  const expectedDv = mod === 11 ? "0" : mod === 10 ? "K" : String(mod);
  return expectedDv === dv;
};

export default function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    CustomerName: "",
    TaxID: "",
    Email: "",
    PhoneNumber: "",
    ContactPerson: "",
    BillingAddressLine1: "",
    BillingCity: "",
    ShippingAddressLine1: "",
    ShippingCity: "",
    CreditLimit: "",
    SameAsBilling: false,
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!isEdit) return;
      setLoading(true);
      try {
        const { data } = await api.get(`/api/customers/${id}`);
        setForm({
          CustomerName: data.CustomerName || "",
          TaxID: data.TaxID || "",
          Email: data.Email || "",
          PhoneNumber: data.PhoneNumber || "",
          ContactPerson: data.ContactPerson || "",
          BillingAddressLine1: data.BillingAddressLine1 || "",
          BillingCity: data.BillingCity || "",
          ShippingAddressLine1: data.ShippingAddressLine1 || "",
          ShippingCity: data.ShippingCity || "",
          CreditLimit:
            data.CreditLimit === null || data.CreditLimit === undefined ? "" : Number(data.CreditLimit),
          SameAsBilling: false,
        });
      } catch (err) {
        const message = err.response?.data?.error || "Failed to load customer";
        setStatus({ type: "error", message });
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.CustomerName.trim()) {
      setStatus({ type: "error", message: "Name is required" });
      return;
    }
    setStatus({ type: "", message: "" });
    try {
      const cleanedRut = normalizeRut(form.TaxID);
      if (cleanedRut && !isValidRut(cleanedRut)) {
        setStatus({ type: "error", message: "Invalid RUT. Check the verification digit." });
        return;
      }
      const payload = {
        CustomerName: form.CustomerName.trim(),
        TaxID: cleanedRut ? formatRut(cleanedRut) : null,
        Email: form.Email.trim() || null,
        PhoneNumber: form.PhoneNumber.trim() || null,
        ContactPerson: form.ContactPerson.trim() || null,
        BillingAddressLine1: form.BillingAddressLine1.trim() || null,
        BillingCity: form.BillingCity.trim() || null,
        ShippingAddressLine1: form.ShippingAddressLine1.trim() || null,
        ShippingCity: form.ShippingCity.trim() || null,
        CreditLimit: form.CreditLimit === "" ? null : Number(form.CreditLimit) || 0,
      };

      if (isEdit) {
        await api.put(`/api/customers/${id}`, payload);
        setStatus({ type: "success", message: "Customer updated" });
      } else {
        await api.post("/api/customers", payload);
        setStatus({ type: "success", message: "Customer added" });
      }
      navigate("/customers");
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Failed to save customer";
      setStatus({ type: "error", message });
    }
  };

  return (
    <div className="page wide">
      <header className="list-header">
        <div>
          <h2>{isEdit ? "Edit customer" : "Add customer"}</h2>
          <p className="muted">Customer profile used in POS and invoicing.</p>
        </div>
        <div className="list-actions inline">
          <button className="btn ghost" onClick={() => navigate("/customers")}>
            Cancel
          </button>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <form className="form two-col" onSubmit={handleSubmit}>
            <div className="form-row">
              <label style={{ flex: 1 }}>
                Name (required)
                <input
                  value={form.CustomerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, CustomerName: e.target.value }))}
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                RUT / Tax ID
                <input
                  value={form.TaxID}
                  onChange={(e) => setForm((prev) => ({ ...prev, TaxID: e.target.value }))}
                  placeholder="12.345.678-9"
                />
              </label>
            </div>
            <div className="form-row">
              <label style={{ flex: 1 }}>
                Email
                <input
                  type="email"
                  value={form.Email}
                  onChange={(e) => setForm((prev) => ({ ...prev, Email: e.target.value }))}
                />
              </label>
              <label style={{ flex: 1 }}>
                Phone
                <input
                  value={form.PhoneNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, PhoneNumber: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-row">
              <label style={{ flex: 1 }}>
                Contact person
                <input
                  value={form.ContactPerson}
                  onChange={(e) => setForm((prev) => ({ ...prev, ContactPerson: e.target.value }))}
                />
              </label>
              <label style={{ flex: 1 }}>
                Credit limit
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.CreditLimit}
                  onChange={(e) => setForm((prev) => ({ ...prev, CreditLimit: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-row">
              <label style={{ flex: 1 }}>
                Billing address
                <input
                  value={form.BillingAddressLine1}
                  onChange={(e) => setForm((prev) => ({ ...prev, BillingAddressLine1: e.target.value }))}
                  placeholder="Street, number"
                />
              </label>
              <label style={{ flex: 1 }}>
                Billing city
                <input
                  value={form.BillingCity}
                  onChange={(e) => setForm((prev) => ({ ...prev, BillingCity: e.target.value }))}
                />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.SameAsBilling}
                onChange={(e) => {
                  const nextVal = e.target.checked;
                  setForm((prev) => ({
                    ...prev,
                    SameAsBilling: nextVal,
                    ShippingAddressLine1: nextVal ? prev.BillingAddressLine1 : prev.ShippingAddressLine1,
                    ShippingCity: nextVal ? prev.BillingCity : prev.ShippingCity,
                  }));
                }}
              />
              <span>Shipping same as billing</span>
            </label>
            <div className="form-row">
              <label style={{ flex: 1 }}>
                Shipping address
                <input
                  value={form.ShippingAddressLine1}
                  onChange={(e) => setForm((prev) => ({ ...prev, ShippingAddressLine1: e.target.value }))}
                  placeholder="Street, number"
                />
              </label>
              <label style={{ flex: 1 }}>
                Shipping city
                <input
                  value={form.ShippingCity}
                  onChange={(e) => setForm((prev) => ({ ...prev, ShippingCity: e.target.value }))}
                />
              </label>
            </div>
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <button type="submit" className="btn primary">
                {isEdit ? "Update Customer" : "Add Customer"}
              </button>
              <button type="button" className="btn ghost" onClick={() => navigate("/customers")}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
