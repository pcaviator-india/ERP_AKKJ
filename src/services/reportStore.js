const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const STORE_DIR = path.join(__dirname, "..", "..", "config");
const STORE_PATH = path.join(STORE_DIR, "reports.json");

const DEFAULT_TIMEZONE = "America/Santiago";

const defaultTemplates = [
  {
    id: "daily-sales",
    category: "sales",
    title: "Daily sales performance",
    description: "Compare day-over-day sales with taxes, channel mix, and targets.",
    tags: ["Sales", "Daily"],
    owner: "Sales ops",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "order_date", alias: "order_date" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
    ],
    groupBy: ["order_date"],
    sort: [{ field: "order_date", direction: "asc" }],
    limit: 500,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Daily sales performance",
      description: "Compare day-over-day sales with taxes, channel mix, and targets.",
      tags: ["Sales", "Daily"],
      owner: "Sales ops",
      version: "1.0.0",
    },
  },
  {
    id: "promo-roi",
    category: "sales",
    title: "Promotion ROI by channel",
    description: "Measure promotion returns by channel and tax exclusive totals.",
    tags: ["Sales", "Promotions"],
    owner: "Sales ops",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "channel", alias: "channel" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
      { field: "net_total", agg: "SUM", alias: "net_total" },
    ],
    groupBy: ["channel"],
    sort: [{ field: "gross_total", direction: "desc" }],
    limit: 200,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Promotion ROI by channel",
      description: "Measure promotion returns by channel and tax exclusive totals.",
      tags: ["Sales", "Promotions"],
      owner: "Sales ops",
      version: "1.0.0",
    },
  },
  {
    id: "customer-trends",
    category: "sales",
    title: "Customer purchase trends",
    description: "Track customer segments and spend over time.",
    tags: ["Sales", "Customers"],
    owner: "Customer success",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "customer_id", alias: "customer_id" },
      { field: "order_date", alias: "order_date" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
    ],
    groupBy: ["customer_id", "order_date"],
    sort: [{ field: "order_date", direction: "asc" }],
    limit: 500,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Customer purchase trends",
      description: "Track customer segments and spend over time.",
      tags: ["Sales", "Customers"],
      owner: "Customer success",
      version: "1.0.0",
    },
  },
  {
    id: "low-stock",
    category: "inventory",
    title: "Low stock snapshot",
    description: "Identify products approaching low inventory thresholds by warehouse.",
    tags: ["Inventory", "Alerts"],
    owner: "Inventory control",
    version: "1.0.0",
    source: "inventory_balances",
    select: [
      { field: "snapshot_date", alias: "snapshot_date" },
      { field: "warehouse_id", alias: "warehouse_id" },
      { field: "product_id", alias: "product_id" },
      { field: "stock_on_hand", alias: "stock_on_hand" },
    ],
    filters: [
      { field: "stock_on_hand", operator: "lt", value: 10 },
    ],
    groupBy: ["warehouse_id", "product_id", "snapshot_date"],
    sort: [{ field: "stock_on_hand", direction: "asc" }],
    limit: 200,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Low stock snapshot",
      description: "Identify products approaching low inventory thresholds by warehouse.",
      tags: ["Inventory", "Alerts"],
      owner: "Inventory control",
      version: "1.0.0",
    },
  },
  {
    id: "aging",
    category: "inventory",
    title: "Inventory aging by lot",
    description: "Spot aging inventory by lot expiry and stock position.",
    tags: ["Inventory", "Aging"],
    owner: "Inventory control",
    version: "1.0.0",
    source: "inventory_balances",
    select: [
      { field: "snapshot_date", alias: "snapshot_date" },
      { field: "lot_expiry", alias: "lot_expiry" },
      { field: "product_id", alias: "product_id" },
      { field: "stock_on_hand", alias: "stock_on_hand" },
    ],
    groupBy: ["snapshot_date", "lot_expiry", "product_id"],
    sort: [{ field: "lot_expiry", direction: "asc" }],
    limit: 200,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Inventory aging by lot",
      description: "Spot aging inventory by lot expiry and stock position.",
      tags: ["Inventory", "Aging"],
      owner: "Inventory control",
      version: "1.0.0",
    },
  },
  {
    id: "supplier-performance",
    category: "inventory",
    title: "Supplier performance",
    description: "Measure stock availability by warehouse and product mix.",
    tags: ["Inventory", "Supply"],
    owner: "Inventory control",
    version: "1.0.0",
    source: "inventory_balances",
    select: [
      { field: "warehouse_id", alias: "warehouse_id" },
      { field: "product_id", alias: "product_id" },
      { field: "stock_on_hand", agg: "SUM", alias: "stock_on_hand" },
    ],
    groupBy: ["warehouse_id", "product_id"],
    sort: [{ field: "stock_on_hand", direction: "desc" }],
    limit: 200,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Supplier performance",
      description: "Measure stock availability by warehouse and product mix.",
      tags: ["Inventory", "Supply"],
      owner: "Inventory control",
      version: "1.0.0",
    },
  },
  {
    id: "profit-loss",
    category: "finance",
    title: "Profit and loss summary",
    description: "Aggregate revenue, cost, and margin by period.",
    tags: ["Finance", "P&L"],
    owner: "Finance",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "order_date", alias: "order_date" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
      { field: "net_total", agg: "SUM", alias: "net_total" },
      { field: "tax_total", agg: "SUM", alias: "tax_total" },
    ],
    groupBy: ["order_date"],
    sort: [{ field: "order_date", direction: "asc" }],
    limit: 500,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Profit and loss summary",
      description: "Aggregate revenue, cost, and margin by period.",
      tags: ["Finance", "P&L"],
      owner: "Finance",
      version: "1.0.0",
    },
  },
  {
    id: "tax-liability",
    category: "finance",
    title: "Tax liability report",
    description: "Summarize tax totals by period and channel.",
    tags: ["Finance", "Tax"],
    owner: "Finance",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "order_date", alias: "order_date" },
      { field: "tax_total", agg: "SUM", alias: "tax_total" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
    ],
    groupBy: ["order_date"],
    sort: [{ field: "order_date", direction: "asc" }],
    limit: 500,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Tax liability report",
      description: "Summarize tax totals by period and channel.",
      tags: ["Finance", "Tax"],
      owner: "Finance",
      version: "1.0.0",
    },
  },
  {
    id: "cash-flow",
    category: "finance",
    title: "Cash flow summary",
    description: "Monitor payments received by method and status.",
    tags: ["Finance", "Cash flow"],
    owner: "Finance",
    version: "1.0.0",
    source: "payments",
    select: [
      { field: "payment_date", alias: "payment_date" },
      { field: "method", alias: "method" },
      { field: "amount", agg: "SUM", alias: "amount" },
    ],
    groupBy: ["payment_date", "method"],
    sort: [{ field: "payment_date", direction: "asc" }],
    limit: 365,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Cash flow summary",
      description: "Monitor payments received by method and status.",
      tags: ["Finance", "Cash flow"],
      owner: "Finance",
      version: "1.0.0",
    },
  },
  {
    id: "staff-productivity",
    category: "operations",
    title: "Staff productivity",
    description: "Track sales volume and order counts by employee.",
    tags: ["Operations", "Staff"],
    owner: "Operations",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "employee_id", alias: "employee_id" },
      { field: "order_date", alias: "order_date" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
      { field: "channel", agg: "COUNT", alias: "order_count" },
    ],
    groupBy: ["employee_id", "order_date"],
    sort: [{ field: "order_date", direction: "asc" }],
    limit: 200,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Staff productivity",
      description: "Track sales volume and order counts by employee.",
      tags: ["Operations", "Staff"],
      owner: "Operations",
      version: "1.0.0",
    },
  },
  {
    id: "voids-refunds",
    category: "operations",
    title: "Voids and refunds",
    description: "Audit transaction voids and refunds by channel.",
    tags: ["Operations", "Audit"],
    owner: "Operations",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "order_date", alias: "order_date" },
      { field: "status", alias: "status" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
    ],
    filters: [
      { field: "status", operator: "in", value: ["Voided", "Refunded"] },
    ],
    groupBy: ["order_date", "status"],
    sort: [{ field: "order_date", direction: "desc" }],
    limit: 120,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Voids and refunds",
      description: "Audit transaction voids and refunds by channel.",
      tags: ["Operations", "Audit"],
      owner: "Operations",
      version: "1.0.0",
    },
  },
  {
    id: "order-latency",
    category: "operations",
    title: "Order latency",
    description: "Measure time between order capture and fulfillment.",
    tags: ["Operations", "Latency"],
    owner: "Operations",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "order_date", alias: "order_date" },
      { field: "status", alias: "status" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
    ],
    groupBy: ["order_date", "status"],
    sort: [{ field: "order_date", direction: "asc" }],
    limit: 200,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Order latency",
      description: "Measure time between order capture and fulfillment.",
      tags: ["Operations", "Latency"],
      owner: "Operations",
      version: "1.0.0",
    },
  },
  {
    id: "invoice-status",
    category: "compliance",
    title: "Invoice status",
    description: "Audit invoice issuance and outstanding balances.",
    tags: ["Compliance", "Invoices"],
    owner: "Finance",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "order_date", alias: "order_date" },
      { field: "status", alias: "status" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
    ],
    groupBy: ["order_date", "status"],
    sort: [{ field: "order_date", direction: "desc" }],
    limit: 180,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Invoice status",
      description: "Audit invoice issuance and outstanding balances.",
      tags: ["Compliance", "Invoices"],
      owner: "Finance",
      version: "1.0.0",
    },
  },
  {
    id: "price-audits",
    category: "compliance",
    title: "Price audit trail",
    description: "Review price overrides and discount impact.",
    tags: ["Compliance", "Pricing"],
    owner: "Finance",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "channel", alias: "channel" },
      { field: "order_date", alias: "order_date" },
      { field: "gross_total", agg: "SUM", alias: "gross_total" },
    ],
    groupBy: ["channel", "order_date"],
    sort: [{ field: "order_date", direction: "desc" }],
    limit: 365,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "Price audit trail",
      description: "Review price overrides and discount impact.",
      tags: ["Compliance", "Pricing"],
      owner: "Finance",
      version: "1.0.0",
    },
  },
  {
    id: "access-audit",
    category: "compliance",
    title: "POS access audit",
    description: "Inspect POS activity by employee and status.",
    tags: ["Compliance", "Security"],
    owner: "Security",
    version: "1.0.0",
    source: "sales_orders",
    select: [
      { field: "employee_id", alias: "employee_id" },
      { field: "order_date", alias: "order_date" },
      { field: "status", alias: "status" },
    ],
    groupBy: ["employee_id", "order_date", "status"],
    sort: [{ field: "order_date", direction: "desc" }],
    limit: 365,
    timezone: DEFAULT_TIMEZONE,
    meta: {
      name: "POS access audit",
      description: "Inspect POS activity by employee and status.",
      tags: ["Compliance", "Security"],
      owner: "Security",
      version: "1.0.0",
    },
  },
];

