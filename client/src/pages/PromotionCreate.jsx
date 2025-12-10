import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import api from "../api/http";

const defaultDraft = {
  name: "",
  code: "",
  description: "",
  type: "percent",
  value: 10,
  unitPrice: "",
  scope: {
    products: "",
    categories: "",
    customers: "",
    brands: "",
    employees: "",
    customFields: "",
    channels: ["POS"],
  },
  schedule: {
    start: "",
    end: "",
    days: [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  },
  limits: {
    perOrder: "",
    perCustomer: "",
    totalRedemptions: "",
    stackable: true,
    minQuantity: "",
    priority: 100,
  },
  enabled: true,
};

const typeLabels = {
  percent: "Percent",
  amount: "Fixed amount",
  unit: "Unit price",
  bogo: "Buy X Get Y",
  bundle: "Bundle price",
  shipping: "Free shipping",
};

const hydrateDraftFromPromo = (promo) => {
  const scopes = promo.scopes || promo.scope || {};
  const limits = promo.limits || {};
  return {
    ...defaultDraft,
    name: promo.name || promo.Name || "",
    code: promo.code || promo.Code || "",
    description: promo.description || promo.Description || "",
    unitPrice: promo.unitPrice ?? promo.UnitPrice ?? "",
    type: promo.unitPrice || promo.UnitPrice ? "unit" : promo.type || promo.Type || "percent",
    value: promo.unitPrice || promo.UnitPrice ? "" : promo.value ?? promo.Value ?? 0,
    enabled: promo.enabled ?? promo.Enabled ?? true,
    scope: {
      ...defaultDraft.scope,
      products: scopes.products || [],
      categories: scopes.categories || [],
      customers: scopes.customers || [],
      brands: scopes.brands || [],
      employees: scopes.employees || [],
      customFields: scopes.customFields || [],
      channels: scopes.channels || ["POS"],
    },
    schedule: {
      ...defaultDraft.schedule,
      start: promo.startAt || promo.schedule?.start || null,
      end: promo.endAt || promo.schedule?.end || null,
      days: scopes.days || promo.schedule?.days || [],
      timezone: promo.timezone || promo.schedule?.timezone || defaultDraft.schedule.timezone,
    },
    limits: {
      ...defaultDraft.limits,
      perOrder: limits.perOrder ?? promo.perOrderLimit ?? null,
      perCustomer: limits.perCustomer ?? promo.perCustomerLimit ?? null,
      totalRedemptions: limits.totalRedemptions ?? promo.totalRedemptions ?? null,
      minQuantity: limits.minQuantity ?? promo.minQuantity ?? null,
      priority: promo.priority ?? limits.priority ?? 100,
      stackable: promo.stackable ?? limits.stackable ?? true,
    },
  };
};

export default function PromotionCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [draft, setDraft] = useState(defaultDraft);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [daysSearch, setDaysSearch] = useState("");
  const [categoryHighlight, setCategoryHighlight] = useState(-1);
  const [productHighlight, setProductHighlight] = useState(-1);
  const [customerHighlight, setCustomerHighlight] = useState(-1);
  const [daysHighlight, setDaysHighlight] = useState(-1);
  const [categoryModal, setCategoryModal] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [daysModal, setDaysModal] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [customFieldSearch, setCustomFieldSearch] = useState("");
  const [brandHighlight, setBrandHighlight] = useState(-1);
  const [employeeHighlight, setEmployeeHighlight] = useState(-1);
  const [customFieldHighlight, setCustomFieldHighlight] = useState(-1);
  const [brandModal, setBrandModal] = useState(false);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [customFieldModal, setCustomFieldModal] = useState(false);

  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [categoryProducts, setCategoryProducts] = useState({});
  const [availableCustomers, setAvailableCustomers] = useState([]);
  const availableDays = useMemo(() => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], []);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [availableCustomFields, setAvailableCustomFields] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/api/categories");
        const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
        const names = list
          .map((c) => c.CategoryName || c.name || c.Name)
          .filter(Boolean);
        if (names.length) {
          setAvailableCategories(names);
        } else {
          setAvailableCategories(["General"]);
        }
      } catch (err) {
        console.error("Failed to load categories", err);
        setAvailableCategories(["General"]);
      }
    };
    const fetchBrands = async () => {
      try {
        const res = await api.get("/api/brands");
        const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
        const names = list
          .map((b) => b.BrandName || b.Name || b.name)
          .filter(Boolean)
          .map((v) => String(v));
        setAvailableBrands(names);
      } catch (err) {
        console.error("Failed to load brands", err);
        setAvailableBrands([]);
      }
    };
    const fetchEmployees = async () => {
      try {
        const res = await api.get("/api/employees");
        const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
        const names = list
          .map((e) => e.FirstName || e.firstName || e.Name || e.name || e.Email || e.email)
          .filter(Boolean)
          .map((v) => String(v));
        setAvailableEmployees(names);
      } catch (err) {
        console.error("Failed to load employees", err);
        setAvailableEmployees([]);
      }
    };
    const fetchCustomFields = async () => {
      try {
        const res = await api.get("/api/product-custom-fields");
        const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
        const names = list
          .map((f) => f.FieldName || f.Name || f.name)
          .filter(Boolean)
          .map((v) => String(v));
        setAvailableCustomFields(names);
      } catch (err) {
        console.error("Failed to load custom fields", err);
        setAvailableCustomFields([]);
      }
    };
    const fetchCustomers = async () => {
      try {
        const res = await api.get("/api/customers", { params: { ts: Date.now() } });
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.items || res.data?.customers || res.data?.data || [];
        const names = list
          .map((c) => c.CustomerName || c.Name || c.name || c.Email || c.email || c.CustomerID)
          .filter(Boolean)
          .map((v) => String(v));
        setAvailableCustomers(names);
      } catch (err) {
        console.error("Failed to load customers", err);
        setAvailableCustomers([]);
      }
    };
    const fetchProducts = async () => {
      try {
        const res = await api.get("/api/products", { params: { ts: Date.now() } });
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.items || res.data?.products || res.data?.data || [];
        const names = [];
        const catMap = {};
        list.forEach((p) => {
          const label = p.ProductName || p.Name || p.name || p.SKU || p.Sku || p.ProductID;
          if (!label) return;
          const strLabel = String(label);
          names.push(strLabel);
          const cat = p.CategoryName || p.categoryName || p.Category || p.CategoryID || "Uncategorized";
          if (!catMap[cat]) catMap[cat] = [];
          catMap[cat].push(strLabel);
        });
        setAvailableProducts(names);
        setCategoryProducts(catMap);
      } catch (err) {
        console.error("Failed to load products", err);
        setAvailableProducts([]);
        setCategoryProducts({});
      }
    };
    fetchCategories();
    fetchProducts();
    fetchCustomers();
    fetchBrands();
    fetchEmployees();
    fetchCustomFields();
  }, []);

  useEffect(() => {
    const promoFromState = location.state?.promotion;
    const promoId = searchParams.get("promoId");

    if (promoFromState) {
      setEditingId(promoFromState.id || promoFromState.PromotionID || null);
      setDraft(hydrateDraftFromPromo(promoFromState));
      return;
    }

    if (promoId) {
      const loadPromo = async () => {
        try {
          const { data } = await api.get("/api/promotions");
          const list = Array.isArray(data) ? data : [];
          const found = list.find((p) => String(p.id || p.PromotionID) === String(promoId));
          if (found) {
            setEditingId(found.id || found.PromotionID || null);
            setDraft(hydrateDraftFromPromo(found));
          }
        } catch (err) {
          console.error("Failed to load promotion", err);
        }
      };
      loadPromo();
    }
  }, [location.state, searchParams]);

  const canSave = Boolean((draft?.name || "").trim());

  const toggleSelection = (field, value) => {
    setDraft((prev) => {
      const current = prev.scope[field] || [];
      const list = Array.isArray(current)
        ? current
        : (current || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
      const exists = list.includes(value);
      const nextList = exists ? list.filter((v) => v !== value) : [...list, value];

      const nextScope = { ...prev.scope, [field]: nextList };

      // When adding a category, auto-select its products (user can still deselect products)
      if (field === "categories" && !exists) {
        const productsFromCategory = categoryProducts[value] || [];
        const currentProductsRaw = prev.scope.products || [];
        const currentProducts = Array.isArray(currentProductsRaw)
          ? currentProductsRaw
          : (currentProductsRaw || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
        const merged = Array.from(new Set([...currentProducts, ...productsFromCategory]));
        nextScope.products = merged;
      }

      return { ...prev, scope: nextScope };
    });
  };

  const toggleDay = (value) => {
    setDraft((prev) => {
      const list = prev.schedule.days || [];
      const exists = list.includes(value);
      const next = exists ? list.filter((v) => v !== value) : [...list, value];
      return { ...prev, schedule: { ...prev.schedule, days: next } };
    });
  };

  const handleSave = async () => {
    if (!canSave) {
      setStatus({ type: "error", message: t("promotions.create.validationRequired") });
      return;
    }
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const typeToSend = draft.type === "unit" ? "amount" : draft.type;
      const unitPrice =
        draft.type === "unit" && draft.unitPrice !== "" ? Number(draft.unitPrice) : null;
      const numericValue =
        draft.type === "unit" ? 0 : Number(draft.value !== "" ? draft.value : 0);
      const payload = {
        name: draft.name,
        code: (draft.code || "").trim() || null,
        description: draft.description || null,
        type: typeToSend,
        value: numericValue,
        unitPrice,
        enabled: draft.enabled,
        stackable: draft.limits?.stackable ?? true,
        priority: draft.limits?.priority ?? 100,
        minQuantity: draft.limits?.minQuantity || null,
        perOrderLimit: draft.limits?.perOrder || null,
        perCustomerLimit: draft.limits?.perCustomer || null,
        totalRedemptions: draft.limits?.totalRedemptions || null,
        startAt: draft.schedule?.start || null,
        endAt: draft.schedule?.end || null,
        timezone: draft.schedule?.timezone || null,
        scopes: {
          categories: selectedCategories,
          products: selectedProducts,
          customers: selectedGroups,
          brands: selectedBrands,
          employees: selectedEmployees,
          customFields: selectedCustomFields,
          channels: draft.scope?.channels || [],
          days: draft.schedule?.days || [],
        },
      };
      if (editingId) {
        await api.patch(`/api/promotions/${editingId}`, payload);
      } else {
        await api.post("/api/promotions", payload);
      }
      navigate("/promotions");
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to save promotion";
      setStatus({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const renderDayLabel = (code) => {
    const val = t(`promotions.daysShort.${code}`);
    return val && val !== `promotions.daysShort.${code}` ? val : code;
  };

  const openModal = (type) => {
    setCategoryModal(type === "category");
    setProductModal(type === "product");
    setBrandModal(type === "brand");
    setGroupModal(type === "customer");
    setEmployeeModal(type === "employee");
    setCustomFieldModal(type === "customField");
    setDaysModal(type === "day");
  };

  const renderMultiSelect = ({
    label,
    search,
    setSearch,
    highlight,
    setHighlight,
    selected,
    options,
    onToggle,
    onOpenModal,
    displayFn,
  }) => {
    const normalize = (val = "") =>
      val
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const term = normalize(search);
    const filtered = options.filter((opt) => {
      if (selected.includes(opt)) return false;
      const base = normalize(opt);
      const display = displayFn ? normalize(displayFn(opt)) : base;
      return base.includes(term) || display.includes(term);
    });
    const clampedHighlight =
      highlight >= 0 && highlight < filtered.length ? highlight : -1;

    return (
      <label style={{ position: "relative" }}>
        {label}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlight(-1);
            }}
            placeholder={t("promotions.create.searchPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((prev) =>
                  Math.min(filtered.length - 1, prev + 1)
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((prev) => Math.max(-1, prev - 1));
              } else if (e.key === "Enter") {
                const pick =
                  clampedHighlight >= 0 && filtered[clampedHighlight]
                    ? filtered[clampedHighlight]
                    : filtered.length === 1
                    ? filtered[0]
                    : null;
                if (pick) {
                  e.preventDefault();
                  onToggle(pick);
                  setSearch("");
                  setHighlight(-1);
                }
              } else if (e.key === "Escape") {
                setHighlight(-1);
              }
            }}
          />
          <button
            type="button"
            className="btn ghost"
            style={{ padding: "0.4rem 0.8rem" }}
            onClick={onOpenModal}
          >
            +
          </button>
        </div>
        {filtered.length > 0 && search.trim() && (
          <ul
            className="dropdown-list"
            style={{
              position: "absolute",
              zIndex: 5,
              width: "100%",
              background: "#fff",
              border: "1px solid #d8deff",
              borderRadius: "10px",
              top: "calc(100% + 4px)",
              maxHeight: "220px",
              overflowY: "auto",
              boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)",
              padding: 0,
              listStyle: "none",
            }}
          >
            {filtered.map((opt) => (
              <li
                key={opt}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #eef1ff",
                  background: clampedHighlight >= 0 && filtered[clampedHighlight] === opt ? "#eef2ff" : "transparent",
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onToggle(opt);
                  setSearch("");
                  setHighlight(-1);
                }}
              >
                {displayFn ? displayFn(opt) : opt}
              </li>
            ))}
          </ul>
        )}
        {selected.length > 0 && (
          <div
            className="muted small"
            style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}
          >
            {selected.map((val) => (
              <span
                key={val}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  border: "1px solid #d8deff",
                  borderRadius: "12px",
                  background: "#f5f7ff",
                }}
              >
                {displayFn ? displayFn(val) : val}
                <button
                  type="button"
                  onClick={() => onToggle(val)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#64748b",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                  aria-label={t("common.remove")}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </label>
    );
  };

  const selectedCategories = Array.isArray(draft.scope.categories)
    ? draft.scope.categories
    : (draft.scope.categories || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  const selectedProducts = Array.isArray(draft.scope.products)
    ? draft.scope.products
    : (draft.scope.products || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  const selectedGroups = Array.isArray(draft.scope.customers)
    ? draft.scope.customers
    : (draft.scope.customers || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  const selectedBrands = Array.isArray(draft.scope.brands)
    ? draft.scope.brands
    : (draft.scope.brands || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  const selectedEmployees = Array.isArray(draft.scope.employees)
    ? draft.scope.employees
    : (draft.scope.employees || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  const selectedCustomFields = Array.isArray(draft.scope.customFields)
    ? draft.scope.customFields
    : (draft.scope.customFields || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

  return (
    <div className="page wide promotions-page">
      <header className="list-header">
        <div>
          <h2>{t("promotions.create.title")}</h2>
          <p className="muted">
            {t("promotions.create.subtitle")}
          </p>
        </div>
        <div className="list-actions">
          <button className="btn ghost" type="button" onClick={() => navigate(-1)}>
            {t("common.cancel")}
          </button>
          <button className="btn primary" type="button" onClick={handleSave} disabled={!canSave || saving}>
            {t("promotions.create.save")}
          </button>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="grid two-col" style={{ gap: 16 }}>
        <div className="card">
          <div className="form-grid two-col gap">
            <label>
              {t("promotions.create.name")}
              <input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("promotions.create.namePlaceholder")}
              />
            </label>
            <label>
              {t("promotions.create.code")}
              <input
                value={draft.code}
                onChange={(e) => setDraft((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="HOLIDAY10"
              />
            </label>
          </div>
          <label>
            {t("promotions.create.description")}
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={t("promotions.create.descriptionPlaceholder")}
            />
          </label>
          <div className="form-grid three-col gap">
            <label>
              {t("promotions.create.type")}
              <select
                value={draft.type}
                onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}
              >
                {Object.entries(typeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {draft.type === "unit" ? (
              <label>
                Unit price
                <input
                  type="number"
                  value={draft.unitPrice}
                  onChange={(e) => setDraft((prev) => ({ ...prev, unitPrice: e.target.value }))}
                  placeholder="e.g. 500"
                  min="0"
                  step="0.01"
                />
              </label>
            ) : (
              <label>
                {t("promotions.create.value")}
                <input
                  type="number"
                  value={draft.value}
                  onChange={(e) => setDraft((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder="10"
                  min="0"
                  step="0.01"
                />
              </label>
            )}
            <label className="checkbox" style={{ marginTop: 22 }}>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <span>{t("promotions.create.enableOnSave")}</span>
            </label>
          </div>
        </div>

        <div className="card">
          <h4>{t("promotions.create.scopeTitle")}</h4>
          <div className="form-grid two-col gap">
            {renderMultiSelect({
              label: t("promotions.create.categories"),
              search: categorySearch,
              setSearch: setCategorySearch,
              highlight: categoryHighlight,
              setHighlight: setCategoryHighlight,
              selected: selectedCategories,
              options: availableCategories,
              onToggle: (val) => toggleSelection("categories", val),
              onOpenModal: () => openModal("category"),
            })}
            {renderMultiSelect({
              label: t("promotions.create.products"),
              search: productSearch,
              setSearch: setProductSearch,
              highlight: productHighlight,
              setHighlight: setProductHighlight,
              selected: selectedProducts,
              options: availableProducts,
              onToggle: (val) => toggleSelection("products", val),
              onOpenModal: () => openModal("product"),
            })}
            {renderMultiSelect({
              label: t("promotions.create.brands"),
              search: brandSearch,
              setSearch: setBrandSearch,
              highlight: brandHighlight,
              setHighlight: setBrandHighlight,
              selected: selectedBrands,
              options: availableBrands,
              onToggle: (val) => toggleSelection("brands", val),
              onOpenModal: () => openModal("brand"),
            })}
            {renderMultiSelect({
              label: t("promotions.create.customers"),
              search: groupSearch,
              setSearch: setGroupSearch,
              highlight: customerHighlight,
              setHighlight: setCustomerHighlight,
              selected: selectedGroups,
              options: availableCustomers,
              onToggle: (val) => toggleSelection("customers", val),
              onOpenModal: () => openModal("customer"),
            })}
            {renderMultiSelect({
              label: t("promotions.create.employees"),
              search: employeeSearch,
              setSearch: setEmployeeSearch,
              highlight: employeeHighlight,
              setHighlight: setEmployeeHighlight,
              selected: selectedEmployees,
              options: availableEmployees,
              onToggle: (val) => toggleSelection("employees", val),
              onOpenModal: () => openModal("employee"),
            })}
            {renderMultiSelect({
              label: t("promotions.create.customFields"),
              search: customFieldSearch,
              setSearch: setCustomFieldSearch,
              highlight: customFieldHighlight,
              setHighlight: setCustomFieldHighlight,
              selected: selectedCustomFields,
              options: availableCustomFields,
              onToggle: (val) => toggleSelection("customFields", val),
              onOpenModal: () => openModal("customField"),
            })}
            <label>
              {t("promotions.create.channels")}
              <select
                value={draft.scope.channels[0] || "POS"}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    scope: { ...prev.scope, channels: [e.target.value] },
                  }))
                }
              >
                <option value="POS">POS</option>
                <option value="Online">Online</option>
                <option value="Mobile">Mobile</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <h4>{t("promotions.create.scheduleTitle")}</h4>
          <div className="form-grid two-col gap">
            <label>
              {t("promotions.create.start")}
              <input
                type="datetime-local"
                value={draft.schedule.start}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    schedule: { ...prev.schedule, start: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              {t("promotions.create.end")}
              <input
                type="datetime-local"
                value={draft.schedule.end}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    schedule: { ...prev.schedule, end: e.target.value },
                  }))
                }
              />
            </label>
          </div>
          {renderMultiSelect({
            label: t("promotions.create.daysOfWeek"),
            search: daysSearch,
            setSearch: setDaysSearch,
            highlight: daysHighlight,
            setHighlight: setDaysHighlight,
            selected: draft.schedule.days || [],
            options: availableDays,
            onToggle: toggleDay,
            onOpenModal: () => setDaysModal(true),
            displayFn: renderDayLabel,
          })}
          <label>
            {t("promotions.create.timezone")}
            <input
              value={draft.schedule.timezone}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  schedule: { ...prev.schedule, timezone: e.target.value },
                }))
              }
            />
          </label>
        </div>

        <div className="card">
          <h4>{t("promotions.create.limitsTitle")}</h4>
          <div className="form-grid three-col gap">
            <label>
              {t("promotions.create.perOrder")}
              <input
                type="number"
                value={draft.limits.perOrder}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    limits: { ...prev.limits, perOrder: e.target.value },
                  }))
                }
                placeholder="e.g. 1"
              />
            </label>
            <label>
              {t("promotions.create.perCustomer")}
              <input
                type="number"
                value={draft.limits.perCustomer}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    limits: { ...prev.limits, perCustomer: e.target.value },
                  }))
                }
                placeholder="e.g. 5"
              />
            </label>
            <label>
              {t("promotions.create.totalRedemptions")}
              <input
                type="number"
                value={draft.limits.totalRedemptions}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    limits: { ...prev.limits, totalRedemptions: e.target.value },
                  }))
                }
                placeholder="e.g. 500"
              />
            </label>
            <label>
              {t("promotions.create.minQuantity")}
              <input
                type="number"
                value={draft.limits.minQuantity}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    limits: { ...prev.limits, minQuantity: e.target.value },
                  }))
                }
                placeholder="e.g. 3"
              />
            </label>
          </div>
          <div className="form-grid two-col gap">
            <label>
              {t("promotions.create.priority")}
              <input
                type="number"
                value={draft.limits.priority}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    limits: { ...prev.limits, priority: Number(e.target.value || 0) },
                  }))
                }
              />
            </label>
            <label className="checkbox" style={{ marginTop: 24 }}>
              <input
                type="checkbox"
                checked={draft.limits.stackable}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    limits: { ...prev.limits, stackable: e.target.checked },
                  }))
                }
              />
              <span>{t("promotions.create.stackable")}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="form-actions" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button className="btn ghost" type="button" onClick={() => navigate(-1)}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" type="button" onClick={handleSave} disabled={!canSave || saving}>
          {t("promotions.create.save")}
        </button>
      </div>

      {(categoryModal ||
        productModal ||
        brandModal ||
        groupModal ||
        employeeModal ||
        customFieldModal ||
        daysModal) && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <h3>{t("promotions.create.pickItems")}</h3>
            <p className="muted small">{t("promotions.create.pickHint")}</p>
            <div className="modal-body">
            {(categoryModal && (
              <CheckboxList
                title={t("promotions.create.categories")}
                options={availableCategories}
                selected={selectedCategories}
                onToggle={(v) => toggleSelection("categories", v)}
              />
            )) ||
              (productModal && (
                <CheckboxList
                  title={t("promotions.create.products")}
                  options={availableProducts}
                  selected={selectedProducts}
                  onToggle={(v) => toggleSelection("products", v)}
                />
              )) ||
              (brandModal && (
                <CheckboxList
                  title={t("promotions.create.brands")}
                  options={availableBrands}
                  selected={selectedBrands}
                  onToggle={(v) => toggleSelection("brands", v)}
                />
              )) ||
              (groupModal && (
                <CheckboxList
                  title={t("promotions.create.customers")}
                  options={availableCustomers}
                  selected={selectedGroups}
                  onToggle={(v) => toggleSelection("customers", v)}
                />
              )) ||
              (employeeModal && (
                <CheckboxList
                  title={t("promotions.create.employees")}
                  options={availableEmployees}
                  selected={selectedEmployees}
                  onToggle={(v) => toggleSelection("employees", v)}
                />
              )) ||
              (customFieldModal && (
                <CheckboxList
                  title={t("promotions.create.customFields")}
                  options={availableCustomFields}
                  selected={selectedCustomFields}
                  onToggle={(v) => toggleSelection("customFields", v)}
                />
              )) ||
                (daysModal && (
                  <CheckboxList
                    title={t("promotions.create.daysOfWeek")}
                    options={availableDays}
                    selected={draft.schedule.days || []}
                    onToggle={toggleDay}
                    displayFn={renderDayLabel}
                  />
                ))}
            </div>
            <div className="form-actions" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  openModal(null);
                }}
              >
                {t("common.done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckboxList({ title, options, selected, onToggle, displayFn }) {
  const [search, setSearch] = useState("");
  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h4>{title}</h4>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        style={{ width: "100%", margin: "8px 0", padding: "0.5rem", borderRadius: "8px", border: "1px solid #d8deff" }}
      />
      <div
        style={{
          maxHeight: 260,
          overflowY: "auto",
          border: "1px solid #eef1ff",
          borderRadius: "10px",
          padding: "8px",
        }}
      >
        {filtered.map((opt) => (
          <label
            key={opt}
            className="checkbox"
            style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr",
              alignItems: "center",
              gap: 8,
              padding: "6px 4px",
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => onToggle(opt)}
              style={{ margin: 0, justifySelf: "start" }}
            />
            <span>{displayFn ? displayFn(opt) : opt}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="muted small">No results</p>}
      </div>
    </div>
  );
}
