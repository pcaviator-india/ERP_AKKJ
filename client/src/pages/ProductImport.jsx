import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

const fieldConfig = [
  { key: "sku", label: "SKU", required: true },
  { key: "name", label: "Name", required: true },
  { key: "unit", label: "Unit", required: true },
  { key: "category", label: "Category" },
  { key: "brand", label: "Brand" },
  { key: "price", label: "Selling Price" },
  { key: "cost", label: "Cost Price" },
  { key: "taxable", label: "Taxable (yes/no/1/0)" },
  { key: "service", label: "Service (yes/no/1/0)" },
  { key: "barcode", label: "Barcode" },
  { key: "description", label: "Description" },
  { key: "status", label: "Active (yes/no/1/0)" },
  { key: "image", label: "Image filename" },
  { key: "weight", label: "Weight" },
  { key: "weightUnit", label: "Weight Unit" },
  { key: "length", label: "Length" },
  { key: "width", label: "Width" },
  { key: "height", label: "Height" },
  { key: "dimensionUnit", label: "Dimension Unit" },
];

export default function ProductImport() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [imageFiles, setImageFiles] = useState([]);
  const [imageBatch, setImageBatch] = useState(null);
  const [dataFile, setDataFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [skipExisting, setSkipExisting] = useState(true);
  const [createCategories, setCreateCategories] = useState(false);
  const [createBrands, setCreateBrands] = useState(false);
  const [createUnits, setCreateUnits] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const resetState = () => {
    setImageFiles([]);
    setImageBatch(null);
    setDataFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setSkipExisting(true);
    setCreateCategories(false);
    setCreateBrands(false);
    setCreateUnits(false);
    setPreview(null);
    setImportResult(null);
    setStatus({ type: "", message: "" });
  };

  // Auto-map headers to fields using alias matching
  useEffect(() => {
    if (headers.length === 0) return;

    const normalize = (str) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();

    const aliases = {
      sku: ["sku", "productsku"],
      name: ["productname", "name", "title"],
      unit: ["unit", "unitname", "unit_id", "unitid"],
      category: ["category", "categoryname", "productcategory", "productcategoryname"],
      brand: ["brand", "brandname"],
      price: ["price", "sellingprice", "saleprice"],
      cost: ["cost", "costprice"],
      taxable: ["taxable", "tax", "istaxable"],
      service: ["service", "isservice"],
      barcode: ["barcode", "bar", "code"],
      description: ["description", "desc", "productdescription"],
      status: ["active", "isactive", "status"],
      image: ["image", "imageurl", "primaryimage", "primaryimageurl", "filename", "imagename"],
      weight: ["weight"],
      weightUnit: ["weightunit", "weightunitid", "weightunitname"],
      length: ["length"],
      width: ["width"],
      height: ["height"],
      dimensionUnit: ["dimensionunit", "dimensionunitid", "dimensionunitname", "dimension"],
    };

    const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
    const next = { ...mapping };

    Object.entries(aliases).forEach(([fieldKey, aliasList]) => {
      if (next[fieldKey]) return;
      const targetSet = new Set(aliasList.map((a) => normalize(a)));
      const match = normalizedHeaders.find((h) => targetSet.has(h.norm));
      if (match) next[fieldKey] = match.raw;
    });

    setMapping(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers.length]);

  const mappedHeaders = useMemo(() => headers, [headers]);

  const parseDataFile = async (file) => {
    const ext = file.name.toLowerCase();
    if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
      const data = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      return json;
    }
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return [];
    const cols = lines[0].split(",").map((c) => c.trim());
    const data = lines.slice(1).map((line) => {
      const parts = line.split(",");
      const obj = {};
      cols.forEach((c, idx) => {
        obj[c] = parts[idx] ? parts[idx].trim() : "";
      });
      return obj;
    });
    return data;
  };

  const handleDataUpload = async () => {
    if (!dataFile) return;
    setStatus({ type: "", message: "" });
    try {
      const parsed = await parseDataFile(dataFile);
      if (!parsed || parsed.length === 0) {
        setStatus({ type: "error", message: t("products.importEmpty") || "No rows found." });
        return;
      }
      setRows(parsed);
      setHeaders(Object.keys(parsed[0]));
      setPreview(null);
      setStatus({ type: "success", message: t("products.importDataLoaded") || "Data loaded." });
    } catch (err) {
      console.error("Parse error", err);
      setStatus({ type: "error", message: t("products.importParseError") || "Failed to parse file." });
    }
  };

  const handleImageUpload = async () => {
    if (!imageFiles.length) return;
    setStatus({ type: "", message: "" });
    const form = new FormData();
    imageFiles.forEach((f) => form.append("files", f));
    try {
      const res = await api.post("/api/products/import/images", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImageBatch(res.data);
      setStatus({ type: "success", message: t("products.importImagesReady") || "Images staged." });
    } catch (err) {
      console.error("Image upload error", err);
      setStatus({ type: "error", message: t("products.importImagesError") || "Failed to upload images." });
    }
  };

  const handlePreview = async () => {
    if (!rows.length) {
      setStatus({ type: "error", message: t("products.importNoData") || "No data to preview." });
      return;
    }
    setLoadingPreview(true);
    setStatus({ type: "", message: "" });
    try {
      const payload = {
        rows,
        mapping,
        skipExisting,
        imageBatchId: imageBatch?.batchId,
        createCategories,
        createBrands,
        createUnits,
      };
      const res = await api.post("/api/products/import/preview", payload);
      setPreview(res.data);
      setStatus({ type: "success", message: t("products.importPreviewReady") || "Preview ready." });
    } catch (err) {
      console.error("Preview error", err);
      setStatus({ type: "error", message: t("products.importPreviewError") || "Failed to preview import." });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!preview) {
      setStatus({ type: "error", message: t("products.importPreviewFirst") || "Run preview first." });
      return;
    }
    setImporting(true);
    setStatus({ type: "", message: "" });
    try {
      const payload = {
        rows,
        mapping,
        skipExisting,
        imageBatchId: imageBatch?.batchId,
        createCategories,
        createBrands,
        createUnits,
      };
      const res = await api.post("/api/products/import/commit", payload);
      setImportResult(res.data);
      setStatus({
        type: "success",
        message:
          t("products.importDone") ||
          `Created ${res.data.created}, updated ${res.data.updated}, skipped ${res.data.skipped}`,
      });
      setTimeout(() => navigate("/products"), 1500);
    } catch (err) {
      console.error("Import error", err);
      setStatus({ type: "error", message: t("products.importCommitError") || "Failed to import products." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page product-import-page">
      <header className="list-header">
        <div>
          <h2>{t("products.import")}</h2>
          <p className="muted">
            {t("products.importDescription") ||
              "Upload images first (optional), then upload CSV/XLSX, map columns, preview, and import."}
          </p>
        </div>
        <div className="list-actions">
          <Link className="btn ghost" to="/products">
            {t("nav.products")}
          </Link>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <h3>{t("products.importImages") || "Step 1: Upload images (optional)"}</h3>
          <input type="file" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} />
          <button className="btn" style={{ marginTop: 10 }} onClick={handleImageUpload} disabled={!imageFiles.length}>
            {t("products.importUploadImages") || "Upload images"}
          </button>
          {imageBatch && (
            <p className="muted small">
              Batch: {imageBatch.batchId} - {imageBatch.files?.length || 0} files
            </p>
          )}
        </div>
        <div>
          <h3>{t("products.importData") || "Step 2: Upload data file"}</h3>
          <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => setDataFile(e.target.files?.[0])} />
          <button className="btn" style={{ marginTop: 10 }} onClick={handleDataUpload} disabled={!dataFile}>
            {t("products.importLoadData") || "Load file"}
          </button>
          {rows.length > 0 && (
            <p className="muted small">
              {rows.length} {t("products.importRows") || "rows loaded"} | {headers.length} {t("products.importColumns") || "columns"}
            </p>
          )}
        </div>
      </div>

      {headers.length > 0 && (
        <div className="card">
          <h3>{t("products.importMap") || "Step 3: Map columns"}</h3>
          <div className="mapping-grid">
            {fieldConfig.map((f) => (
              <label key={f.key} className="field-option">
                <span>
                  {f.label}
                  {f.required ? " *" : ""}
                </span>
                <select value={mapping[f.key] || ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                  <option value="">{t("products.importSkip") || "Skip"}</option>
                  {mappedHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="mapping-grid">
            <label className="inline-check" style={{ justifyContent: "flex-start" }}>
              <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
              <span>{t("products.importSkipExisting") || "Skip existing SKUs"}</span>
            </label>
            <label className="inline-check" style={{ justifyContent: "flex-start" }}>
              <input type="checkbox" checked={createCategories} onChange={(e) => setCreateCategories(e.target.checked)} />
              <span>{t("products.importCreateCategories") || "Create missing categories"}</span>
            </label>
            <label className="inline-check" style={{ justifyContent: "flex-start" }}>
              <input type="checkbox" checked={createBrands} onChange={(e) => setCreateBrands(e.target.checked)} />
              <span>{t("products.importCreateBrands") || "Create missing brands"}</span>
            </label>
            <label className="inline-check" style={{ justifyContent: "flex-start" }}>
              <input type="checkbox" checked={createUnits} onChange={(e) => setCreateUnits(e.target.checked)} />
              <span>{t("products.importCreateUnits") || "Create missing units"}</span>
            </label>
          </div>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={handlePreview} disabled={loadingPreview}>
              {loadingPreview ? t("inventory.saving") : t("products.importPreview") || "Preview"}
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="card">
          <h3>{t("products.importPreviewTitle") || "Preview"}</h3>
          <p className="muted">
            {t("products.importSummary") || "Summary"}: {preview.summary.valid} ok, {preview.summary.invalid} invalid, {preview.summary.total} total.
          </p>
          <div className="preview-list">
            {preview.rows.slice(0, 10).map((r) => (
              <div key={r.index} className="preview-row">
                <strong>{r.product.SKU}</strong> - {r.product.ProductName || ""} {r.errors.length > 0 && <span className="status error small">{r.errors.join(", ")}</span>}
                {r.imageRef && (
                  <span className="muted small">
                    | Image: {r.imageRef} {r.imageMatched ? "(matched)" : "(missing)"}
                  </span>
                )}
              </div>
            ))}
            {preview.rows.length > 10 && (
              <p className="muted small">{t("products.importPreviewMore") || "More rows not shown..."}</p>
            )}
          </div>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn primary" onClick={handleImport} disabled={importing}>
              {importing ? t("inventory.saving") : t("products.importConfirm") || "Import now"}
            </button>
          </div>
        </div>
      )}

      {importResult && (
        <div className="card">
          <h3>{t("products.importDone") || "Import finished"}</h3>
          <p className="muted">
            {t("products.importSummary") || "Summary"}: {importResult.created} created, {importResult.updated} updated, {importResult.skipped} skipped.
          </p>
        </div>
      )}
    </div>
  );
}