const defaultRecentRuns = [
  {
    id: "sales-today",
    name: "Daily sales performance",
    ranAt: "2025-12-28T18:25:00.000Z",
    rows: 142,
    templateId: "daily-sales",
  },
  {
    id: "low-stock",
    name: "Low stock snapshot",
    ranAt: "2025-12-28T10:05:00.000Z",
    rows: 58,
    templateId: "low-stock",
  },
  {
    id: "tax-summary",
    name: "Tax liability report",
    ranAt: "2025-12-27T22:11:00.000Z",
    rows: 12,
    templateId: "tax-liability",
  },
];

const defaultStore = {
  version: 1,
  updatedAt: null,
  templates: [],
  recent: {},
  schedules: {},
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const ensureStoreDir = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
};

const readStore = async () => {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    if (!raw || !raw.trim()) {
      return clone(defaultStore);
    }
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version || 1,
      updatedAt: parsed.updatedAt || null,
      templates: Array.isArray(parsed.templates) ? parsed.templates : [],
      recent: parsed.recent && typeof parsed.recent === "object" ? parsed.recent : {},
      schedules:
        parsed.schedules && typeof parsed.schedules === "object"
          ? parsed.schedules
          : {},
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return clone(defaultStore);
    }
    if (error instanceof SyntaxError) {
      await writeStore(clone(defaultStore));
      return clone(defaultStore);
    }
    throw error;
  }
};

