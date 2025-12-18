import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/http";
import { useLanguage } from "../context/LanguageContext";

const sizeOptions = [
  { value: "57mm", label: "57 mm" },
  { value: "80mm", label: "80 mm" },
  { value: "letter", label: "Letter / A4" },
];

export default function ReceiptSettings() {
  const { t } = useLanguage();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [ready, setReady] = useState(false);
  const autosaveTimerRef = useRef(null);
  const autosaveIdRef = useRef(0);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/config");
      setConfig(data || {});
      setReady(true);
    } catch (err) {
      setStatus({ type: "error", message: "Failed to load config" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const receiptConfig = useMemo(() => config?.receipts || {}, [config]);

  const updateSize = (sizeKey, field, value) => {
    setConfig((prev) => {
      const next = { ...(prev || {}) };
      next.receipts = next.receipts || {};
      next.receipts.sizes = next.receipts.sizes || {};
      next.receipts.sizes[sizeKey] = {
        ...next.receipts.sizes[sizeKey],
        [field]: value,
      };
      queueAutosave(next.receipts);
      return next;
    });
  };

  const persistReceipts = async (nextReceipts, { silent } = {}) => {
    if (!nextReceipts) return;
    const saveId = ++autosaveIdRef.current;
    if (!silent) {
      setSaving(true);
      setStatus({ type: "", message: "" });
    }
    try {
      const { data } = await api.patch("/api/config", {
        updates: { receipts: nextReceipts },
      });
      if (data && autosaveIdRef.current === saveId) {
        setConfig((prev) => ({ ...(prev || {}), ...data }));
      }
      if (!silent) {
        setStatus({ type: "success", message: "Receipt settings saved" });
      }
    } catch (err) {
      if (!silent) {
        setStatus({ type: "error", message: "Failed to save receipt settings" });
      }
    } finally {
      if (!silent) {
        setSaving(false);
      }
    }
  };

  const queueAutosave = (nextReceipts) => {
    if (!ready) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      persistReceipts(nextReceipts, { silent: true });
    }, 600);
  };

  const handleSave = async () => {
    if (!config?.receipts) return;
    await persistReceipts(config.receipts, { silent: false });
  };

  const renderSizeCard = (sizeKey, label) => {
    const sizeCfg =
      receiptConfig?.sizes?.[sizeKey] || {
        showLogo: true,
        showTax: true,
        showDiscount: true,
        footerText: "",
        fontScale: 1,
        lineSpacing: "normal",
      };
    return (
      <div className="card" key={sizeKey}>
        <div className="row spread" style={{ alignItems: "center", gap: 8 }}>
          <div>
            <h4>{label}</h4>
            <span className="muted small">{sizeKey}</span>
          </div>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setPreviewSize(sizeKey)}
          >
            Preview
          </button>
        </div>
        <div className="form two-col">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!sizeCfg.showLogo}
              onChange={(e) => updateSize(sizeKey, "showLogo", e.target.checked)}
            />
            <span>Show logo</span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!sizeCfg.showTax}
              onChange={(e) => updateSize(sizeKey, "showTax", e.target.checked)}
            />
            <span>Show tax column</span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!sizeCfg.showDiscount}
              onChange={(e) => updateSize(sizeKey, "showDiscount", e.target.checked)}
            />
            <span>Show discount column</span>
          </label>
          <label>
            Footer text
            <input
              value={sizeCfg.footerText || ""}
              onChange={(e) => updateSize(sizeKey, "footerText", e.target.value)}
            />
          </label>
          <label>
            Font scale
            <input
              type="number"
              min="0.8"
              max="2"
              step="0.1"
              value={sizeCfg.fontScale || 1}
              onChange={(e) => updateSize(sizeKey, "fontScale", Number(e.target.value) || 1)}
            />
          </label>
          <label>
            Line spacing
            <select
              value={sizeCfg.lineSpacing || "normal"}
              onChange={(e) => updateSize(sizeKey, "lineSpacing", e.target.value)}
            >
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
            </select>
          </label>
        </div>
      </div>
    );
  };

  const [previewSize, setPreviewSize] = useState("80mm");
  const previewCfg =
    receiptConfig?.sizes?.[previewSize] ||
    receiptConfig?.sizes?.["80mm"] ||
    {};

  const previewItems = [
    { name: "Producto A", qty: 1, price: 1000, total: 1000 },
    { name: "Producto B", qty: 2, price: 500, total: 1000 },
  ];
  const previewTotals = {
    subtotal: 2000,
    tax: previewCfg.showTax ? 380 : 0,
    discount: previewCfg.showDiscount ? 0 : 0,
    total: 2380,
  };

  if (loading || !config) {
    return (
      <div className="page">
        <h2>Receipt settings</h2>
        <p className="muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Receipt settings</h2>
      <p className="muted">Choose default size and format for receipts.</p>
      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <label>
          Default size
          <select
            value={receiptConfig.defaultSize || "80mm"}
            onChange={(e) =>
              setConfig((prev) => {
                const next = {
                  ...(prev || {}),
                  receipts: {
                    ...(prev?.receipts || {}),
                    defaultSize: e.target.value,
                  },
                };
                queueAutosave(next.receipts);
                return next;
              })
            }
          >
            {sizeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid two-col">
        {sizeOptions.map((opt) => renderSizeCard(opt.value, opt.label))}
      </div>

      <div className="card">
        <h4>Preview ({previewSize})</h4>
        <div
          className={`receipt-preview ${
            previewSize === "letter"
              ? "letter"
              : previewSize === "57mm"
              ? "size-57mm"
              : "size-80mm"
          }`}
        >
          {previewCfg.showLogo && <div className="rp-logo">LOGO</div>}
          <div className="rp-header">
            <strong>Mi Empresa SPA</strong>
            <div>RUT 12.345.678-9</div>
            <div>Av. Principal 123, Santiago</div>
            <div>BOLETA #12345</div>
            <div>2025-12-03 12:34</div>
          </div>
          <div className="rp-items">
            <div className="rp-row rp-head">
              <span>Producto</span>
              <span>Cant.</span>
              <span>Precio</span>
              {previewCfg.showTax && <span>Imp.</span>}
              {previewCfg.showDiscount && <span>Desc.</span>}
              <span>Total</span>
            </div>
            {previewItems.map((it, idx) => (
              <div className="rp-row" key={idx}>
                <span>{it.name}</span>
                <span>{it.qty}</span>
                <span>${it.price.toLocaleString()}</span>
                {previewCfg.showTax && <span>$0</span>}
                {previewCfg.showDiscount && <span>$0</span>}
                <span>${it.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="rp-totals">
            <div className="rp-row">
              <span>Subtotal</span>
              <span>${previewTotals.subtotal.toLocaleString()}</span>
            </div>
            {previewCfg.showTax && (
              <div className="rp-row">
                <span>Impuestos</span>
                <span>${previewTotals.tax.toLocaleString()}</span>
              </div>
            )}
            {previewCfg.showDiscount && (
              <div className="rp-row">
                <span>Descuento</span>
                <span>${previewTotals.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="rp-row rp-total">
              <span>Total</span>
              <span>${previewTotals.total.toLocaleString()}</span>
            </div>
          </div>
          {previewCfg.footerText && <div className="rp-footer">{previewCfg.footerText}</div>}
        </div>
      </div>

      <div className="form-actions" style={{ justifyContent: "flex-end" }}>
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
