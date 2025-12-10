import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/http";

const deriveStatus = (promo) => {
  if (!promo.enabled) return "Paused";
  const now = new Date();
  const start = promo.schedule?.start ? new Date(promo.schedule.start) : null;
  const end = promo.schedule?.end ? new Date(promo.schedule.end) : null;
  if (start && now < start) return "Scheduled";
  if (end && now > end) return "Expired";
  return "Active";
};

const typeLabels = {
  percent: "Percent",
  amount: "Fixed amount",
  unit: "Unit price",
  bogo: "Buy X Get Y",
  bundle: "Bundle price",
  shipping: "Free shipping",
};

const joinValues = (val) => {
  if (!val) return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
};

export default function PromotionsPage() {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState([]);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Discounts & Promotions";
  }, []);

  useEffect(() => {
    const fetchPromotions = async () => {
      setLoading(true);
      setStatus({ type: "", message: "" });
      try {
        const { data } = await api.get("/api/promotions");
        const normalized = (Array.isArray(data) ? data : []).map((p) => {
          const scopes = p.scopes || p.scope || {};
          const limits = p.limits || {};
          return {
            id: p.id || p.PromotionID,
            name: p.name || p.Name,
            code: p.code || p.Code,
            description: p.description || p.Description,
            type: p.type || p.Type || "percent",
            value: p.value ?? p.Value ?? 0,
            unitPrice: p.unitPrice ?? p.UnitPrice ?? null,
            enabled: p.enabled ?? p.Enabled ?? true,
            stackable: p.stackable ?? p.Stackable ?? true,
            priority: p.priority ?? p.Priority ?? 100,
            scope: {
              products: scopes.products || [],
              categories: scopes.categories || [],
              customers: scopes.customers || [],
              brands: scopes.brands || [],
              employees: scopes.employees || [],
              customFields: scopes.customFields || [],
              channels: scopes.channels || [],
            },
            schedule: {
              start: p.startAt || p.schedule?.start || null,
              end: p.endAt || p.schedule?.end || null,
              days: scopes.days || p.schedule?.days || [],
              timezone:
                p.timezone ||
                p.schedule?.timezone ||
                Intl.DateTimeFormat().resolvedOptions().timeZone ||
                "UTC",
            },
            limits: {
              perOrder: limits.perOrder ?? p.perOrderLimit ?? null,
              perCustomer: limits.perCustomer ?? p.perCustomerLimit ?? null,
              totalRedemptions: limits.totalRedemptions ?? p.totalRedemptions ?? null,
              minQuantity: limits.minQuantity ?? p.minQuantity ?? null,
              priority: p.priority ?? limits.priority ?? 100,
              stackable: p.stackable ?? limits.stackable ?? true,
            },
            createdAt: p.createdAt || p.CreatedAt,
          };
        });
        setPromotions(normalized);
      } catch (err) {
        console.error("Failed to load promotions", err);
        setStatus({ type: "error", message: "Failed to load promotions" });
      } finally {
        setLoading(false);
      }
    };
    fetchPromotions();
  }, []);

  const filtered = useMemo(() => {
    return promotions
      .filter((p) => {
        const name = (p.name || "").toString();
        const code = (p.code || "").toString();
        const effectiveType = p.unitPrice ? "unit" : p.type;
        const matchesSearch =
          !search.trim() ||
          name.toLowerCase().includes(search.toLowerCase()) ||
          code.toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === "all" ? true : deriveStatus(p).toLowerCase() === statusFilter;
        const matchesType = typeFilter === "all" ? true : effectiveType === typeFilter;
        const matchesChannel =
          channelFilter === "all"
            ? true
            : Array.isArray(p.scope?.channels) && p.scope.channels.includes(channelFilter);
        return matchesSearch && matchesStatus && matchesType && matchesChannel;
      })
      .sort((a, b) => (b.limits?.priority || 0) - (a.limits?.priority || 0));
  }, [promotions, search, statusFilter, typeFilter, channelFilter]);

  const openCreate = () => {
    navigate("/promotions/new");
  };

  const openEdit = (promo) => {
    navigate(`/promotions/new?promoId=${promo.id}`, { state: { promotion: promo } });
  };

  const toggleEnabled = async (promo, e) => {
    if (e) e.stopPropagation();
    const next = !promo.enabled;
    try {
      await api.patch(`/api/promotions/${promo.id}`, { enabled: next });
      setPromotions((prev) => prev.map((p) => (p.id === promo.id ? { ...p, enabled: next } : p)));
      setStatus({ type: "success", message: `Promotion ${next ? "enabled" : "disabled"}.` });
    } catch (err) {
      console.error("Failed to toggle promotion", err);
      setStatus({ type: "error", message: "Could not update promotion state." });
    }
  };

  const handleDelete = async (promo, e) => {
    if (e) e.stopPropagation();
    try {
      await api.delete(`/api/promotions/${promo.id}`);
      setPromotions((prev) => prev.filter((p) => p.id !== promo.id));
      setStatus({ type: "success", message: "Promotion deleted." });
    } catch (err) {
      console.error("Failed to delete promotion", err);
      setStatus({ type: "error", message: "Could not delete promotion." });
    }
  };

  return (
    <div className="page wide promotions-page">
      <header className="list-header">
        <div>
          <h2>Discounts & Promotions</h2>
          <p className="muted">
            Configure time-bound deals, order-level discounts, and product-specific campaigns.
          </p>
        </div>
        <div className="list-actions">
          <button className="btn secondary" onClick={() => navigate("/promotions/new")}>
            New promotion
          </button>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <div className="form-grid three-col gap">
          <label>
            Search
            <input
              placeholder="Name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
              <option value="paused">Paused</option>
            </select>
          </label>
          <label>
            Type
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All</option>
              {Object.entries(typeLabels).map(([key, label]) => {
                if (key === "unit") return null;
                return (
                  <option key={key} value={key}>
                    {label}
                  </option>
                );
              })}
              <option value="unit">{typeLabels.unit}</option>
            </select>
          </label>
          <label>
            Channel
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="POS">POS</option>
              <option value="Online">Online</option>
              <option value="Mobile">Mobile</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="table">
          <div
            className="table-head"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 0.9fr 1fr 1fr 0.8fr 0.8fr",
              alignItems: "center",
            }}
          >
            <span>Name</span>
            <span>Type</span>
            <span>Scope</span>
            <span>Schedule</span>
            <span>Status</span>
            <span />
          </div>
          {filtered.map((p) => {
            const state = deriveStatus(p);
            const effectiveType = p.unitPrice ? "unit" : p.type;
            const scopeLabel =
              joinValues(p.scope?.categories) ||
              joinValues(p.scope?.products) ||
              joinValues(p.scope?.customers) ||
              joinValues(p.scope?.brands) ||
              joinValues(p.scope?.employees) ||
              joinValues(p.scope?.customFields) ||
              joinValues(p.scope?.channels) ||
              "All";
            const scheduleLabel =
              p.schedule?.start || p.schedule?.end
                ? `${p.schedule.start ? new Date(p.schedule.start).toLocaleDateString() : "Now"} -> ${
                    p.schedule.end ? new Date(p.schedule.end).toLocaleDateString() : "Open"
                  }`
                : p.schedule?.days?.length
                ? `Days: ${p.schedule.days.join(", ")}`
                : "Always on";
            return (
              <div
                className="table-row"
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.9fr 1fr 1fr 0.8fr 0.8fr",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="muted small">{p.code}</div>
                </div>
                <div className="muted small">{typeLabels[effectiveType] || effectiveType}</div>
                <div className="muted small">{scopeLabel}</div>
                <div className="muted small">{scheduleLabel}</div>
                <div>
                  <span className={`pill ${state.toLowerCase()}`}>{state}</span>
                </div>
                <div className="list-actions inline" style={{ justifyContent: "flex-end", gap: 8 }}>
                  <button
                    className="btn ghost small"
                    title="Edit"
                    aria-label="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(p);
                    }}
                  >
                    {"\u270E"}
                  </button>
                  <button
                    className="btn ghost small"
                    title={p.enabled ? "Disable" : "Enable"}
                    aria-label={p.enabled ? "Disable" : "Enable"}
                    onClick={(e) => toggleEnabled(p, e)}
                  >
                    {p.enabled ? "\u23F8" : "\u25B6"}
                  </button>
                  <button
                    className="btn ghost small"
                    title="Delete"
                    aria-label="Delete"
                    onClick={(e) => handleDelete(p, e)}
                  >
                    {"\u{1F5D1}"}
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="muted small mt-8">No promotions match the filters.</p>}
        </div>
      </div>
    </div>
  );
}