const writeStore = async (store) => {
  await ensureStoreDir();
  const payload = JSON.stringify(store, null, 2);
  await fs.writeFile(STORE_PATH, payload, "utf8");
};

const companyKey = (companyId) =>
  companyId === 0 || companyId ? String(companyId) : "global";

const generateId = () => {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }
  return `rpt_${Math.random().toString(36).slice(2, 10)}`;
};

const getTemplates = async () => {
  const store = await readStore();
  if (store.templates.length > 0) {
    return clone(store.templates);
  }
  return clone(defaultTemplates);
};

const getRecentRuns = async (companyId) => {
  const store = await readStore();
  const key = companyKey(companyId);
  const runs = store.recent[key];
  if (Array.isArray(runs) && runs.length > 0) {
    return clone(runs);
  }
  return clone(defaultRecentRuns);
};

const setRecentRuns = async (companyId, runs) => {
  const store = await readStore();
  const key = companyKey(companyId);
  store.recent = { ...store.recent, [key]: clone(runs) };
  store.version = (store.version || 1) + 1;
  store.updatedAt = new Date().toISOString();
  await writeStore(store);
  return clone(runs);
};

const getSchedules = async (companyId) => {
  const store = await readStore();
  const key = companyKey(companyId);
  const list = store.schedules[key];
  if (Array.isArray(list)) {
    return clone(list);
  }
  return [];
};

