import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

const EXPORTABLE_FIELDS = [
  { key: "ProductName", labelKey: "products.name" },
  { key: "SKU", labelKey: "products.sku" },
  { key: "CategoryName", labelKey: "products.category" },
  { key: "BrandName", labelKey: "products.brand" },
  { key: "UnitName", labelKey: "productForm.unit" },
  { key: "PrimaryImageURL", labelKey: "productForm.image" },
  { key: "AllImages", labelKey: "productForm.images" },
  { key: "Description", labelKey: "productForm.descriptionField" },
  { key: "Weight", labelKey: "products.weight" },
  { key: "WeightUnitName", labelKey: "products.weightUnit" },
  { key: "Length", labelKey: "products.length" },
  { key: "Width", labelKey: "products.width" },
  { key: "Height", labelKey: "products.height" },
  { key: "DimensionUnitName", labelKey: "products.dimensionUnit" },
  { key: "SellingPrice", labelKey: "products.price" },
  { key: "CostPrice", labelKey: "products.cost" },
  { key: "IsTaxable", labelKey: "products.taxable" },
  { key: "IsService", labelKey: "products.service" },
  { key: "Barcode", labelKey: "products.barcode" },
  { key: "IsActive", labelKey: "products.status" },
  { key: "CreatedAt", labelKey: "products.createdAt" },
  { key: "UpdatedAt", labelKey: "products.updatedAt" },
];

export default function ProductExport() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const [selectedFields, setSelectedFields] = useState(
    new Set(["ProductName", "SKU", "CategoryName", "BrandName", "SellingPrice", "IsActive"])
  );
  const [format, setFormat] = useState("csv");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [downloading, setDownloading] = useState(false);

  const filters = useMemo(
    () => ({
      q: params.get("q") || "",
      category: params.get("category") || "",
      type: params.get("type") || "all",
    }),
    [params]
  );

  const toggleField = (key) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (checked) {
      setSelectedFields(new Set(EXPORTABLE_FIELDS.map((f) => f.key)));
    } else {
      setSelectedFields(new Set());
    }
  };

  const handleExport = async () => {
    if (selectedFields.size === 0) {
      setStatus({ type: "error", message: "Select at least one field." });
      return;
    }
    setDownloading(true);
    setStatus({ type: "", message: "" });
    try {
      const cols = Array.from(selectedFields).join(",");
      const response = await api.get("/api/products/export", {
        params: { ...filters, format, cols },
        responseType: "blob",
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = format === "xlsx" ? "products.xlsx" : "products.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus({ type: "success", message: t("products.export") + " ready." });
    } catch (err) {
      console.error("Export failed", err);
      setStatus({ type: "error", message: t("products.loadError") });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page product-export-page">
      <header className="list-header">
        <div>
          <h2>{t("products.export")}</h2>
          <p className="muted">{t("customFields.selectPrompt")}</p>
        </div>
        <div className="list-actions">
          <Link className="btn ghost" to="/products">
            {t("nav.products")}
          </Link>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card export-card">
        <div className="export-columns">
          <div className="export-col">
            <h4 className="muted">{t("products.export")}</h4>
            <div className="format-group vertical">
              <label className="field-option">
                <input
                  type="radio"
                  name="format"
                  checked={format === "csv"}
                  onChange={() => setFormat("csv")}
                />
                <span>CSV</span>
              </label>
              <label className="field-option">
                <input
                  type="radio"
                  name="format"
                  checked={format === "xlsx"}
                  onChange={() => setFormat("xlsx")}
                />
                <span>Excel (.xlsx)</span>
              </label>
            </div>
          </div>

          <div className="export-col">
            <div className="export-header">
              <span>{t("products.fields")}</span>
              <label className="field-option">
                <input
                  type="checkbox"
                  checked={selectedFields.size === EXPORTABLE_FIELDS.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
                <span>{t("products.selectAll") || "Select all"}</span>
              </label>
            </div>
            <div className="export-field-list">
              {EXPORTABLE_FIELDS.map((field) => (
                <label key={field.key} className="field-option">
                  <input
                    type="checkbox"
                    checked={selectedFields.has(field.key)}
                    onChange={() => toggleField(field.key)}
                  />
                  <span>{t(field.labelKey) || field.key}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="export-footer">
          <div />
          <button className="btn" onClick={handleExport} disabled={downloading}>
            {downloading ? t("inventory.saving") : t("products.export")}
          </button>
        </div>
      </div>
    </div>
  );
}
