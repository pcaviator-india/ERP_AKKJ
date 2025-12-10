import { useEffect, useState } from "react";
import api from "../api/http";
import { configureQzSecurity, ensureQzConnection } from "../utils/qz";
import { printWithFallback } from "../services/printService";

const sizeOptions = [
  { value: "57mm", label: "57 mm" },
  { value: "80mm", label: "80 mm" },
  { value: "letter", label: "Letter / A4" },
];

export default function AccessoriesSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [testing, setTesting] = useState(false);
  const [testingQz, setTestingQz] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/config");
      setConfig(data || {});
    } catch (err) {
      setStatus({ type: "error", message: "Failed to load config" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const accessories = config?.accessories || {};

  const updateField = (field, value) => {
    setConfig((prev) => ({
      ...(prev || {}),
      accessories: {
        ...(prev?.accessories || {}),
        [field]: value,
        defaultPrinters: { ...(prev?.accessories?.defaultPrinters || {}) },
      },
    }));
  };

  const updatePrinter = (size, value) => {
    setConfig((prev) => ({
      ...(prev || {}),
      accessories: {
        ...(prev?.accessories || {}),
        defaultPrinters: {
          ...(prev?.accessories?.defaultPrinters || {}),
          [size]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      await api.patch("/api/config", {
        updates: { accessories: config.accessories },
      });
      setStatus({ type: "success", message: "Accessories saved" });
    } catch (err) {
      setStatus({ type: "error", message: "Failed to save accessories" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    if (!accessories.agentUrl) {
      setStatus({ type: "error", message: "Set agent URL first." });
      return;
    }
    setTesting(true);
    setStatus({ type: "", message: "" });
    try {
      // Use browser print instead of local agent
      const html = "<html><body><pre>Test print from AKKJ POS</pre></body></html>";
      const result = await printWithFallback(html, {
        printerName: accessories.defaultPrinters?.["80mm"] || null,
        method: "browser",
      });
      setStatus({ type: "success", message: "Test print sent to browser." });
    } catch (err) {
      setStatus({ type: "error", message: "Test print failed: " + err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleTestQzPrint = async () => {
    if (!accessories.qzEnabled) {
      setStatus({ type: "error", message: "Enable QZ Tray first." });
      return;
    }
    
    // Make certificate and key optional for testing unsigned mode
    if (!accessories.qzCertificate?.trim() || !accessories.qzPrivateKey?.trim()) {
      const proceed = window.confirm(
        "Certificate/Key not set. Try unsigned mode? (QZ Tray will show a trust prompt for each request)"
      );
      if (!proceed) {
        setStatus({ type: "error", message: "QZ certificate and private key are required." });
        return;
      }
    }
    
    setTestingQz(true);
    setStatus({ type: "", message: "" });
    try {
      setStatus({ type: "info", message: "Loading QZ Tray library..." });
      const configData = {
        qzScriptUrl: accessories.qzScriptUrl,
        signatureAlgorithm: accessories.qzSignatureAlgorithm || "SHA512",
      };
      
      // Only add cert/key if provided
      if (accessories.qzCertificate?.trim()) {
        configData.certificate = accessories.qzCertificate;
      }
      if (accessories.qzPrivateKey?.trim()) {
        configData.privateKey = accessories.qzPrivateKey;
      }
      
      const qz = await configureQzSecurity(configData);
      
      setStatus({ type: "info", message: "Connecting to QZ Tray desktop app..." });
      await ensureQzConnection(qz);
      console.log("QZ websocket ready, version:", qz?.version);
      
      setStatus({ type: "info", message: "Authorization confirmed. Proceeding with print..." });

      // Pick printer (try configured defaults, then system default)
      setStatus({ type: "info", message: "Finding printer..." });
      const defaults = accessories.defaultPrinters || {};
      const candidates = [
        defaults["80mm"],
        defaults["letter"],
        defaults["57mm"],
      ]
        .map((p) => (p || "").trim())
        .filter(Boolean);
      let printer = candidates[0];
      
      if (!printer) {
        setStatus({ type: "info", message: "Getting system default printer..." });
        try {
          printer = await qz.printers.getDefault();
        } catch (err) {
          console.warn("Failed to get default printer:", err);
          throw new Error("No printer selected and could not detect system default. Please set a printer in the form above.");
        }
      }
      
      if (!printer) {
        throw new Error("No printer selected and no system default found.");
      }
      console.log("Using printer", printer);

      // Print via QZ Tray; falls back to browser print inside service on failure
      const html = `<pre style="font-size:16px">QZ Tray Test Print - SUCCESS\n${new Date().toLocaleString()}\nPrinter: ${printer}</pre>`;
      
      setStatus({ type: "info", message: `Printing to ${printer}...` });
      
      const result = await printWithFallback(html, {
        printerName: printer,
        method: "qz",
        qzConfig: {
          qzInstance: qz,
          qzScriptUrl: accessories.qzScriptUrl,
          certificate: accessories.qzCertificate,
          privateKey: accessories.qzPrivateKey,
          signatureAlgorithm: accessories.qzSignatureAlgorithm || "SHA512",
        },
      });
      
      console.log("Print result:", result);
      const methodLabel = result?.method === "qz" ? "QZ Tray" : "browser";
      setStatus({ type: "success", message: `Printed via ${methodLabel} to ${printer}` });
    } catch (err) {
      console.error("Print test error:", err);
      setStatus({ type: "error", message: `Print failed: ${err?.message || err}` });
    } finally {
      setTestingQz(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="page">
        <h2>Accessories</h2>
        <p className="muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Accessories</h2>
      <p className="muted">Configure local print agent, cash drawer, and other POS peripherals.</p>
      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <h4>Local print agent</h4>
        <div className="form two-col">
          <label>
            Agent URL
            <input
              value={accessories.agentUrl || ""}
              onChange={(e) => updateField("agentUrl", e.target.value)}
              placeholder="http://127.0.0.1:7357"
            />
          </label>
          <label>
            Token (optional)
            <input
              value={accessories.token || ""}
              onChange={(e) => updateField("token", e.target.value)}
              placeholder="Shared secret"
            />
          </label>
        </div>
        <div className="grid two-col">
          {sizeOptions.map((opt) => (
            <label key={opt.value}>
              Default printer ({opt.label})
              <input
                value={accessories.defaultPrinters?.[opt.value] || ""}
                onChange={(e) => updatePrinter(opt.value, e.target.value)}
                placeholder="Printer name"
              />
            </label>
          ))}
        </div>
        <div className="form-actions" style={{ justifyContent: "flex-start", gap: 8 }}>
          <button className="btn ghost" type="button" onClick={handleTestPrint} disabled={testing}>
            {testing ? "Testing..." : "Test print"}
          </button>
          <button className="btn primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="card">
        <h4>QZ Tray (desktop silent printing)</h4>
        <div className="form two-col">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!accessories.qzEnabled}
              onChange={(e) => updateField("qzEnabled", e.target.checked)}
            />
            <span>Enable QZ Tray</span>
          </label>
          <label>
            QZ script URL
            <input
              value={accessories.qzScriptUrl || ""}
              onChange={(e) => updateField("qzScriptUrl", e.target.value)}
              placeholder="/qz-tray.js (local copy)"
            />
          </label>
        </div>
        <div className="form two-col">
          <label>
            Signature algorithm
            <select
              value={accessories.qzSignatureAlgorithm || "SHA512"}
              onChange={(e) => updateField("qzSignatureAlgorithm", e.target.value)}
            >
              <option value="SHA512">SHA512 (QZ demo default)</option>
              <option value="SHA256">SHA256</option>
              <option value="SHA1">SHA1</option>
            </select>
          </label>
        </div>
        <label>
          Certificate (PEM string from QZ Tray)
          <textarea
            rows={3}
            value={accessories.qzCertificate || ""}
            onChange={(e) => updateField("qzCertificate", e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----..."
          />
        </label>
        <label>
          Private key (PEM string for signing)
          <textarea
            rows={3}
            value={accessories.qzPrivateKey || ""}
            onChange={(e) => updateField("qzPrivateKey", e.target.value)}
            placeholder="-----BEGIN PRIVATE KEY-----..."
          />
        </label>
        <p className="muted small">
          Install QZ Tray on the desktop (Windows/macOS/Linux), approve your site certificate, and fill these fields to allow silent printing.
        </p>
        <div className="form-actions" style={{ justifyContent: "flex-start", gap: 8 }}>
          <button className="btn ghost" type="button" onClick={handleTestQzPrint} disabled={testingQz}>
            {testingQz ? "Testing..." : "Test QZ print"}
          </button>
          <button className="btn primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="card">
        <h4>Cash drawer</h4>
        <p className="muted small">If your drawer opens via the printer kick, configure it on the agent side. Here we just store printer defaults.</p>
      </div>
      <div className="card">
        <h4>Barcode scanner</h4>
        <p className="muted small">Ensure the scanner is in keyboard wedge mode; no extra configuration required.</p>
      </div>
    </div>
  );
}