const persistSchedules = async (store, key, schedules) => {
  store.schedules = { ...store.schedules, [key]: clone(schedules) };
  store.version = (store.version || 1) + 1;
  store.updatedAt = new Date().toISOString();
  await writeStore(store);
};

const normalizeRecipients = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const buildSchedule = (payload, overrides = {}) => {
  const recipients = normalizeRecipients(payload.recipients);
  return {
    id: overrides.id || generateId(),
    name: (payload.name || "Untitled schedule").toString(),
    description: payload.description || "",
    frequency: payload.frequency || "custom",
    time: payload.time || "",
    delivery: payload.delivery || "email",
    recipients,
    format: payload.format || "csv",
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : true,
    timezone: payload.timezone || DEFAULT_TIMEZONE,
    templateId: payload.templateId || "",
    source: payload.source || "",
    parameters: payload.parameters || {},
    nextRunAt: overrides.nextRunAt || payload.nextRunAt || "",
    lastRunAt: overrides.lastRunAt || payload.lastRunAt || "",
    status: overrides.status || payload.status || "scheduled",
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const createSchedule = async (companyId, payload) => {
  const store = await readStore();
  const key = companyKey(companyId);
  const schedules = Array.isArray(store.schedules[key]) ? [...store.schedules[key]] : [];
  const schedule = buildSchedule(payload);
  schedules.push(schedule);
  await persistSchedules(store, key, schedules);
  return clone(schedule);
};

const updateSchedule = async (companyId, scheduleId, payload) => {
  const store = await readStore();
  const key = companyKey(companyId);
  const schedules = Array.isArray(store.schedules[key]) ? [...store.schedules[key]] : [];
  const index = schedules.findIndex((item) => item.id === scheduleId);
  if (index === -1) {
    return null;
  }
  const existing = schedules[index];
  const updated = buildSchedule({ ...existing, ...payload }, { id: existing.id, createdAt: existing.createdAt, nextRunAt: existing.nextRunAt, lastRunAt: existing.lastRunAt, status: existing.status });
  schedules[index] = updated;
  await persistSchedules(store, key, schedules);
  return clone(updated);
};

const patchSchedule = async (companyId, scheduleId, payload) => {
  const store = await readStore();
  const key = companyKey(companyId);
  const schedules = Array.isArray(store.schedules[key]) ? [...store.schedules[key]] : [];
  const index = schedules.findIndex((item) => item.id === scheduleId);
  if (index === -1) {
    return null;
  }
  const existing = schedules[index];
  const merged = {
    ...existing,
    ...payload,
    recipients: payload.recipients ? normalizeRecipients(payload.recipients) : existing.recipients,
    updatedAt: new Date().toISOString(),
  };
  schedules[index] = merged;
  await persistSchedules(store, key, schedules);
  return clone(merged);
};

const deleteSchedule = async (companyId, scheduleId) => {
  const store = await readStore();
  const key = companyKey(companyId);
  const schedules = Array.isArray(store.schedules[key]) ? [...store.schedules[key]] : [];
  const next = schedules.filter((item) => item.id !== scheduleId);
  if (next.length === schedules.length) {
    return false;
  }
  await persistSchedules(store, key, next);
  return true;
};

module.exports = {
  DEFAULT_TIMEZONE,
  getTemplates,
  getRecentRuns,
  setRecentRuns,
  getSchedules,
  createSchedule,
  updateSchedule,
  patchSchedule,
  deleteSchedule,
  defaultTemplates,
  defaultRecentRuns,
};
