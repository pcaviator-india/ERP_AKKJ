import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import api from "../api/http";

const TYPE_OPTIONS = [
  { value: "Text", dbValue: "Text", label: "Text" },
  { value: "Select", dbValue: "Select", label: "Select" },
  { value: "Number", dbValue: "Number", label: "Number" },
  { value: "Boolean", dbValue: "Boolean", label: "Boolean" },
  { value: "Date", dbValue: "Date", label: "Date" },
  { value: "JSON", dbValue: "JSON", label: "JSON" },
];

export default function ProductCustomFields() {
  const { t } = useLanguage();
  const [fields, setFields] = useState([]);
  const [draft, setDraft] = useState({ label: "", type: "Text", options: "" });
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = `${t("nav.customFields")} - ${t("products.title")}`;
  }, [t]);

  useEffect(() => {
    const loadFields = async () => {
      setLoading(true);
      setStatus({ type: "", message: "" });
      try {
        const { data } = await api.get("/api/custom-fields/product");
        setFields(
          (data || []).map((f) => ({
            id: f.id,
            localId: null,
            label: f.label,
            type: f.type === "JSON" ? "Select" : f.type,
            options: f.options || [],
            visible: f.visible ?? 1,
            required: f.required ?? false,
          }))
        );
      } catch (err) {
        console.error("Failed to load custom fields", err);
        setStatus({ type: "error", message: t("customFields.loadError") });
      } finally {
        setLoading(false);
      }
    };
    loadFields();
  }, [t]);

  const resetDraft = () => {
    setDraft({ label: "", type: "Text", options: "" });
    setEditingId(null);
  };

  const handleSave = () => {
    setStatus({ type: "", message: "" });
    const label = draft.label.trim();
    const optionsArray =
      draft.type === "Select"
        ? (draft.options || "")
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : [];
    if (!label) {
      setStatus({ type: "error", message: t("customFields.labelRequired") });
      return;
    }
    if (
      fields.some(
        (f) =>
          f.label.toLowerCase() === label.toLowerCase() &&
          (f.id ?? f.localId) !== editingId
      )
    ) {
      setStatus({ type: "error", message: t("customFields.labelExists") });
      return;
    }

    if (editingId) {
      setFields((prev) =>
        prev.map((f) =>
          (f.id ?? f.localId) === editingId ? { ...f, label, type: draft.type, options: optionsArray } : f
        )
      );
      persist(
        fields.map((f) =>
          (f.id ?? f.localId) === editingId ? { ...f, label, type: draft.type, options: optionsArray } : f
        )
      );
      setStatus({ type: "success", message: t("customFields.updated") });
    } else {
      const next = [
        ...fields,
        {
          id: null,
          localId: crypto.randomUUID(),
          label,
          type: draft.type,
          options: optionsArray,
          visible: true,
          required: false,
        },
      ];
      setFields(next);
      persist(next);
      setStatus({ type: "success", message: t("customFields.created") });
    }
    resetDraft();
  };

  const startEdit = (field) => {
    setEditingId(field.id ?? field.localId);
    setDraft({
      label: field.label,
      type: field.type,
      options: Array.isArray(field.options) ? field.options.join(", ") : field.options || "",
    });
    setStatus({ type: "", message: "" });
  };

  const persist = async (nextFields, deletedIds = []) => {
    setStatus({ type: "", message: "" });
    try {
      const payload = nextFields.map((f) => ({
        id: Number.isInteger(f.id) ? f.id : null,
        label: f.label,
        type: (TYPE_OPTIONS.find((o) => o.value === f.type)?.dbValue) || "Text",
        visible: f.visible ? 1 : 0,
        options:
          f.type === "Select"
            ? (Array.isArray(f.options) ? f.options : (f.options || "").split(",").map((o) => o.trim()).filter(Boolean))
            : [],
      }));
      const { data } = await api.post("/api/custom-fields/product/bulk", {
        definitions: payload,
        deletedIds,
      });
      const merged = (data.definitions || []).map((f) => ({
        id: f.id,
        localId: null,
        label: f.label,
        type: f.type === "JSON" ? "Select" : f.type,
        options: [],
        visible: f.visible,
        required: false,
      }));
      setFields(merged);
      resetDraft();
      setStatus({ type: "success", message: t("customFields.saved") });
    } catch (err) {
      console.error("Failed to save custom fields", err);
      setStatus({ type: "error", message: t("customFields.saveError") });
    }
  };

  const toggleField = async (id, key) => {
    const next = fields.map((f) => {
      const match = f.id === id || f.localId === id;
      return match ? { ...f, [key]: !f[key] } : f;
    });
    setFields(next);
    await persist(next);
  };

  const removeField = (id) => {
    const target = fields.find((f) => f.id === id || f.localId === id);
    const remaining = fields.filter((f) => f.id !== id && f.localId !== id);
    setFields(remaining);
    if (editingId === id) resetDraft();
    const deletedIds = target && Number.isInteger(target.id) ? [target.id] : [];
    persist(remaining, deletedIds);
  };

  const typeOptions = useMemo(
    () => TYPE_OPTIONS.map((o) => ({ ...o, label: t(`customFields.type.${o.value}`) || o.label })),
    [t]
  );

  const saveAll = async () => persist(fields);

  return (
    <div className="page product-page">
      <div className="list-header">
        <div>
          <h2>{t("nav.customFields")}</h2>
          <p className="muted">
            {t("customFields.subtitle", "Manage product-specific custom attributes.")}
          </p>
        </div>
      </div>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <div className="grid three">
          <label>
            {t("customFields.label")}
            <input
              value={draft.label || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
              placeholder={t("customFields.addLabelPlaceholder")}
            />
          </label>
          <label>
            {t("customFields.typeLabel")}
            <select
              value={draft.type || "Text"}
              onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {draft.type === "Select" && (
            <label>
              {t("customFields.optionsLabel")}
              <input
                value={draft.options || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, options: e.target.value }))}
                placeholder={t("customFields.optionsPlaceholder")}
              />
            </label>
          )}
        </div>
        <div className="form-actions">
          <button className="btn primary" type="button" onClick={handleSave}>
            {editingId ? t("customFields.updateField") : t("customFields.addField")}
          </button>
          {editingId && (
            <button className="btn ghost" type="button" onClick={resetDraft}>
              {t("customFields.cancelEdit")}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>{t("customFields.listTitle", "Defined fields")}</h3>
        {fields.length === 0 ? (
          <p className="muted">{t("customFields.empty", "No custom fields yet.")}</p>
        ) : (
          <div className="table">
            <div className="table-head">
              <span>{t("customFields.label")}</span>
              <span>{t("customFields.typeLabel")}</span>
              <span>{t("customFields.required")}</span>
              <span>{t("customFields.visible")}</span>
              <span>{t("customFields.actions")}</span>
            </div>
            {fields.map((f) => {
              const key = f.id ?? f.localId;
              return (
                <div className="table-row" key={key}>
                  <span>{f.label}</span>
                  <span>{typeOptions.find((o) => o.value === f.type)?.label || f.type}</span>
                  <span>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={() => toggleField(key, "required")}
                      />
                    </label>
                  </span>
                  <span>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={f.visible}
                        onChange={() => toggleField(key, "visible")}
                      />
                    </label>
                  </span>
                  <span className="table-actions">
                    <button className="btn ghost" type="button" onClick={() => startEdit(f)}>
                      {t("customFields.edit")}
                    </button>
                    <button className="btn ghost danger" type="button" onClick={() => removeField(key)}>
                      {t("customFields.delete")}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
