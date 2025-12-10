import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";

export default function CompanySetup() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const { config, updateConfig, ready: configReady } = useConfig();
  const [taxRates, setTaxRates] = useState([]);
  const [form, setForm] = useState({
    LegalName: "",
    TaxId: "",
    Country: "CL",
    City: "",
    Address: "",
  });
  const [taxConfig, setTaxConfig] = useState({ defaultTaxRateId: "", priceIncludesTax: false });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    async function loadCompany() {
      if (!company?.CompanyID) return;
      setLoading(true);
      try {
        const { data } = await api.get(`/api/companies/${company.CompanyID}`);
        setForm({
          LegalName: data.LegalName || "",
          TaxId: data.TaxID || "",
          Country: data.CountryCode || "CL",
          City: data.City || "",
          Address: data.AddressLine1 || "",
        });
      } catch (error) {
        console.warn("Unable to load company profile", error);
      } finally {
        setLoading(false);
      }
    }
    loadCompany();
  }, [company]);

  useEffect(() => {
    if (!configReady) return;
    const defaultId = config?.tax?.defaultTaxRateId ?? "";
    const include = !!config?.tax?.priceIncludesTax;
    setTaxConfig({
      defaultTaxRateId: defaultId === null ? "" : defaultId,
      priceIncludesTax: include,
    });
  }, [config, configReady]);

  useEffect(() => {
    const loadTaxRates = async () => {
      try {
        const { data } = await api.get("/api/tax-rates");
        setTaxRates(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("Failed to load tax rates", err);
        setTaxRates([]);
      }
    };
    loadTaxRates();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      await api.put(`/api/companies/${company.CompanyID}`, {
        CompanyName: company.CompanyName,
        LegalName: form.LegalName,
        TaxID: form.TaxId,
        CountryCode: form.Country,
        City: form.City,
        AddressLine1: form.Address,
        IsActive: 1,
      });
      // Save tax config alongside company info
      await updateConfig({
        tax: {
          defaultTaxRateId:
            taxConfig.defaultTaxRateId === "" ? null : Number(taxConfig.defaultTaxRateId),
          priceIncludesTax: !!taxConfig.priceIncludesTax,
        },
      });
      setStatus({ type: "success", message: "Company information saved." });
      setTimeout(() => navigate("/employees/onboarding"), 900);
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Failed to save company";
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page narrow">
      <h2>Company profile</h2>
      <p className="muted">
        These fields map to the <code>Companies</code> table in the backend schema. When wired, this form can submit to
        <code>/api/companies</code>.
      </p>
      <form className="card form" onSubmit={handleSubmit}>
        <label>
          Legal name
          <input
            type="text"
            name="LegalName"
            value={form.LegalName}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Tax ID / RUT
          <input
            type="text"
            name="TaxId"
            value={form.TaxId}
            onChange={handleChange}
            placeholder="99.999.999-9"
          />
        </label>
        <label>
          Country
          <input type="text" name="Country" value={form.Country} onChange={handleChange} />
        </label>
        <label>
          City
          <input type="text" name="City" value={form.City} onChange={handleChange} />
        </label>
        <label>
        Address
        <input type="text" name="Address" value={form.Address} onChange={handleChange} />
      </label>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Tax (IVA) defaults</h3>
        <p className="muted small">Set a default IVA rate and whether prices include tax.</p>
        <div className="grid two">
          <label>
            Default tax rate
            <select
              value={taxConfig.defaultTaxRateId}
              onChange={(e) =>
                setTaxConfig((prev) => ({
                  ...prev,
                  defaultTaxRateId: e.target.value,
                }))
              }
            >
              <option value="">Select</option>
              {taxRates.map((r) => (
                <option key={r.TaxRateID} value={r.TaxRateID}>
                  {r.Name} ({Number(r.RatePercentage || 0)}%)
                </option>
              ))}
            </select>
          </label>
          <label className="toggle inline-check">
            <span>Prices include tax</span>
            <input
              type="checkbox"
              checked={!!taxConfig.priceIncludesTax}
              onChange={(e) =>
                setTaxConfig((prev) => ({ ...prev, priceIncludesTax: e.target.checked }))
              }
            />
          </label>
        </div>
      </div>
      <button className="btn primary" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save & Continue"}
      </button>
        {status.message && (
          <p className={`status ${status.type}`}>{status.message}</p>
        )}
      </form>
    </div>
  );
}
