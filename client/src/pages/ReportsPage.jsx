import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useConfig } from "../context/ConfigContext";
import api from "../api/http";

const STORAGE_KEYS = {
  templatePref: "reports:lastTemplate",
  viewPref: "reports:lastView",
  limitPref: "reports:lastLimit",
};

const DEFAULT_TIMEZONE = "America/Santiago";

const AGGREGATE_OPTIONS = ["", "SUM", "AVG", "COUNT", "COUNT_DISTINCT"];
const LOGIC_OPTIONS = ["AND", "OR"];
const SORT_DIRECTIONS = ["asc", "desc"];
const FREQUENCY_OPTIONS = ["daily", "weekly", "monthly", "custom"];
const DELIVERY_CHANNELS = ["email", "sftp", "webhook"];
const EXPORT_FORMATS = ["csv", "xlsx", "json", "pdf"];
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];

const OPERATOR_SQL = {
  equals: "=",
  notEquals: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

const generateId = () => `tmp_${Math.random().toString(36).slice(2, 10)}`;

const asArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const coerceBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
};

const toList = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const DEFAULT_SOURCE_DEFINITIONS = [
  {
    id: "sales_orders",
    table: "fact_sales_orders",
    labelKey: "reports.sources.salesOrders.label",
    descriptionKey: "reports.sources.salesOrders.description",
    labelFallback: "Sales orders",
    descriptionFallback:
      "POS tickets, invoices, and online orders with monetary totals.",
    defaultSelect: [
      { field: "order_date", alias: "order_date", agg: "" },
      { field: "gross_total", alias: "gross_total", agg: "SUM" },
    ],
    defaultGroupBy: ["order_date"],
    defaultSort: [{ field: "order_date", direction: "asc" }],
    fields: [
      {
        id: "order_date",
        sql: "order_date",
        labelKey: "reports.fields.orderDate",
        labelFallback: "Order date",
        type: "date",
        operators: ["between", "gte", "lte"],
        groupable: true,
      },
      {
        id: "channel",
        sql: "channel",
        labelKey: "reports.fields.channel",
        labelFallback: "Sales channel",
        type: "enum",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
      {
        id: "employee_id",
        sql: "employee_id",
        labelKey: "reports.fields.employee",
        labelFallback: "Employee",
        type: "string",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
      {
        id: "customer_id",
        sql: "customer_id",
        labelKey: "reports.fields.customer",
        labelFallback: "Customer",
        type: "string",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
      {
        id: "gross_total",
        sql: "gross_total",
        labelKey: "reports.fields.grossTotal",
        labelFallback: "Gross total",
        type: "number",
        operators: ["gt", "gte", "lt", "lte", "between"],
        groupable: false,
      },
      {
        id: "net_total",
        sql: "net_total",
        labelKey: "reports.fields.netTotal",
        labelFallback: "Net total",
        type: "number",
        operators: ["gt", "gte", "lt", "lte", "between"],
        groupable: false,
      },
      {
        id: "tax_total",
        sql: "tax_total",
        labelKey: "reports.fields.taxTotal",
        labelFallback: "Tax total",
        type: "number",
        operators: ["gt", "gte", "lt", "lte", "between"],
        groupable: false,
      },
      {
        id: "status",
        sql: "status",
        labelKey: "reports.fields.status",
        labelFallback: "Status",
        type: "enum",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
    ],
  },
  {
    id: "inventory_balances",
    table: "fact_inventory_balances",
    labelKey: "reports.sources.inventoryBalances.label",
    descriptionKey: "reports.sources.inventoryBalances.description",
    labelFallback: "Inventory balances",
    descriptionFallback:
      "Daily stock snapshots by warehouse, product, category, and lot.",
    defaultSelect: [
      { field: "snapshot_date", alias: "snapshot_date", agg: "" },
      { field: "stock_on_hand", alias: "stock_on_hand", agg: "SUM" },
    ],
    defaultGroupBy: ["snapshot_date"],
    defaultSort: [{ field: "snapshot_date", direction: "desc" }],
    fields: [
      {
        id: "snapshot_date",
        sql: "snapshot_date",
        labelKey: "reports.fields.snapshotDate",
        labelFallback: "Snapshot date",
        type: "date",
        operators: ["between", "gte", "lte"],
        groupable: true,
      },
      {
        id: "warehouse_id",
        sql: "warehouse_id",
        labelKey: "reports.fields.warehouse",
        labelFallback: "Warehouse",
        type: "string",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
      {
        id: "product_id",
        sql: "product_id",
        labelKey: "reports.fields.product",
        labelFallback: "Product",
        type: "string",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
      {
        id: "category_id",
        sql: "category_id",
        labelKey: "reports.fields.category",
        labelFallback: "Category",
        type: "string",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
      {
        id: "stock_on_hand",
        sql: "stock_on_hand",
        labelKey: "reports.fields.stockOnHand",
        labelFallback: "Stock on hand",
        type: "number",
        operators: ["gt", "gte", "lt", "lte", "between"],
        groupable: false,
      },
      {
        id: "stock_reserved",
        sql: "stock_reserved",
        labelKey: "reports.fields.stockReserved",
        labelFallback: "Stock reserved",
        type: "number",
        operators: ["gt", "gte", "lt", "lte", "between"],
        groupable: false,
      },
      {
        id: "lot_expiry",
        sql: "lot_expiry",
        labelKey: "reports.fields.lotExpiry",
        labelFallback: "Lot expiry",
        type: "date",
        operators: ["between", "gte", "lte"],
        groupable: true,
      },
    ],
  },
  {
    id: "payments",
    table: "fact_payments",
    labelKey: "reports.sources.payments.label",
    descriptionKey: "reports.sources.payments.description",
    labelFallback: "Payments",
    descriptionFallback:
      "Payment postings with method, currency, and settlement status.",
    defaultSelect: [
      { field: "payment_date", alias: "payment_date", agg: "" },
      { field: "amount", alias: "amount", agg: "SUM" },
    ],
    defaultGroupBy: ["payment_date"],
    defaultSort: [{ field: "payment_date", direction: "desc" }],
    fields: [
      {
        id: "payment_date",
        sql: "payment_date",
        labelKey: "reports.fields.paymentDate",
        labelFallback: "Payment date",
        type: "date",
        operators: ["between", "gte", "lte"],
        groupable: true,
      },
      {
        id: "method",
        sql: "method",
        labelKey: "reports.fields.paymentMethod",
        labelFallback: "Payment method",
        type: "enum",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
      {
        id: "status",
        sql: "status",
        labelKey: "reports.fields.status",
        labelFallback: "Status",
        type: "enum",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
      {
        id: "amount",
        sql: "amount",
        labelKey: "reports.fields.amount",
        labelFallback: "Amount",
        type: "number",
        operators: ["gt", "gte", "lt", "lte", "between"],
        groupable: false,
      },
      {
        id: "currency",
        sql: "currency",
        labelKey: "reports.fields.currency",
        labelFallback: "Currency",
        type: "enum",
        operators: ["equals", "in"],
        groupable: true,
      },
      {
        id: "customer_id",
        sql: "customer_id",
        labelKey: "reports.fields.customer",
        labelFallback: "Customer",
        type: "string",
        operators: ["equals", "notEquals", "in"],
        groupable: true,
      },
    ],
  },
];

const cloneSourceDefinitions = (sources) =>
  toList(sources).map((source) => ({
    ...source,
    defaultSelect: Array.isArray(source.defaultSelect)
      ? source.defaultSelect.map((item) => ({ ...item }))
      : [],
    defaultGroupBy: Array.isArray(source.defaultGroupBy)
      ? [...source.defaultGroupBy]
      : [],
    defaultSort: Array.isArray(source.defaultSort)
      ? source.defaultSort.map((item) => ({ ...item }))
      : [],
    fields: Array.isArray(source.fields)
      ? source.fields.map((field) => ({ ...field }))
      : [],
  }));

const normalizeSourcesResponse = (payload) => {
  const list = Array.isArray(payload?.sources)
    ? payload.sources
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
    ? payload
    : [];

  return list
    .map((item) => normalizeSourceDefinition(item))
    .filter(Boolean);
};

function normalizeSourceDefinition(item) {
  if (!item) return null;
  const id = item.id || item.datasetId || item.slug || item.name;
  const table = item.table || item.sourceTable || item.sqlTable || item.dataset;
  if (!id || !table) return null;

  return {
    id: String(id),
    table: String(table),
    labelKey: item.labelKey || item.label_key || null,
    descriptionKey:
      item.descriptionKey || item.description_key || item.summaryKey || null,
    labelFallback:
      item.labelFallback || item.label || item.displayName || String(id),
    descriptionFallback:
      item.descriptionFallback || item.description || item.summary || "",
    defaultSelect: normalizeSelectList(
      item.defaultSelect || item.select || item.default_select
    ),
    defaultGroupBy: normalizeGroupByList(
      item.defaultGroupBy || item.groupBy || item.group_by
    ),
    defaultSort: normalizeSortList(
      item.defaultSort || item.sort || item.default_sort || item.orderBy
    ),
    fields: normalizeFieldsList(item.fields || item.columns || []),
  };
}

function normalizeSelectList(value) {
  return toList(value)
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        return { field: item, alias: item, agg: "" };
      }
      const field =
        item.field || item.column || item.name || item.id || item.expression;
      if (!field) return null;
      const aggRaw =
        item.agg || item.aggregate || item.function || item.fn || "";
      return {
        field: String(field),
        alias:
          item.alias || item.label || item.title || item.as || String(field),
        agg: aggRaw && aggRaw !== "NONE" ? String(aggRaw) : "",
      };
    })
    .filter(Boolean);
}

function normalizeSortList(value) {
  return toList(value)
    .map((item) => {
      if (!item) return null;
      const field = item.field || item.column || item.name || item.id;
      if (!field) return null;
      const raw = String(item.direction || item.dir || item.order || "asc").toLowerCase();
      const direction = raw === "desc" ? "desc" : "asc";
      return {
        field: String(field),
        direction,
      };
    })
    .filter(Boolean);
}

function normalizeGroupByList(value) {
  return toList(value)
    .map((item) =>
      typeof item === "string" ? item : item?.field || item?.id || null
    )
    .filter(Boolean)
    .map((entry) => String(entry));
}

function normalizeFieldsList(value) {
  return toList(value)
    .map((item) => {
      if (!item) return null;
      const id = item.id || item.field || item.name;
      if (!id) return null;
      const sql = item.sql || item.column || item.expression || id;
      const operators = Array.isArray(item.operators)
        ? item.operators
        : Array.isArray(item.operatorOptions)
        ? item.operatorOptions
        : [];
      return {
        id: String(id),
        sql: String(sql),
        labelKey: item.labelKey || item.label_key || null,
        labelFallback:
          item.labelFallback || item.label || item.displayName || String(id),
        type: item.type || item.dataType || item.datatype || "string",
        operators: operators.map((op) => String(op)),
        groupable: coerceBoolean(
          item.groupable ?? item.groupBy ?? item.canGroup ?? false,
          false
        ),
      };
    })
    .filter(Boolean);
}

const localizeString = (key, fallback, t) => {
  if (key) {
    const translated = t(key);
    if (translated && translated !== key) {
      return translated;
    }
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return key || "";
};

const localizeField = (field, t) => ({
  ...field,
  label: localizeString(field.labelKey, field.labelFallback || field.label || field.id, t),
});

const localizeSource = (source, t) => ({
  ...source,
  label: localizeString(
    source.labelKey,
    source.labelFallback || source.label || source.id,
    t
  ),
  description: localizeString(
    source.descriptionKey,
    source.descriptionFallback || source.description || "",
    t
  ),
  fields: Array.isArray(source.fields)
    ? source.fields.map((field) => localizeField(field, t))
    : [],
});

function buildSql(payload, sourceMeta, t) {
  if (!sourceMeta) {
    return t("reports.builder.preview.noSource");
  }

  const sanitizedSelect = payload.select.filter((item) => item.field);
  const sanitizedFilters = payload.filters.filter(
    (filter) => filter.field && filter.operator
  );
  const sanitizedGroupBy = payload.groupBy.filter(Boolean);
  const sanitizedSort = payload.sort.filter((item) => item.field);

  const selectClause =
    sanitizedSelect.length > 0
      ? sanitizedSelect
          .map((item) => {
            const columnMeta = sourceMeta.fields.find(
              (field) => field.id === item.field
            );
            const columnName = columnMeta?.sql || item.field;
            const agg = item.agg ? `${item.agg}(${columnName})` : columnName;
            const alias = item.alias ? ` AS ${item.alias}` : "";
            return `${agg}${alias}`;
          })
          .join(", ")
      : "*";

  const whereParts = [];
  sanitizedFilters.forEach((filter, index) => {
    const fieldMeta = sourceMeta.fields.find((field) => field.id === filter.field);
    if (!fieldMeta) return;
    const columnName = fieldMeta.sql || filter.field;
    const paramBase = `:p${index}`;
    let expression = "";

    switch (filter.operator) {
      case "between":
        expression = `${columnName} BETWEEN ${paramBase}_from AND ${paramBase}_to`;
        break;
      case "in":
        expression = `${columnName} IN (${paramBase}_list)`;
        break;
      case "contains":
        expression = `${columnName} LIKE CONCAT('%', ${paramBase}, '%')`;
        break;
      case "startsWith":
        expression = `${columnName} LIKE CONCAT(${paramBase}, '%')`;
        break;
      default: {
        const op = OPERATOR_SQL[filter.operator] || filter.operator;
        expression = `${columnName} ${op} ${paramBase}`;
        break;
      }
    }

    if (!expression) return;
    const logicPrefix = index === 0 ? "" : `${filter.logic || "AND"} `;
    whereParts.push(`${logicPrefix}${expression}`);
  });

  const whereClause =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" ")}` : "";

  const groupClause =
    sanitizedGroupBy.length > 0
      ? `GROUP BY ${sanitizedGroupBy
          .map((fieldId) => {
            const meta = sourceMeta.fields.find((field) => field.id === fieldId);
            return meta?.sql || fieldId;
          })
          .join(", ")}`
      : "";

  const orderClause =
    sanitizedSort.length > 0
      ? `ORDER BY ${sanitizedSort
          .map((item) => {
            const meta = sourceMeta.fields.find((field) => field.id === item.field);
            const columnName = meta?.sql || item.field;
            const direction = item.direction?.toUpperCase() === "DESC" ? "DESC" : "ASC";
            return `${columnName} ${direction}`;
          })
          .join(", ")}`
      : "";

  const limitClause =
    typeof payload.limit === "number" && Number.isFinite(payload.limit)
      ? `LIMIT ${payload.limit}`
      : "";

  const timezoneComment = payload.timezone
    ? `-- timezone: ${payload.timezone}`
    : "";

  return [
    `SELECT ${selectClause}`,
    `FROM ${sourceMeta.table}`,
    whereClause,
    groupClause,
    orderClause,
    limitClause,
    timezoneComment,
  ]
    .filter(Boolean)
    .join("\n");
}

const createDefaultPayload = (sourceId, sourceMeta) => ({
  source: sourceId,
  select: sourceMeta?.defaultSelect
    ? sourceMeta.defaultSelect.map((item) => ({ id: generateId(), ...item }))
    : [],
  filters: [],
  groupBy: sourceMeta?.defaultGroupBy ? [...sourceMeta.defaultGroupBy] : [],
  sort: sourceMeta?.defaultSort
    ? sourceMeta.defaultSort.map((item) => ({ id: generateId(), ...item }))
    : [],
  having: [],
  limit: 500,
  timezone: DEFAULT_TIMEZONE,
});

export default function ReportsPage() {
  const { t } = useLanguage();
  const { config } = useConfig();
  const reportsApiEnabled = useMemo(() => {
    const envFlag = import.meta.env.VITE_REPORTS_API_ENABLED;
    if (envFlag === "true") return true;
    if (envFlag === "false") return false;
    const featureConfig = config?.features?.reports;
    if (typeof featureConfig === "boolean") return featureConfig;
    if (featureConfig && typeof featureConfig === "object") {
      if (typeof featureConfig.apiEnabled === "boolean") {
        return featureConfig.apiEnabled;
      }
      if (typeof featureConfig.enabled === "boolean") {
        return featureConfig.enabled;
      }
    }
    return false;
  }, [config]);

  const loadStoredLimit = () => {
    if (typeof window === "undefined") return undefined;
    const value = localStorage.getItem(STORAGE_KEYS.limitPref);
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const [sourceDefinitions, setSourceDefinitions] = useState(() =>
    cloneSourceDefinitions(DEFAULT_SOURCE_DEFINITIONS)
  );

  useEffect(() => {
    let ignore = false;

    const fetchSources = async () => {
      try {
        const { data } = await api.get("/api/reports/sources");
        if (ignore) return;
        const normalized = normalizeSourcesResponse(data);
        if (normalized.length > 0) {
          setSourceDefinitions(normalized);
        } else {
          setSourceDefinitions(cloneSourceDefinitions(DEFAULT_SOURCE_DEFINITIONS));
        }
      } catch (error) {
        if (ignore) return;
        const status = error?.response?.status;
        if (reportsApiEnabled && status && status !== 404) {
          console.error("Failed to load report sources", error);
        }
        setSourceDefinitions(cloneSourceDefinitions(DEFAULT_SOURCE_DEFINITIONS));
      }
    };

    fetchSources();

    return () => {
      ignore = true;
    };
  }, [reportsApiEnabled]);

  const dataSources = useMemo(
    () => sourceDefinitions.map((definition) => localizeSource(definition, t)),
    [sourceDefinitions, t]
  );

  const builtinTemplates = useMemo(
    () => ({
      "daily-sales": {
        id: "daily-sales",
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
          name: t("reports.catalog.sales.daily"),
          description: t("reports.catalog.sales.dailyDescription"),
          tags: [t("reports.tags.sales"), t("reports.tags.daily")],
          owner: t("reports.tags.owners.sales"),
          version: "1.0.0",
        },
      },
      "promo-roi": {
        id: "promo-roi",
        source: "sales_orders",
        select: [
          { field: "channel", alias: "channel" },
          { field: "gross_total", agg: "SUM", alias: "gross_total" },
          { field: "net_total", agg: "SUM", alias: "net_total" },
        ],
        groupBy: ["channel"],
        sort: [{ field: "gross_total", direction: "desc" }],
        limit: 250,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.sales.promo"),
          description: t("reports.catalog.sales.promoDescription"),
          tags: [t("reports.tags.sales"), t("reports.tags.promotions")],
          owner: t("reports.tags.owners.marketing"),
          version: "1.1.0",
        },
      },
      "customer-trends": {
        id: "customer-trends",
        source: "sales_orders",
        select: [
          { field: "customer_id", alias: "customer_id" },
          { field: "gross_total", agg: "SUM", alias: "gross_total" },
          { field: "net_total", agg: "SUM", alias: "net_total" },
        ],
        groupBy: ["customer_id"],
        sort: [{ field: "gross_total", direction: "desc" }],
        limit: 250,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.sales.customer"),
          description: t("reports.catalog.sales.customerDescription"),
          tags: [t("reports.tags.sales"), t("reports.tags.customers")],
          owner: t("reports.tags.owners.crm"),
          version: "1.0.0",
        },
      },
      "low-stock": {
        id: "low-stock",
        source: "inventory_balances",
        select: [
          { field: "product_id", alias: "product_id" },
          { field: "warehouse_id", alias: "warehouse_id" },
          { field: "stock_on_hand", alias: "stock_on_hand" },
        ],
        filters: [
          { field: "stock_on_hand", operator: "lt", value: 10 },
        ],
        sort: [{ field: "stock_on_hand", direction: "asc" }],
        limit: 200,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.inventory.lowStock"),
          description: t("reports.catalog.inventory.lowStockDescription"),
          tags: [t("reports.tags.inventory"), t("reports.tags.alerts")],
          owner: t("reports.tags.owners.inventory"),
          version: "1.2.0",
        },
      },
      aging: {
        id: "aging",
        source: "inventory_balances",
        select: [
          { field: "product_id", alias: "product_id" },
          { field: "lot_expiry", alias: "lot_expiry" },
          { field: "stock_on_hand", alias: "stock_on_hand" },
        ],
        filters: [
          { field: "lot_expiry", operator: "between" },
        ],
        sort: [{ field: "lot_expiry", direction: "asc" }],
        limit: 200,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.inventory.aging"),
          description: t("reports.catalog.inventory.agingDescription"),
          tags: [t("reports.tags.inventory"), t("reports.tags.compliance")],
          owner: t("reports.tags.owners.inventory"),
          version: "1.0.0",
        },
      },
      "supplier-performance": {
        id: "supplier-performance",
        source: "inventory_balances",
        select: [
          { field: "supplier_id", alias: "supplier_id" },
          { field: "stock_on_hand", agg: "SUM", alias: "stock_on_hand" },
        ],
        groupBy: ["supplier_id"],
        sort: [{ field: "stock_on_hand", direction: "desc" }],
        limit: 200,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.inventory.supplier"),
          description: t("reports.catalog.inventory.supplierDescription"),
          tags: [t("reports.tags.inventory"), t("reports.tags.suppliers")],
          owner: t("reports.tags.owners.procurement"),
          version: "1.0.0",
        },
      },
      "profit-loss": {
        id: "profit-loss",
        source: "sales_orders",
        select: [
          { field: "order_date", alias: "order_date" },
          { field: "gross_total", agg: "SUM", alias: "gross_total" },
          { field: "net_total", agg: "SUM", alias: "net_total" },
          { field: "tax_total", agg: "SUM", alias: "tax_total" },
        ],
        groupBy: ["order_date"],
        sort: [{ field: "order_date", direction: "asc" }],
        limit: 120,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.finance.pnl"),
          description: t("reports.catalog.finance.pnlDescription"),
          tags: [t("reports.tags.finance"), t("reports.tags.monthly")],
          owner: t("reports.tags.owners.finance"),
          version: "2.0.0",
        },
      },
      "tax-liability": {
        id: "tax-liability",
        source: "sales_orders",
        select: [
          { field: "order_date", alias: "order_date" },
          { field: "tax_total", agg: "SUM", alias: "tax_total" },
        ],
        groupBy: ["order_date"],
        sort: [{ field: "order_date", direction: "asc" }],
        limit: 180,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.finance.tax"),
          description: t("reports.catalog.finance.taxDescription"),
          tags: [t("reports.tags.finance"), t("reports.tags.compliance")],
          owner: t("reports.tags.owners.finance"),
          version: "1.0.0",
        },
      },
      "cash-flow": {
        id: "cash-flow",
        source: "payments",
        select: [
          { field: "payment_date", alias: "payment_date" },
          { field: "amount", agg: "SUM", alias: "amount" },
        ],
        groupBy: ["payment_date"],
        sort: [{ field: "payment_date", direction: "asc" }],
        limit: 180,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.finance.cash"),
          description: t("reports.catalog.finance.cashDescription"),
          tags: [t("reports.tags.finance"), t("reports.tags.cash")],
          owner: t("reports.tags.owners.finance"),
          version: "1.0.0",
        },
      },
      "staff-productivity": {
        id: "staff-productivity",
        source: "sales_orders",
        select: [
          { field: "employee_id", alias: "employee_id" },
          { field: "gross_total", agg: "SUM", alias: "gross_total" },
          { field: "order_date", alias: "order_date" },
        ],
        filters: [
          { field: "order_date", operator: "between" },
        ],
        groupBy: ["employee_id"],
        sort: [{ field: "gross_total", direction: "desc" }],
        limit: 250,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.operations.productivity"),
          description: t("reports.catalog.operations.productivityDescription"),
          tags: [t("reports.tags.operations"), t("reports.tags.employees")],
          owner: t("reports.tags.owners.operations"),
          version: "1.0.0",
        },
      },
      "voids-refunds": {
        id: "voids-refunds",
        source: "sales_orders",
        select: [
          { field: "order_date", alias: "order_date" },
          { field: "status", alias: "status" },
          { field: "gross_total", agg: "SUM", alias: "gross_total" },
        ],
        filters: [
          { field: "status", operator: "in", value: ["void", "refund"] },
        ],
        groupBy: ["order_date", "status"],
        sort: [{ field: "order_date", direction: "desc" }],
        limit: 200,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.operations.voids"),
          description: t("reports.catalog.operations.voidsDescription"),
          tags: [t("reports.tags.operations"), t("reports.tags.alerts")],
          owner: t("reports.tags.owners.operations"),
          version: "1.0.0",
        },
      },
      "order-latency": {
        id: "order-latency",
        source: "sales_orders",
        select: [
          { field: "order_date", alias: "order_date" },
          { field: "status", alias: "status" },
          { field: "gross_total", agg: "SUM", alias: "gross_total" },
        ],
        filters: [
          { field: "status", operator: "equals", value: "fulfilled" },
        ],
        groupBy: ["order_date"],
        sort: [{ field: "order_date", direction: "asc" }],
        limit: 120,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.operations.latency"),
          description: t("reports.catalog.operations.latencyDescription"),
          tags: [t("reports.tags.operations"), t("reports.tags.time")],
          owner: t("reports.tags.owners.operations"),
          version: "1.0.0",
        },
      },
      "invoice-status": {
        id: "invoice-status",
        source: "sales_orders",
        select: [
          { field: "order_date", alias: "order_date" },
          { field: "status", alias: "status" },
          { field: "gross_total", agg: "SUM", alias: "gross_total" },
        ],
        groupBy: ["order_date", "status"],
        sort: [{ field: "order_date", direction: "desc" }],
        limit: 200,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.compliance.invoices"),
          description: t("reports.catalog.compliance.invoicesDescription"),
          tags: [t("reports.tags.compliance"), t("reports.tags.tax")],
          owner: t("reports.tags.owners.finance"),
          version: "1.0.0",
        },
      },
      "price-audits": {
        id: "price-audits",
        source: "sales_orders",
        select: [
          { field: "product_id", alias: "product_id" },
          { field: "order_date", alias: "order_date" },
          { field: "gross_total", agg: "SUM", alias: "gross_total" },
        ],
        groupBy: ["product_id", "order_date"],
        sort: [{ field: "order_date", direction: "desc" }],
        limit: 200,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.compliance.prices"),
          description: t("reports.catalog.compliance.pricesDescription"),
          tags: [t("reports.tags.compliance"), t("reports.tags.audit")],
          owner: t("reports.tags.owners.finance"),
          version: "1.0.0",
        },
      },
      "access-audit": {
        id: "access-audit",
        source: "sales_orders",
        select: [
          { field: "employee_id", alias: "employee_id" },
          { field: "order_date", alias: "order_date" },
        ],
        groupBy: ["employee_id", "order_date"],
        sort: [{ field: "order_date", direction: "desc" }],
        limit: 200,
        timezone: DEFAULT_TIMEZONE,
        meta: {
          name: t("reports.catalog.compliance.access"),
          description: t("reports.catalog.compliance.accessDescription"),
          tags: [t("reports.tags.compliance"), t("reports.tags.security")],
          owner: t("reports.tags.owners.security"),
          version: "1.0.0",
        },
      },
    }),
    [t]
  );

  const findSource = useCallback(
    (identifier) => {
      if (!identifier) return null;
      const raw = typeof identifier === "string" ? identifier : String(identifier);
      const trimmed = raw.trim();
      if (trimmed.length === 0) return null;
      const direct = dataSources.find((source) => source.id === trimmed);
      if (direct) return direct;
      const caseInsensitive = dataSources.find(
        (source) => source.id.toLowerCase() === trimmed.toLowerCase()
      );
      if (caseInsensitive) return caseInsensitive;
      const byTable = dataSources.find((source) => source.table === trimmed);
      if (byTable) return byTable;
      return null;
    },
    [dataSources]
  );

  const createPayloadFromTemplate = useCallback(
    (templateCandidate, fallbackReport, currentSourceId) => {
      const rawTemplate =
        templateCandidate ||
        (fallbackReport?.id ? builtinTemplates[fallbackReport.id] : null) ||
        (fallbackReport?.templateId
          ? builtinTemplates[fallbackReport.templateId]
          : null) ||
        fallbackReport?.template ||
        null;

      if (!rawTemplate) {
        return null;
      }

      const sourceIdCandidate =
        rawTemplate.source ||
        rawTemplate.sourceId ||
        rawTemplate.datasetId ||
        rawTemplate.dataset?.id ||
        rawTemplate.dataset ||
        rawTemplate.dataSource ||
        rawTemplate.meta?.source ||
        rawTemplate.meta?.dataset ||
        fallbackReport?.source ||
        null;

      const source =
        findSource(sourceIdCandidate) ||
        (currentSourceId ? findSource(currentSourceId) : null) ||
        dataSources[0];

      const nextPayload = createDefaultPayload(source.id, source);

      const selectRaw =
        rawTemplate.select ||
        rawTemplate.columns ||
        rawTemplate.metrics ||
        rawTemplate.fields ||
        [];

      const nextSelect = asArray(selectRaw)
        .map((item) => {
          if (!item) return null;
          const field =
            item.field ||
            item.column ||
            item.name ||
            item.id ||
            item.expression ||
            null;
          if (!field) return null;
          const aggRaw =
            item.agg ||
            item.aggregate ||
            item.function ||
            item.fn ||
            "";
          const agg = aggRaw && aggRaw !== "NONE" ? aggRaw : "";
          const alias =
            item.alias ||
            item.label ||
            item.title ||
            item.name ||
            (typeof field === "string" ? field : "");
          return {
            id: generateId(),
            field,
            agg,
            alias,
          };
        })
        .filter(Boolean);

      if (nextSelect.length > 0) {
        nextPayload.select = nextSelect;
      }

      const filtersRaw =
        rawTemplate.filters ||
        rawTemplate.where ||
        rawTemplate.conditions ||
        rawTemplate.rules ||
        [];

      const nextFilters = asArray(filtersRaw)
        .map((item, index) => {
          if (!item) return null;
          const field = item.field || item.column || item.name;
          const operator =
            item.operator || item.op || item.condition || item.comparator;
          if (!field || !operator) return null;
          const valueRaw =
            item.value ??
            item.values ??
            item.target ??
            item.match ??
            null;
          const valueArray = Array.isArray(valueRaw)
            ? valueRaw
            : valueRaw !== null && valueRaw !== undefined
            ? [valueRaw]
            : [];

          const primaryValue = valueArray[0] ?? "";
          const secondaryValue = valueArray[1] ?? "";

          return {
            id: generateId(),
            field,
            operator,
            value:
              operator === "between"
                ? primaryValue
                : operator === "in"
                ? valueArray.join(", ")
                : primaryValue,
            secondaryValue: operator === "between" ? secondaryValue : "",
            logic:
              index === 0
                ? "AND"
                : item.logic || item.connector || item.join || "AND",
          };
        })
        .filter(Boolean);

      if (nextFilters.length > 0) {
        nextPayload.filters = nextFilters;
      }

      const groupByRaw =
        rawTemplate.groupBy ||
        rawTemplate.groups ||
        rawTemplate.dimensions ||
        [];
      const nextGroupBy = asArray(groupByRaw).map((item) =>
        typeof item === "string" ? item : item?.field || item?.id || null
      );
      nextPayload.groupBy = nextGroupBy.filter(Boolean);

      const sortRaw =
        rawTemplate.sort ||
        rawTemplate.order ||
        rawTemplate.orderBy ||
        rawTemplate.sorting ||
        [];
      const nextSort = asArray(sortRaw)
        .map((item) => {
          if (!item) return null;
          const field = item.field || item.column || item.name || item.id;
          if (!field) return null;
          const directionRaw =
            item.direction ||
            item.dir ||
            item.order ||
            item.sort ||
            "asc";
          const direction =
            String(directionRaw || "asc").toLowerCase() === "desc"
              ? "desc"
              : "asc";
          return {
            id: generateId(),
            field,
            direction,
          };
        })
        .filter(Boolean);
      if (nextSort.length > 0) {
        nextPayload.sort = nextSort;
      }

      if (rawTemplate.limit && Number(rawTemplate.limit) > 0) {
        nextPayload.limit = Number(rawTemplate.limit);
      }

      if (rawTemplate.timezone) {
        nextPayload.timezone = rawTemplate.timezone;
      }

      const meta = {
        id:
          rawTemplate.id ||
          rawTemplate.templateId ||
          fallbackReport?.id ||
          fallbackReport?.templateId ||
          null,
        name:
          rawTemplate.name ||
          rawTemplate.title ||
          rawTemplate.meta?.name ||
          fallbackReport?.title ||
          null,
        description:
          rawTemplate.description ||
          rawTemplate.summary ||
          rawTemplate.subtitle ||
          rawTemplate.meta?.description ||
          fallbackReport?.description ||
          "",
        tags:
          asArray(
            rawTemplate.tags ||
              rawTemplate.meta?.tags ||
              rawTemplate.meta?.labels ||
              fallbackReport?.tags
          ),
        owner:
          rawTemplate.owner?.name ||
          rawTemplate.owner ||
          rawTemplate.createdBy?.name ||
          rawTemplate.meta?.owner ||
          rawTemplate.meta?.createdBy ||
          "",
        version:
          rawTemplate.version ||
          rawTemplate.revision ||
          rawTemplate.meta?.version ||
          "",
        updatedAt:
          rawTemplate.updatedAt ||
          rawTemplate.updated_at ||
          rawTemplate.modifiedAt ||
          rawTemplate.meta?.updatedAt ||
          rawTemplate.meta?.modifiedAt ||
          "",
        createdAt: rawTemplate.createdAt || rawTemplate.meta?.createdAt || "",
        scheduleCount:
          typeof rawTemplate.scheduleCount === "number"
            ? rawTemplate.scheduleCount
            : Array.isArray(rawTemplate.schedules)
            ? rawTemplate.schedules.length
            : rawTemplate.meta?.scheduleCount || 0,
        sourceLabel: source?.label || source?.id,
      };

      return {
        payload: nextPayload,
        meta,
        source,
      };
    },
    [builtinTemplates, dataSources, findSource]
  );

  const defaultCatalogSections = useMemo(
    () => [
      {
        id: "sales",
        title: t("reports.catalog.sales.title"),
        description: t("reports.catalog.sales.description"),
        reports: [
          {
            id: "daily-sales",
            title: t("reports.catalog.sales.daily"),
            description: t("reports.catalog.sales.dailyDescription"),
          },
          {
            id: "promo-roi",
            title: t("reports.catalog.sales.promo"),
            description: t("reports.catalog.sales.promoDescription"),
          },
          {
            id: "customer-trends",
            title: t("reports.catalog.sales.customer"),
            description: t("reports.catalog.sales.customerDescription"),
          },
        ],
      },
      {
        id: "inventory",
        title: t("reports.catalog.inventory.title"),
        description: t("reports.catalog.inventory.description"),
        reports: [
          {
            id: "low-stock",
            title: t("reports.catalog.inventory.lowStock"),
            description: t("reports.catalog.inventory.lowStockDescription"),
          },
          {
            id: "aging",
            title: t("reports.catalog.inventory.aging"),
            description: t("reports.catalog.inventory.agingDescription"),
          },
          {
            id: "supplier-performance",
            title: t("reports.catalog.inventory.supplier"),
            description: t(
              "reports.catalog.inventory.supplierDescription"
            ),
          },
        ],
      },
      {
        id: "finance",
        title: t("reports.catalog.finance.title"),
        description: t("reports.catalog.finance.description"),
        reports: [
          {
            id: "profit-loss",
            title: t("reports.catalog.finance.pnl"),
            description: t("reports.catalog.finance.pnlDescription"),
          },
          {
            id: "tax-liability",
            title: t("reports.catalog.finance.tax"),
            description: t("reports.catalog.finance.taxDescription"),
          },
          {
            id: "cash-flow",
            title: t("reports.catalog.finance.cash"),
            description: t("reports.catalog.finance.cashDescription"),
          },
        ],
      },
      {
        id: "operations",
        title: t("reports.catalog.operations.title"),
        description: t("reports.catalog.operations.description"),
        reports: [
          {
            id: "staff-productivity",
            title: t("reports.catalog.operations.productivity"),
            description: t(
              "reports.catalog.operations.productivityDescription"
            ),
          },
          {
            id: "voids-refunds",
            title: t("reports.catalog.operations.voids"),
            description: t("reports.catalog.operations.voidsDescription"),
          },
          {
            id: "order-latency",
            title: t("reports.catalog.operations.latency"),
            description: t("reports.catalog.operations.latencyDescription"),
          },
        ],
      },
      {
        id: "compliance",
        title: t("reports.catalog.compliance.title"),
        description: t("reports.catalog.compliance.description"),
        reports: [
          {
            id: "invoice-status",
            title: t("reports.catalog.compliance.invoices"),
            description: t("reports.catalog.compliance.invoicesDescription"),
          },
          {
            id: "price-audits",
            title: t("reports.catalog.compliance.prices"),
            description: t("reports.catalog.compliance.pricesDescription"),
          },
          {
            id: "access-audit",
            title: t("reports.catalog.compliance.access"),
            description: t("reports.catalog.compliance.accessDescription"),
          },
        ],
      },
    ],
    [t]
  );

  const defaultRecentRuns = useMemo(
    () => [
      {
        id: "sales-today",
        name: t("reports.recent.salesToday"),
        ranAt: "2025-12-28 18:25",
        rows: 142,
        templateId: "daily-sales",
      },
      {
        id: "low-stock",
        name: t("reports.recent.lowStock"),
        ranAt: "2025-12-28 10:05",
        rows: 58,
        templateId: "low-stock",
      },
      {
        id: "tax-summary",
        name: t("reports.recent.tax"),
        ranAt: "2025-12-27 22:11",
        rows: 12,
        templateId: "tax-liability",
      },
    ],
    [t]
  );

  const sectionMeta = useMemo(() => {
    const meta = {};
    defaultCatalogSections.forEach((section) => {
      const key = typeof section.id === "string" ? section.id.toLowerCase() : section.id;
      if (key) {
        meta[key] = {
          title: section.title,
          description: section.description,
        };
      }
    });
    return meta;
  }, [defaultCatalogSections]);

  const [catalogState, setCatalogState] = useState({
    loading: false,
    error: "",
    sections: [],
  });

  const [recentState, setRecentState] = useState({
    loading: false,
    error: "",
    items: [],
  });

  const normalizeTemplates = useCallback(
    (payload) => {
      const list = Array.isArray(payload?.templates)
        ? payload.templates
        : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
        ? payload
        : [];

      if (list.length === 0) return [];

      const groups = new Map();

      list.forEach((item) => {
        if (!item) return;
        const categoryRaw =
          item.category || item.pillar || item.group || "uncategorized";
        const keyRaw = String(categoryRaw || "uncategorized");
        const key = keyRaw.toLowerCase();
        const labelOverride =
          item.categoryLabel ||
          item.pillarLabel ||
          item.groupLabel ||
          item.sectionLabel;
        const descriptionOverride =
          item.categoryDescription ||
          item.pillarDescription ||
          item.groupDescription ||
          item.sectionDescription;
        const meta =
          sectionMeta[key] ||
          sectionMeta[keyRaw] || {
            title:
              labelOverride ||
              (typeof categoryRaw === "string" && categoryRaw.trim().length > 0
                ? categoryRaw
                : t("reports.catalog.uncategorizedTitle")),
            description:
              descriptionOverride || t("reports.catalog.uncategorizedDescription"),
          };

        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            title: meta.title,
            description: meta.description,
            reports: [],
          });
        }

        const section = groups.get(key);
        const reportId =
          item.id ||
          item.templateId ||
          item.slug ||
          item.code ||
          item.identifier ||
          generateId();

        section.reports.push({
          id: String(reportId),
          title:
            item.title ||
            item.name ||
            item.displayName ||
            t("reports.recent.untitled"),
          description:
            item.description || item.summary || item.subtitle || "",
          template: item,
        });
      });

      return Array.from(groups.values()).map((section) => ({
        ...section,
        reports: section.reports.sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
        ),
      }));
    },
    [sectionMeta, t]
  );

  const normalizeRecent = useCallback(
    (payload) => {
      const list = Array.isArray(payload?.runs)
        ? payload.runs
        : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
        ? payload
        : [];

      return list.map((item) => {
        const rowsRaw =
          item.rows ?? item.rowCount ?? item.count ?? item.totalRows ?? 0;
        return {
          id: String(
            item.id ||
              item.runId ||
              item.jobId ||
              item.executionId ||
              generateId()
          ),
          name:
            item.name ||
            item.reportName ||
            item.title ||
            t("reports.recent.untitled"),
          ranAt: item.ranAt || item.runAt || item.executedAt || item.createdAt,
          rows: Number.isFinite(rowsRaw) ? rowsRaw : 0,
          templateId: item.templateId || item.reportId || null,
        };
      });
    },
    [t]
  );

  const normalizeSchedules = useCallback(
    (payload) => {
      const list = Array.isArray(payload?.schedules)
        ? payload.schedules
        : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
        ? payload
        : [];

      return list.map((item) => {
        if (!item) {
          return null;
        }
        const templateId =
          item.templateId || item.reportId || item.definitionId || "";
        const recipients = asArray(
          item.recipients || item.targets || item.emails || item.targetsList
        );
        return {
          id: String(
            item.id ||
              item.scheduleId ||
              item.jobId ||
              item.uuid ||
              generateId()
          ),
          name: item.name || item.title || item.label || t("reports.schedules.untitled"),
          description: item.description || item.summary || "",
          frequency:
            item.frequency ||
            item.cadence ||
            item.interval ||
            item.schedule ||
            "custom",
          time: item.time || item.at || item.runAt || item.executeAt || "",
          delivery:
            item.delivery ||
            item.channel ||
            item.method ||
            item.transport ||
            "email",
          recipients,
          format:
            item.format ||
            item.outputFormat ||
            item.exportFormat ||
            "csv",
          enabled: coerceBoolean(item.enabled ?? item.active ?? true, true),
          nextRunAt:
            item.nextRunAt ||
            item.nextRun ||
            item.nextExecutionAt ||
            item.next_execution_at ||
            "",
          lastRunAt:
            item.lastRunAt ||
            item.lastRun ||
            item.lastExecutionAt ||
            item.last_execution_at ||
            "",
          status: item.status || item.state || "",
          templateId,
          timezone: item.timezone || item.tz || DEFAULT_TIMEZONE,
          source: item.source || item.dataset || item.dataSource || "",
        };
      }).filter(Boolean);
    },
    [t]
  );

  const formatTimestamp = useCallback(
    (value) => {
      if (!value) return t("reports.recent.noTimestamp");
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return typeof value === "string" ? value : t("reports.recent.noTimestamp");
      }
      return date.toLocaleString();
    },
    [t]
  );

  useEffect(() => {
    if (!reportsApiEnabled) {
      setCatalogState({ loading: false, error: "", sections: [] });
      return;
    }
    let ignore = false;

    const fetchTemplates = async () => {
      setCatalogState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const { data } = await api.get("/api/reports/templates");
        if (ignore) return;
        const sections = normalizeTemplates(data);
        setCatalogState({ loading: false, error: "", sections });
      } catch (error) {
        if (ignore) return;
        const status = error?.response?.status;
        if (status === 404) {
          setCatalogState({ loading: false, error: "", sections: [] });
          return;
        }
        console.error("Failed to load report templates", error);
        setCatalogState((prev) => ({
          loading: false,
          error: t("reports.catalog.loadError"),
          sections: prev.sections,
        }));
      }
    };

    fetchTemplates();

    return () => {
      ignore = true;
    };
  }, [normalizeTemplates, reportsApiEnabled, t]);

  useEffect(() => {
    if (!reportsApiEnabled) {
      setRecentState({ loading: false, error: "", items: [] });
      return;
    }
    let ignore = false;

    const fetchRecent = async () => {
      setRecentState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const { data } = await api.get("/api/reports/recent");
        if (ignore) return;
        const items = normalizeRecent(data);
        setRecentState({ loading: false, error: "", items });
      } catch (error) {
        if (ignore) return;
        const status = error?.response?.status;
        if (status === 404) {
          setRecentState({ loading: false, error: "", items: [] });
          return;
        }
        console.error("Failed to load recent report runs", error);
        setRecentState((prev) => ({
          loading: false,
          error: t("reports.recent.loadError"),
          items: prev.items,
        }));
      }
    };

    fetchRecent();

    return () => {
      ignore = true;
    };
  }, [normalizeRecent, reportsApiEnabled, t]);

  const initialTab = useMemo(() => {
    if (typeof window === "undefined") return "catalog";
    return localStorage.getItem(STORAGE_KEYS.viewPref) || "catalog";
  }, []);
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (activeTab !== "schedules") return;
    if (!reportsApiEnabled) {
      setSchedulesState({ loading: false, error: "", items: [] });
      return;
    }

    let ignore = false;

    const fetchSchedules = async () => {
      setSchedulesState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const { data } = await api.get("/api/reports/schedules");
        if (ignore) return;
        const items = normalizeSchedules(data);
        setSchedulesState({ loading: false, error: "", items });
      } catch (error) {
        if (ignore) return;
        const status = error?.response?.status;
        if (status === 404) {
          setSchedulesState({ loading: false, error: "", items: [] });
          return;
        }
        console.error("Failed to load schedules", error);
        setSchedulesState((prev) => ({
          ...prev,
          loading: false,
          error: t("reports.schedules.loadError"),
        }));
      }
    };

    fetchSchedules();

    return () => {
      ignore = true;
    };
  }, [activeTab, normalizeSchedules, reportsApiEnabled, t]);

  const catalogSectionsToRender =
    catalogState.sections && catalogState.sections.length > 0
      ? catalogState.sections
      : defaultCatalogSections;

  const recentRunsToRender =
    recentState.items && recentState.items.length > 0
      ? recentState.items
      : defaultRecentRuns;

  const templateOptions = useMemo(() => {
    const options = [];
    catalogSectionsToRender.forEach((section) => {
      section.reports.forEach((report) => {
        options.push({ id: report.id, title: report.title });
      });
    });
    return options;
  }, [catalogSectionsToRender]);

  const initialSource = useMemo(() => {
    if (typeof window === "undefined") return dataSources[0];
    const storedId = localStorage.getItem(STORAGE_KEYS.templatePref);
    if (!storedId) return dataSources[0];
    return dataSources.find((source) => source.id === storedId) || dataSources[0];
  }, [dataSources]);
  const initialPayload = useMemo(() => {
    const base = createDefaultPayload(initialSource?.id, initialSource);
    const storedLimit = loadStoredLimit();
    if (storedLimit !== undefined) {
      base.limit = storedLimit;
    }
    return base;
  }, [initialSource]);
  const [payload, setPayload] = useState(initialPayload);
  const [previewState, setPreviewState] = useState({
    loading: false,
    error: "",
    columns: [],
    rows: [],
    ranAt: null,
    meta: null,
    pagination: null,
  });
  const [previewRequest, setPreviewRequest] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [builderMeta, setBuilderMeta] = useState(null);
  const [schedulesState, setSchedulesState] = useState({
    loading: false,
    error: "",
    items: [],
  });
  const [scheduleForm, setScheduleForm] = useState({
    id: null,
    name: "",
    description: "",
    frequency: "daily",
    time: "08:00",
    delivery: "email",
    recipients: "",
    format: "csv",
    enabled: true,
    timezone: DEFAULT_TIMEZONE,
    templateId: "",
    source: "",
    parameters: "",
  });
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);

  const currentSource = useMemo(
    () => dataSources.find((source) => source.id === payload.source),
    [dataSources, payload.source]
  );

  const sqlPayload = useMemo(
    () => ({
      ...payload,
      select: payload.select.filter((item) => item.field),
      filters: payload.filters.filter((filter) => filter.field && filter.operator),
      groupBy: payload.groupBy.filter(Boolean),
      sort: payload.sort.filter((item) => item.field),
    }),
    [payload]
  );

  const previewPayload = useMemo(() => {
    const sanitized = {
      source: payload.source,
      select: payload.select
        .filter((item) => item.field)
        .map((item) => {
          const entry = { field: item.field };
          if (item.agg) entry.agg = item.agg;
          if (item.alias) entry.alias = item.alias;
          return entry;
        }),
      filters: [],
      groupBy: payload.groupBy.filter(Boolean),
      sort: payload.sort
        .filter((item) => item.field)
        .map((item) => ({ field: item.field, direction: item.direction })),
      limit: payload.limit,
      timezone: payload.timezone,
    };

    payload.filters.forEach((filter, index) => {
      if (!filter.field || !filter.operator) return;
      const entry = { field: filter.field, operator: filter.operator };
      if (index > 0) {
        entry.logic = filter.logic || "AND";
      }
      if (filter.operator === "between") {
        const values = [filter.value, filter.secondaryValue].filter(Boolean);
        if (values.length === 2) {
          entry.value = values;
        }
      } else if (filter.operator === "in") {
        const values = filter.value
          .split(",")
          .map((token) => token.trim())
          .filter(Boolean);
        if (values.length > 0) {
          entry.value = values;
        }
      } else if (filter.value !== "") {
        entry.value = filter.value;
      }
      sanitized.filters.push(entry);
    });

    if (sanitized.select.length === 0) delete sanitized.select;
    if (sanitized.filters.length === 0) delete sanitized.filters;
    if (sanitized.groupBy.length === 0) delete sanitized.groupBy;
    if (sanitized.sort.length === 0) delete sanitized.sort;
    if (!sanitized.limit) delete sanitized.limit;
    if (!sanitized.timezone) delete sanitized.timezone;

    return sanitized;
  }, [payload]);

  const jsonPreview = useMemo(
    () => JSON.stringify(previewPayload, null, 2),
    [previewPayload]
  );

  const sqlPreview = useMemo(
    () => buildSql(sqlPayload, currentSource, t),
    [sqlPayload, currentSource, t]
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.viewPref, tab);
    }
  };

  const handleOpenTemplate = (report, section) => {
    if (!report) return;
    const result = createPayloadFromTemplate(report.template, {
      ...report,
      sectionId: section?.id,
      sectionTitle: section?.title,
      description: report.description,
    }, payload?.source);

    handleTabChange("builder");

    if (!result) {
      setActiveTemplate(null);
      setBuilderMeta(null);
      return;
    }

    setPayload(result.payload);
    setPreviewState((prev) => ({
      ...prev,
      loading: false,
      error: "",
      columns: [],
      rows: [],
      ranAt: null,
      meta: null,
      pagination: null,
    }));
    setPreviewRequest(null);

    const meta = result.meta || {};
    const normalizedTags = Array.isArray(meta.tags)
      ? meta.tags.filter(Boolean)
      : [];

    const templateDescriptor = {
      id: meta.id || report.id || generateId(),
      name: meta.name || report.title,
      sectionId: section?.id || null,
    };

    if (typeof window !== "undefined" && result.source?.id) {
      localStorage.setItem(STORAGE_KEYS.templatePref, result.source.id);
    }

    setActiveTemplate(templateDescriptor);
    setBuilderMeta({
      ...meta,
      name: meta.name || report.title,
      description: meta.description || report.description || "",
      tags: normalizedTags,
      sectionTitle: section?.title || "",
      sectionDescription: section?.description || "",
    });
  };

  const handleSourceChange = (event) => {
    const nextSourceId = event.target.value;
    const nextSource = dataSources.find((source) => source.id === nextSourceId);
    const nextPayload = createDefaultPayload(nextSourceId, nextSource);
    if (typeof window !== "undefined") {
      const storedLimit = localStorage.getItem(STORAGE_KEYS.limitPref);
      if (storedLimit) {
        const parsed = Number(storedLimit);
        if (Number.isFinite(parsed)) {
          nextPayload.limit = parsed;
        }
      }
      localStorage.setItem(STORAGE_KEYS.templatePref, nextSourceId);
    }
    setPayload(nextPayload);
    setPreviewState({
      loading: false,
      error: "",
      columns: [],
      rows: [],
      ranAt: null,
      meta: null,
      pagination: null,
    });
    setPreviewRequest(null);
    setActiveTemplate(null);
    setBuilderMeta(null);
  };

  const availableFields = currentSource?.fields || [];

  const handleAddSelect = () => {
    setPayload((prev) => ({
      ...prev,
      select: [
        ...prev.select,
        { id: generateId(), field: "", agg: "", alias: "" },
      ],
    }));
  };

  const handleUpdateSelect = (index, patch) => {
    setPayload((prev) => {
      const next = prev.select.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      );
      return { ...prev, select: next };
    });
  };

  const handleSelectFieldChange = (index, fieldId) => {
    const fieldMeta = availableFields.find((field) => field.id === fieldId);
    setPayload((prev) => {
      const current = prev.select[index] || {};
      const shouldResetAlias = !current.alias || current.alias === current.field;
      const nextAlias = shouldResetAlias ? fieldId : current.alias;
      const nextSelect = prev.select.map((item, idx) =>
        idx === index
          ? {
              ...item,
              field: fieldId,
              alias: nextAlias,
            }
          : item
      );
      return { ...prev, select: nextSelect };
    });
  };

  const handleRemoveSelect = (index) => {
    setPayload((prev) => ({
      ...prev,
      select: prev.select.filter((_, idx) => idx !== index),
    }));
  };

  const handleAddFilter = () => {
    setPayload((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        {
          id: generateId(),
          field: "",
          operator: "",
          value: "",
          secondaryValue: "",
          logic: "AND",
        },
      ],
    }));
  };

  const handleFilterFieldChange = (index, fieldId) => {
    const fieldMeta = availableFields.find((field) => field.id === fieldId);
    setPayload((prev) => {
      const operators = fieldMeta?.operators || [];
      const nextOperator = operators.includes(prev.filters[index]?.operator)
        ? prev.filters[index].operator
        : operators[0] || "";
      const nextFilters = prev.filters.map((filter, idx) =>
        idx === index
          ? {
              ...filter,
              field: fieldId,
              operator: nextOperator,
              value: "",
              secondaryValue: "",
            }
          : filter
      );
      return { ...prev, filters: nextFilters };
    });
  };

  const handleFilterOperatorChange = (index, operator) => {
    setPayload((prev) => {
      const nextFilters = prev.filters.map((filter, idx) =>
        idx === index
          ? {
              ...filter,
              operator,
              value: "",
              secondaryValue: "",
            }
          : filter
      );
      return { ...prev, filters: nextFilters };
    });
  };

  const handleFilterValueChange = (index, value, secondary = false) => {
    setPayload((prev) => {
      const nextFilters = prev.filters.map((filter, idx) =>
        idx === index
          ? secondary
            ? { ...filter, secondaryValue: value }
            : { ...filter, value }
          : filter
      );
      return { ...prev, filters: nextFilters };
    });
  };

  const handleFilterLogicChange = (index, logic) => {
    setPayload((prev) => {
      const nextFilters = prev.filters.map((filter, idx) =>
        idx === index ? { ...filter, logic } : filter
      );
      return { ...prev, filters: nextFilters };
    });
  };

  const handleRemoveFilter = (index) => {
    setPayload((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, idx) => idx !== index),
    }));
  };

  const handleToggleGroupBy = (fieldId) => {
    setPayload((prev) => {
      const exists = prev.groupBy.includes(fieldId);
      const nextGroupBy = exists
        ? prev.groupBy.filter((item) => item !== fieldId)
        : [...prev.groupBy, fieldId];
      return { ...prev, groupBy: nextGroupBy };
    });
  };

  const handleAddSort = () => {
    setPayload((prev) => ({
      ...prev,
      sort: [...prev.sort, { id: generateId(), field: "", direction: "asc" }],
    }));
  };

  const handleSortChange = (index, patch) => {
    setPayload((prev) => {
      const nextSort = prev.sort.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      );
      return { ...prev, sort: nextSort };
    });
  };

  const handleRemoveSort = (index) => {
    setPayload((prev) => ({
      ...prev,
      sort: prev.sort.filter((_, idx) => idx !== index),
    }));
  };

  const handleLimitChange = (event) => {
    const value = event.target.value;
    const parsed = Number(value);
    setPayload((prev) => ({
      ...prev,
      limit: value === "" || Number.isNaN(parsed) ? undefined : parsed,
    }));
    if (typeof window !== "undefined") {
      if (value === "" || Number.isNaN(parsed)) {
        localStorage.removeItem(STORAGE_KEYS.limitPref);
      } else {
        localStorage.setItem(STORAGE_KEYS.limitPref, String(parsed));
      }
    }
  };

  const handleTimezoneChange = (event) => {
    setPayload((prev) => ({
      ...prev,
      timezone: event.target.value,
    }));
  };

  const handleReset = () => {
    setPayload(createDefaultPayload(payload.source, currentSource));
    setPreviewState((prev) => ({
      ...prev,
      columns: [],
      rows: [],
      error: "",
      ranAt: null,
      meta: null,
      pagination: null,
    }));
    setPreviewRequest(null);
  };

  const valueInputType = (fieldMeta) => {
    if (!fieldMeta) return "text";
    if (fieldMeta.type === "number") return "number";
    if (fieldMeta.type === "date") return "date";
    return "text";
  };

  const normalizePreview = useCallback((data) => {
    const rows = Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
      ? data.data
      : [];

    let columns = Array.isArray(data?.columns) ? data.columns : [];

    if (columns.length === 0 && rows.length > 0) {
      const sample = rows[0];
      if (Array.isArray(sample)) {
        columns = sample.map((_, idx) => `col_${idx + 1}`);
      } else if (sample && typeof sample === "object") {
        columns = Object.keys(sample);
      }
    }

    if (columns.length === 0) {
      columns = ["value"];
    }

    const formattedColumns = columns.map((col, idx) => {
      if (typeof col === "string") {
        return { id: col, label: col };
      }
      if (col && typeof col === "object") {
        const id = col.id || col.alias || col.name || `col_${idx + 1}`;
        const label = col.label || col.alias || col.name || id;
        return { id, label };
      }
      const fallback = `col_${idx + 1}`;
      return { id: fallback, label: fallback };
    });

    const normalizedRows = rows.map((row) => {
      if (Array.isArray(row)) {
        const obj = {};
        formattedColumns.forEach((col, idx) => {
          obj[col.id] = row[idx];
        });
        return obj;
      }
      if (row && typeof row === "object") return row;
      return { value: row };
    });

    const rawMeta = (data && data.meta) || {};
    const meta = { ...rawMeta };
    if (meta.durationMs === undefined) {
      if (typeof rawMeta.duration === "number") {
        meta.durationMs = rawMeta.duration;
      } else if (typeof rawMeta.executionMs === "number") {
        meta.durationMs = rawMeta.executionMs;
      } else if (typeof rawMeta.timing?.execution === "number") {
        meta.durationMs = rawMeta.timing.execution;
      }
    }
    if (!meta.queryId) {
      meta.queryId =
        rawMeta.queryId ||
        rawMeta.requestId ||
        rawMeta.jobId ||
        rawMeta.executionId ||
        null;
    }
    if (!meta.generatedAt) {
      meta.generatedAt =
        rawMeta.generatedAt ||
        rawMeta.generated_at ||
        rawMeta.timestamp ||
        rawMeta.completedAt ||
        rawMeta.finishedAt ||
        null;
    }
    if (!meta.source && rawMeta.dataset) {
      meta.source = rawMeta.dataset;
    }
    const paginationRaw =
      meta.pagination || data?.pagination || data?.pageInfo || {};

    const rawPage =
      paginationRaw.page ??
      paginationRaw.currentPage ??
      paginationRaw.pageNumber ??
      paginationRaw.index ??
      meta.page ??
      null;
    const page =
      typeof rawPage === "number"
        ? rawPage
        : typeof rawPage === "string" && rawPage.trim() !== ""
        ? Number(rawPage)
        : null;

    const rawPageSize =
      paginationRaw.pageSize ??
      paginationRaw.perPage ??
      paginationRaw.limit ??
      paginationRaw.size ??
      meta.pageSize ??
      null;
    const pageSize =
      typeof rawPageSize === "number"
        ? rawPageSize
        : typeof rawPageSize === "string" && rawPageSize.trim() !== ""
        ? Number(rawPageSize)
        : null;

    const rawTotal =
      paginationRaw.total ??
      paginationRaw.totalRows ??
      paginationRaw.count ??
      paginationRaw.totalCount ??
      meta.totalRows ??
      meta.rowCount ??
      null;
    const totalRows =
      typeof rawTotal === "number"
        ? rawTotal
        : typeof rawTotal === "string" && rawTotal.trim() !== ""
        ? Number(rawTotal)
        : null;

    const nextCursor =
      paginationRaw.nextCursor ||
      paginationRaw.next ||
      paginationRaw.nextToken ||
      meta.nextCursor ||
      null;
    const prevCursor =
      paginationRaw.prevCursor ||
      paginationRaw.previous ||
      paginationRaw.prevToken ||
      paginationRaw.before ||
      meta.prevCursor ||
      meta.previousCursor ||
      null;

    const hasNumericPagination =
      typeof page === "number" &&
      typeof pageSize === "number" &&
      pageSize > 0 &&
      (typeof totalRows === "number" ? totalRows >= 0 : true);

    const numericHasNext = hasNumericPagination
      ? typeof totalRows === "number"
        ? (page + 1) * pageSize < totalRows
        : normalizedRows.length === pageSize
      : false;
    const numericHasPrev = hasNumericPagination ? page > 0 : false;

    const pagination =
      nextCursor ||
      prevCursor ||
      hasNumericPagination ||
      typeof totalRows === "number"
        ? {
            page,
            pageSize,
            totalRows,
            nextCursor: nextCursor || null,
            prevCursor: prevCursor || null,
            hasNext: Boolean(nextCursor) || numericHasNext,
            hasPrev: Boolean(prevCursor) || numericHasPrev,
          }
        : null;

    return {
      columns: formattedColumns,
      rows: normalizedRows,
      meta,
      pagination,
    };
  }, []);

  const runPreview = useCallback(
    async (options = {}) => {
      if (!payload.source) {
        setPreviewState((prev) => ({
          ...prev,
          error: t("reports.builder.preview.noSource"),
        }));
        return null;
      }

      if (!reportsApiEnabled) {
        setPreviewState({
          loading: false,
          error: t("reports.builder.preview.disabled"),
          columns: [],
          rows: [],
          ranAt: null,
          meta: null,
          pagination: null,
        });
        return null;
      }

      const basePayload = JSON.parse(JSON.stringify(previewPayload));
      const requestPayload = { ...basePayload };

      if (options.resetCursor) {
        delete requestPayload.cursor;
        delete requestPayload.page;
      }

      if (options.cursor) {
        requestPayload.cursor = options.cursor;
      }

      if (typeof options.page === "number" && !Number.isNaN(options.page)) {
        requestPayload.page = options.page;
      }

      if (
        typeof options.pageSize === "number" &&
        !Number.isNaN(options.pageSize) &&
        options.pageSize > 0
      ) {
        requestPayload.pageSize = options.pageSize;
      }

      if (options.exportFormat) {
        requestPayload.exportFormat = options.exportFormat;
      }

      setPreviewState((prev) => ({
        ...prev,
        loading: true,
        error: "",
        columns: options.keepColumns ? prev.columns : [],
        rows: options.keepColumns ? prev.rows : [],
        meta: options.keepColumns ? prev.meta : null,
        pagination: options.keepColumns ? prev.pagination : null,
      }));

      try {
        const { data } = await api.post("/api/reports/preview", requestPayload);
        const normalized = normalizePreview(data);
        setPreviewState({
          loading: false,
          error: "",
          columns: normalized.columns,
          rows: normalized.rows,
          ranAt: new Date().toISOString(),
          meta: normalized.meta || null,
          pagination: normalized.pagination
            ? {
                ...normalized.pagination,
                pageSize:
                  normalized.pagination.pageSize || requestPayload.pageSize || basePayload.limit || DEFAULT_PAGE_SIZE,
              }
            : null,
        });
        setPreviewRequest({
          payload: basePayload,
          options: {
            cursor: requestPayload.cursor || null,
            page:
              typeof requestPayload.page === "number"
                ? requestPayload.page
                : null,
            pageSize:
              typeof requestPayload.pageSize === "number"
                ? requestPayload.pageSize
                : null,
          },
        });
        return normalized;
      } catch (error) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          t("reports.builder.preview.error");
        setPreviewState({
          loading: false,
          error: message,
          columns: [],
          rows: [],
          ranAt: null,
          meta: null,
          pagination: null,
        });
        throw error;
      }
    },
    [payload.source, previewPayload, reportsApiEnabled, t, normalizePreview]
  );

  const handlePreview = async () => {
    await runPreview({ resetCursor: true });
  };

  const handlePreviewNextPage = async () => {
    if (!previewState.pagination) return;
    const { nextCursor, page, pageSize, hasNext } = previewState.pagination;
    if (!hasNext) return;
    const nextPageNumber =
      typeof page === "number" && !Number.isNaN(page) ? page + 1 : undefined;
    await runPreview({
      cursor: nextCursor || undefined,
      page: nextCursor ? undefined : nextPageNumber,
      pageSize: pageSize || undefined,
      keepColumns: true,
    });
  };

  const handlePreviewPrevPage = async () => {
    if (!previewState.pagination) return;
    const { prevCursor, page, pageSize, hasPrev } = previewState.pagination;
    if (!hasPrev) return;
    const prevPageNumber =
      typeof page === "number" && !Number.isNaN(page) ? Math.max(page - 1, 0) : 0;
    await runPreview({
      cursor: prevCursor || undefined,
      page: prevCursor ? undefined : prevPageNumber,
      pageSize: pageSize || undefined,
      keepColumns: true,
    });
  };

  const handlePreviewRefresh = async () => {
    if (!previewRequest) {
      await runPreview({ resetCursor: true });
      return;
    }
    await runPreview({
      cursor: previewRequest.options.cursor || undefined,
      page: previewRequest.options.page ?? undefined,
      pageSize: previewRequest.options.pageSize || undefined,
      keepColumns: true,
    });
  };

  const handlePreviewPageSizeChange = async (event) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value) || value <= 0) return;
    setPayload((prev) => ({
      ...prev,
      limit: value,
    }));
    await runPreview({ resetCursor: true, pageSize: value });
  };

  const downloadPreviewFile = (content, filename, mimeType) => {
    if (typeof window === "undefined") return;
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePreviewExport = async (format) => {
    if (!previewState.rows || previewState.rows.length === 0) return;
    const safeFormat = EXPORT_FORMATS.includes(format) ? format : "csv";
    const baseName = activeTemplate?.id || payload.source || "report";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (safeFormat === "json") {
      const content = JSON.stringify(previewState.rows, null, 2);
      downloadPreviewFile(
        content,
        `${baseName}-${timestamp}.json`,
        "application/json"
      );
      return;
    }

    const binaryFormats = {
      xlsx: {
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
      },
      pdf: {
        mime: "application/pdf",
        extension: "pdf",
      },
    };

    if (binaryFormats[safeFormat] && reportsApiEnabled) {
      try {
        const basePayload = previewRequest?.payload || previewPayload;
        const exportPayload = {
          ...basePayload,
          exportFormat: safeFormat,
        };
        if (previewRequest?.options.cursor) {
          exportPayload.cursor = previewRequest.options.cursor;
        }
        if (
          typeof previewRequest?.options.page === "number" &&
          !Number.isNaN(previewRequest.options.page)
        ) {
          exportPayload.page = previewRequest.options.page;
        }
        if (
          typeof previewRequest?.options.pageSize === "number" &&
          !Number.isNaN(previewRequest.options.pageSize)
        ) {
          exportPayload.pageSize = previewRequest.options.pageSize;
        }
        const response = await api.post("/api/reports/export", exportPayload, {
          responseType: "blob",
        });
        downloadPreviewFile(
          response.data,
          `${baseName}-${timestamp}.${binaryFormats[safeFormat].extension}`,
          binaryFormats[safeFormat].mime
        );
        return;
      } catch (error) {
        console.warn("Falling back to CSV export", error);
      }
    }

    const header = previewState.columns.map((column) => column.label);
    const rows = previewState.rows.map((row) =>
      previewState.columns
        .map((column) => {
          const raw = row[column.id] ?? "";
          if (raw === null || raw === undefined) return "";
          const value = String(raw);
          if (value.includes(",") || value.includes("\"")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    );
    const csvContent = [header.join(","), ...rows].join("\n");
    downloadPreviewFile(csvContent, `${baseName}-${timestamp}.csv`, "text/csv");
  };

  const resetScheduleForm = (overrides = {}) => {
    setScheduleForm({
      id: null,
      name: "",
      description: "",
      frequency: "daily",
      time: "08:00",
      delivery: "email",
      recipients: "",
      format: "csv",
      enabled: true,
      timezone: payload.timezone || DEFAULT_TIMEZONE,
      templateId: activeTemplate?.id || "",
      source: payload.source,
      parameters: "",
      ...overrides,
    });
    setEditingScheduleId(null);
  };

  const handleScheduleFieldChange = (field, value) => {
    setScheduleForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNewSchedule = () => {
    resetScheduleForm();
    setIsScheduleFormOpen(true);
  };

  const handleEditSchedule = (schedule) => {
    if (!schedule) return;
    resetScheduleForm({
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      frequency: schedule.frequency || "custom",
      time: schedule.time || "",
      delivery: schedule.delivery || "email",
      recipients: Array.isArray(schedule.recipients)
        ? schedule.recipients.join(", ")
        : schedule.recipients || "",
      format: schedule.format || "csv",
      enabled: coerceBoolean(schedule.enabled, true),
      timezone: schedule.timezone || payload.timezone || DEFAULT_TIMEZONE,
      templateId: schedule.templateId || activeTemplate?.id || "",
      source: schedule.source || payload.source,
      parameters: schedule.parameters || "",
    });
    setEditingScheduleId(schedule.id);
    setIsScheduleFormOpen(true);
  };

  const applyScheduleOptimistic = (schedule) => {
    setSchedulesState((prev) => {
      const exists = prev.items.some((item) => item.id === schedule.id);
      const items = exists
        ? prev.items.map((item) => (item.id === schedule.id ? schedule : item))
        : [...prev.items, schedule];
      return {
        ...prev,
        items,
      };
    });
  };

  const handleScheduleSubmit = async (event) => {
    event.preventDefault();
    const recipientsArray = asArray(scheduleForm.recipients);
    const payloadBody = {
      name: scheduleForm.name,
      description: scheduleForm.description,
      frequency: scheduleForm.frequency,
      time: scheduleForm.time,
      delivery: scheduleForm.delivery,
      recipients: recipientsArray,
      format: scheduleForm.format,
      enabled: scheduleForm.enabled,
      timezone: scheduleForm.timezone,
      templateId: scheduleForm.templateId || activeTemplate?.id || "",
      source: scheduleForm.source || payload.source,
      parameters: scheduleForm.parameters,
    };

    const optimisticSchedule = {
      id: scheduleForm.id || generateId(),
      ...payloadBody,
      recipients: recipientsArray,
      nextRunAt: "",
      lastRunAt: "",
      status: "scheduled",
    };

    applyScheduleOptimistic(optimisticSchedule);

    if (!reportsApiEnabled) {
      setIsScheduleFormOpen(false);
      resetScheduleForm();
      return;
    }

    try {
      if (editingScheduleId) {
        const { data } = await api.put(
          `/api/reports/schedules/${editingScheduleId}`,
          payloadBody
        );
        const normalized = normalizeSchedules([data])[0] || optimisticSchedule;
        applyScheduleOptimistic({ ...normalized, id: editingScheduleId });
      } else {
        const { data } = await api.post(
          "/api/reports/schedules",
          payloadBody
        );
        const normalized = normalizeSchedules([data])[0] || optimisticSchedule;
        applyScheduleOptimistic(normalized);
      }
      setIsScheduleFormOpen(false);
      resetScheduleForm();
    } catch (error) {
      console.error("Failed to save schedule", error);
      setSchedulesState((prev) => ({
        ...prev,
        error: error?.response?.data?.message || error?.message || t("reports.schedules.saveError"),
      }));
    }
  };

  const handleScheduleDelete = async (scheduleId) => {
    if (!scheduleId) return;
    setSchedulesState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== scheduleId),
    }));

    if (!reportsApiEnabled) return;

    try {
      await api.delete(`/api/reports/schedules/${scheduleId}`);
    } catch (error) {
      console.error("Failed to delete schedule", error);
      setSchedulesState((prev) => ({
        ...prev,
        error: error?.response?.data?.message || error?.message || t("reports.schedules.deleteError"),
      }));
    }
  };

  const handleScheduleToggle = async (schedule) => {
    if (!schedule) return;
    const nextEnabled = !coerceBoolean(schedule.enabled, true);
    const updated = { ...schedule, enabled: nextEnabled };
    applyScheduleOptimistic(updated);

    if (!reportsApiEnabled) return;

    try {
      await api.patch(`/api/reports/schedules/${schedule.id}`, {
        enabled: nextEnabled,
      });
    } catch (error) {
      console.error("Failed to toggle schedule", error);
      applyScheduleOptimistic(schedule);
      setSchedulesState((prev) => ({
        ...prev,
        error: error?.response?.data?.message || error?.message || t("reports.schedules.toggleError"),
      }));
    }
  };

  return (
    <div className="reports-page page wide">
      <header className="reports-header">
        <div>
          <h1>{t("reports.title")}</h1>
          <p className="muted">{t("reports.subtitle")}</p>
        </div>
        <div className="reports-tablist">
          <button
            type="button"
            className={`reports-tab ${activeTab === "catalog" ? "active" : ""}`}
            onClick={() => handleTabChange("catalog")}
          >
            {t("reports.tabs.catalog")}
          </button>
          <button
            type="button"
            className={`reports-tab ${activeTab === "builder" ? "active" : ""}`}
            onClick={() => handleTabChange("builder")}
          >
            {t("reports.tabs.builder")}
          </button>
          <button
            type="button"
            className={`reports-tab ${activeTab === "schedules" ? "active" : ""}`}
            onClick={() => handleTabChange("schedules")}
          >
            {t("reports.tabs.schedules")}
          </button>
        </div>
      </header>

      {activeTab === "catalog" && (
        <div className="reports-catalog">
          <section className="card reports-intro">
            <h2>{t("reports.catalog.heading")}</h2>
            <p className="muted">{t("reports.catalog.description")}</p>
            {!reportsApiEnabled && (
              <div className="status info">
                {t("reports.catalog.disabled")}
              </div>
            )}
            <div className="reports-quick-actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => handleTabChange("builder")}
              >
                {t("reports.catalog.quickStart")}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => handleTabChange("schedules")}
              >
                {t("reports.catalog.manageSchedules")}
              </button>
            </div>
          </section>

          {catalogState.error && (
            <div className="status error">{catalogState.error}</div>
          )}

          {catalogState.loading && (
            <p className="muted small">{t("reports.catalog.loading")}</p>
          )}

          <div className="reports-grid">
            {catalogSectionsToRender.map((section) => (
              <section key={section.id} className="card report-section">
                <div className="report-section-header">
                  <h3>{section.title}</h3>
                  <p className="muted small">{section.description}</p>
                </div>
                <ul className="reports-section-list">
                  {section.reports.map((report) => (
                    <li key={report.id}>
                      <div className="reports-section-text">
                        <strong>{report.title}</strong>
                        <p className="muted small">{report.description}</p>
                      </div>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => handleOpenTemplate(report, section)}
                      >
                        {t("reports.actions.open")}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="card reports-recent">
            <h3>{t("reports.recent.title")}</h3>
            {recentState.error && (
              <div className="status error">{recentState.error}</div>
            )}
            {recentState.loading && (
              <p className="muted small">{t("reports.recent.loading")}</p>
            )}
            <ul className="reports-recent-list">
              {recentRunsToRender.map((run) => (
                <li key={run.id}>
                  <div>
                    <strong>{run.name}</strong>
                    <p className="muted small">
                      {t("reports.recent.meta", {
                        ranAt: formatTimestamp(run.ranAt),
                        rows: run.rows ?? 0,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() =>
                      handleOpenTemplate({ ...run, title: run.name }, null)
                    }
                  >
                    {t("reports.actions.open")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {activeTab === "builder" && (
        <div className="reports-builder-grid">
          <section className="card reports-config">
            <header className="reports-section-header">
              <h2>{t("reports.builder.title")}</h2>
              <p className="muted small">{t("reports.builder.subtitle")}</p>
            </header>

            {!reportsApiEnabled && (
              <div className="status info">
                {t("reports.builder.apiDisabled")}
              </div>
            )}

            {builderMeta && (
              <div className="reports-template-meta">
                <div className="reports-meta-heading">
                  <span className="muted tiny">
                    {t("reports.meta.loadedFrom")}
                  </span>
                  <strong>{builderMeta.name}</strong>
                </div>
                {builderMeta.description && (
                  <p className="muted small">{builderMeta.description}</p>
                )}
                <div className="reports-meta-tags">
                  {builderMeta.sectionTitle && (
                    <span className="reports-tag subdued">
                      {builderMeta.sectionTitle}
                    </span>
                  )}
                  {Array.isArray(builderMeta.tags) &&
                    builderMeta.tags.map((tag) => (
                      <span key={tag} className="reports-tag">
                        {tag}
                      </span>
                    ))}
                </div>
                <dl className="reports-meta-grid">
                  {builderMeta.sourceLabel && (
                    <>
                      <dt>{t("reports.meta.source")}</dt>
                      <dd>{builderMeta.sourceLabel}</dd>
                    </>
                  )}
                  {builderMeta.owner && (
                    <>
                      <dt>{t("reports.meta.owner")}</dt>
                      <dd>{builderMeta.owner}</dd>
                    </>
                  )}
                  {builderMeta.version && (
                    <>
                      <dt>{t("reports.meta.version")}</dt>
                      <dd>{builderMeta.version}</dd>
                    </>
                  )}
                  {builderMeta.updatedAt && (
                    <>
                      <dt>{t("reports.meta.updatedAt")}</dt>
                      <dd>{formatTimestamp(builderMeta.updatedAt)}</dd>
                    </>
                  )}
                  {builderMeta.scheduleCount !== undefined && (
                    <>
                      <dt>{t("reports.meta.schedules")}</dt>
                      <dd>{builderMeta.scheduleCount}</dd>
                    </>
                  )}
                </dl>
              </div>
            )}

            <div className="reports-control-group">
              <label>
                <span>{t("reports.builder.datasetLabel")}</span>
                <select value={payload.source} onChange={handleSourceChange}>
                  {dataSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              {currentSource?.description && (
                <p className="muted small reports-source-description">
                  {currentSource.description}
                </p>
              )}
            </div>

            <div className="reports-fieldset">
              <div className="reports-fieldset-header">
                <h3>{t("reports.builder.columnsTitle")}</h3>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleAddSelect}
                >
                  {t("reports.builder.addColumn")}
                </button>
              </div>
              {payload.select.length === 0 && (
                <p className="muted small">{t("reports.builder.emptyColumns")}</p>
              )}
              {payload.select.map((column, index) => {
                const fieldMeta = availableFields.find(
                  (field) => field.id === column.field
                );
                return (
                  <div key={column.id || index} className="reports-row">
                    <select
                      value={column.field}
                      onChange={(event) =>
                        handleSelectFieldChange(index, event.target.value)
                      }
                    >
                      <option value="">{t("reports.builder.pickField")}</option>
                      {availableFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={column.agg}
                      onChange={(event) =>
                        handleUpdateSelect(index, { agg: event.target.value })
                      }
                    >
                      {AGGREGATE_OPTIONS.map((agg) => (
                        <option key={agg || "none"} value={agg}>
                          {t(`reports.builder.aggregates.${agg || "none"}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={column.alias || ""}
                      placeholder={t("reports.builder.aliasPlaceholder")}
                      onChange={(event) =>
                        handleUpdateSelect(index, { alias: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="btn ghost reports-remove"
                      onClick={() => handleRemoveSelect(index)}
                    >
                      {t("reports.builder.remove")}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="reports-fieldset">
              <div className="reports-fieldset-header">
                <h3>{t("reports.builder.filtersTitle")}</h3>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleAddFilter}
                >
                  {t("reports.builder.addFilter")}
                </button>
              </div>
              {payload.filters.length === 0 && (
                <p className="muted small">{t("reports.builder.emptyFilters")}</p>
              )}
              {payload.filters.map((filter, index) => {
                const fieldMeta = availableFields.find(
                  (field) => field.id === filter.field
                );
                const operators = fieldMeta?.operators || [];
                const inputType = valueInputType(fieldMeta);
                return (
                  <div key={filter.id || index} className="reports-row filters">
                    {index > 0 && (
                      <select
                        value={filter.logic}
                        onChange={(event) =>
                          handleFilterLogicChange(index, event.target.value)
                        }
                      >
                        {LOGIC_OPTIONS.map((logic) => (
                          <option key={logic} value={logic}>
                            {t(`reports.builder.logic.${logic.toLowerCase()}`)}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      value={filter.field}
                      onChange={(event) =>
                        handleFilterFieldChange(index, event.target.value)
                      }
                    >
                      <option value="">{t("reports.builder.pickField")}</option>
                      {availableFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(event) =>
                        handleFilterOperatorChange(index, event.target.value)
                      }
                    >
                      <option value="">{t("reports.builder.pickOperator")}</option>
                      {operators.map((operator) => (
                        <option key={operator} value={operator}>
                          {t(`reports.builder.operators.${operator}`)}
                        </option>
                      ))}
                    </select>
                    {filter.operator === "between" ? (
                      <div className="reports-value-range">
                        <input
                          type={inputType}
                          value={filter.value}
                          placeholder={t("reports.builder.fromLabel")}
                          onChange={(event) =>
                            handleFilterValueChange(index, event.target.value)
                          }
                        />
                        <input
                          type={inputType}
                          value={filter.secondaryValue}
                          placeholder={t("reports.builder.toLabel")}
                          onChange={(event) =>
                            handleFilterValueChange(
                              index,
                              event.target.value,
                              true
                            )
                          }
                        />
                      </div>
                    ) : filter.operator === "in" ? (
                      <textarea
                        rows={1}
                        value={filter.value}
                        placeholder={t("reports.builder.listPlaceholder")}
                        onChange={(event) =>
                          handleFilterValueChange(index, event.target.value)
                        }
                      />
                    ) : (
                      <input
                        type={inputType}
                        value={filter.value}
                        placeholder={t("reports.builder.valuePlaceholder")}
                        onChange={(event) =>
                          handleFilterValueChange(index, event.target.value)
                        }
                      />
                    )}
                    <button
                      type="button"
                      className="btn ghost reports-remove"
                      onClick={() => handleRemoveFilter(index)}
                    >
                      {t("reports.builder.remove")}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="reports-fieldset">
              <div className="reports-fieldset-header">
                <h3>{t("reports.builder.groupByTitle")}</h3>
              </div>
              <div className="reports-checkbox-list">
                {availableFields
                  .filter((field) => field.groupable)
                  .map((field) => (
                    <label key={field.id} className="reports-checkbox">
                      <input
                        type="checkbox"
                        checked={payload.groupBy.includes(field.id)}
                        onChange={() => handleToggleGroupBy(field.id)}
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
              </div>
            </div>

            <div className="reports-fieldset">
              <div className="reports-fieldset-header">
                <h3>{t("reports.builder.sortTitle")}</h3>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleAddSort}
                >
                  {t("reports.builder.addSort")}
                </button>
              </div>
              {payload.sort.length === 0 && (
                <p className="muted small">{t("reports.builder.emptySort")}</p>
              )}
              {payload.sort.map((sort, index) => (
                <div key={sort.id || index} className="reports-row">
                  <select
                    value={sort.field}
                    onChange={(event) =>
                      handleSortChange(index, { field: event.target.value })
                    }
                  >
                    <option value="">{t("reports.builder.pickField")}</option>
                    {availableFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sort.direction}
                    onChange={(event) =>
                      handleSortChange(index, { direction: event.target.value })
                    }
                  >
                    {SORT_DIRECTIONS.map((direction) => (
                      <option key={direction} value={direction}>
                        {t(`reports.builder.directions.${direction}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn ghost reports-remove"
                    onClick={() => handleRemoveSort(index)}
                  >
                    {t("reports.builder.remove")}
                  </button>
                </div>
              ))}
            </div>

            <div className="reports-fieldset inline">
              <label>
                <span>{t("reports.builder.limitLabel")}</span>
                <input
                  type="number"
                  min="0"
                  value={payload.limit ?? ""}
                  placeholder={t("reports.builder.limitPlaceholder")}
                  onChange={handleLimitChange}
                />
              </label>
              <label>
                <span>{t("reports.builder.timezoneLabel")}</span>
                <select value={payload.timezone || ""} onChange={handleTimezoneChange}>
                  <option value="">{t("reports.builder.timezonePlaceholder")}</option>
                  <option value="America/Santiago">America/Santiago</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/Madrid">Europe/Madrid</option>
                </select>
              </label>
            </div>

            <div className="reports-actions">
              <button type="button" className="btn ghost" onClick={handleReset}>
                {t("reports.builder.reset")}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handlePreview}
                disabled={previewState.loading}
              >
                {previewState.loading
                  ? t("reports.builder.previewLoading")
                  : t("reports.builder.previewAction")}
              </button>
            </div>
          </section>

          <section className="card reports-preview">
            <h2>{t("reports.builder.previewTitle")}</h2>
            <p className="muted small">{t("reports.builder.previewHint")}</p>
            {previewState.error && (
              <div className="status error">
                {previewState.error}
              </div>
            )}
            {!previewState.error &&
              !previewState.loading &&
              previewState.ranAt && (
                <p className="muted tiny">
                  {t("reports.builder.previewMeta", {
                    ranAt: new Date(previewState.ranAt).toLocaleString(),
                    rows: previewState.rows.length,
                  })}
                </p>
              )}
            <div className="reports-preview-block">
              <div className="reports-preview-header">
                <h3>{t("reports.builder.jsonTitle")}</h3>
              </div>
              <pre>{jsonPreview}</pre>
            </div>
            <div className="reports-preview-block">
              <div className="reports-preview-header">
                <h3>{t("reports.builder.sqlTitle")}</h3>
              </div>
              <pre>{sqlPreview}</pre>
            </div>
            <div className="reports-preview-block">
              <div className="reports-preview-header">
                <h3>{t("reports.builder.resultTitle")}</h3>
              </div>
              {previewState.loading ? (
                <p className="muted small">{t("reports.builder.previewRunning")}</p>
              ) : previewState.rows.length === 0 ? (
                <p className="muted small">{t("reports.builder.previewEmpty")}</p>
              ) : (
                <>
                  <div className="reports-preview-table-wrapper">
                    <table className="reports-preview-table">
                      <thead>
                        <tr>
                          {previewState.columns.map((column) => (
                            <th key={column.id}>{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewState.rows.map((row, rowIdx) => (
                          <tr key={`row_${rowIdx}`}>
                            {previewState.columns.map((column) => (
                              <td key={`${rowIdx}_${column.id}`}>
                                {row[column.id] ?? row[column.label] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="reports-preview-controls">
                    <div className="reports-preview-pagination">
                      <div className="reports-preview-buttons">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={handlePreviewPrevPage}
                          disabled={
                            previewState.loading ||
                            !previewState.pagination ||
                            !previewState.pagination.hasPrev
                          }
                        >
                          {t("reports.builder.pagination.prev")}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={handlePreviewRefresh}
                          disabled={previewState.loading}
                        >
                          {t("reports.builder.pagination.refresh")}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={handlePreviewNextPage}
                          disabled={
                            previewState.loading ||
                            !previewState.pagination ||
                            !previewState.pagination.hasNext
                          }
                        >
                          {t("reports.builder.pagination.next")}
                        </button>
                      </div>
                      <div className="reports-preview-info">
                        {previewState.pagination ? (
                          <span className="muted tiny">
                            {typeof previewState.pagination.page === "number"
                              ? t("reports.builder.pagination.pageLabel", {
                                  current: previewState.pagination.page + 1,
                                })
                              : t("reports.builder.pagination.cursorMode")}
                            {typeof previewState.pagination.totalRows === "number"
                              ? ` · ${t("reports.builder.pagination.totalLabel", {
                                  total: previewState.pagination.totalRows,
                                })}`
                              : ""}
                          </span>
                        ) : (
                          <span className="muted tiny">
                            {t("reports.builder.pagination.singlePage")}
                          </span>
                        )}
                        <label className="reports-page-size">
                          <span>{t("reports.builder.pagination.pageSize")}</span>
                          <select
                            value={
                              previewState.pagination?.pageSize ||
                              payload.limit ||
                              DEFAULT_PAGE_SIZE
                            }
                            onChange={handlePreviewPageSizeChange}
                            disabled={previewState.loading}
                          >
                            {PAGE_SIZE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="reports-preview-exports">
                      {EXPORT_FORMATS.map((format) => (
                        <button
                          key={format}
                          type="button"
                          className="btn ghost"
                          onClick={() => handlePreviewExport(format)}
                          disabled={previewState.loading}
                        >
                          {t(`reports.builder.export.${format}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {previewState.meta && (
                    <dl className="reports-preview-meta">
                      {previewState.meta.queryId && (
                        <>
                          <dt>{t("reports.builder.meta.queryId")}</dt>
                          <dd>{previewState.meta.queryId}</dd>
                        </>
                      )}
                      {previewState.meta.durationMs && (
                        <>
                          <dt>{t("reports.builder.meta.duration")}</dt>
                          <dd>
                            {t("reports.builder.meta.durationValue", {
                              value: previewState.meta.durationMs,
                            })}
                          </dd>
                        </>
                      )}
                      {previewState.meta.source && (
                        <>
                          <dt>{t("reports.builder.meta.source")}</dt>
                          <dd>{previewState.meta.source}</dd>
                        </>
                      )}
                      {previewState.meta.generatedAt && (
                        <>
                          <dt>{t("reports.builder.meta.generatedAt")}</dt>
                          <dd>{formatTimestamp(previewState.meta.generatedAt)}</dd>
                        </>
                      )}
                    </dl>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "schedules" && (
        <section className="card reports-schedules">
          <div className="reports-schedules-header">
            <div>
              <h2>{t("reports.schedules.title")}</h2>
              <p className="muted">
                {t("reports.schedules.description")}
              </p>
            </div>
            <button type="button" className="btn primary" onClick={handleNewSchedule}>
              {t("reports.schedules.addSchedule")}
            </button>
          </div>

          {schedulesState.error && (
            <div className="status error">{schedulesState.error}</div>
          )}

          {schedulesState.loading && (
            <p className="muted small">{t("reports.schedules.loading")}</p>
          )}

          {schedulesState.items.length === 0 && !schedulesState.loading ? (
            <p className="muted small">{t("reports.schedules.empty")}</p>
          ) : (
            <ul className="reports-schedule-list">
              {schedulesState.items.map((schedule) => (
                <li key={schedule.id}>
                  <div className="reports-schedule-content">
                    <div className="reports-schedule-heading">
                      <strong>{schedule.name}</strong>
                      <span
                        className={`reports-status ${coerceBoolean(schedule.enabled, true) ? "success" : "warning"}`}
                      >
                        {coerceBoolean(schedule.enabled, true)
                          ? t("reports.schedules.enabled")
                          : t("reports.schedules.disabled")}
                      </span>
                    </div>
                    {schedule.description && (
                      <p className="muted small">{schedule.description}</p>
                    )}
                    <p className="muted tiny">
                      {t("reports.schedules.summary", {
                        frequency: t(
                          `reports.schedules.frequency.${
                            schedule.frequency || "custom"
                          }`
                        ),
                        time: schedule.time || t("reports.schedules.timeAny"),
                        delivery: t(
                          `reports.schedules.delivery.${
                            schedule.delivery || "email"
                          }`
                        ),
                      })}
                    </p>
                    <div className="reports-schedule-meta">
                      <span>
                        {t("reports.schedules.formatLabel", {
                          format: String(schedule.format || "csv").toUpperCase(),
                        })}
                      </span>
                      {(() => {
                        const count = Array.isArray(schedule.recipients)
                          ? schedule.recipients.length
                          : asArray(schedule.recipients).length;
                        if (count === 0) return null;
                        return (
                          <span>
                            {t("reports.schedules.recipients", { count })}
                          </span>
                        );
                      })()}
                      {schedule.nextRunAt && (
                        <span>
                          {t("reports.schedules.nextRun", {
                            value: formatTimestamp(schedule.nextRunAt),
                          })}
                        </span>
                      )}
                      {schedule.lastRunAt && (
                        <span>
                          {t("reports.schedules.lastRun", {
                            value: formatTimestamp(schedule.lastRunAt),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="reports-schedule-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => handleScheduleToggle(schedule)}
                    >
                      {coerceBoolean(schedule.enabled, true)
                        ? t("reports.schedules.disable")
                        : t("reports.schedules.enable")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => handleEditSchedule(schedule)}
                    >
                      {t("reports.schedules.edit")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => handleScheduleDelete(schedule.id)}
                    >
                      {t("reports.schedules.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isScheduleFormOpen && (
            <form className="reports-schedule-form" onSubmit={handleScheduleSubmit}>
              <div className="reports-form-grid">
                <label>
                  <span>{t("reports.schedules.fields.name")}</span>
                  <input
                    type="text"
                    value={scheduleForm.name}
                    onChange={(event) => handleScheduleFieldChange("name", event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>{t("reports.schedules.fields.frequency")}</span>
                  <select
                    value={scheduleForm.frequency}
                    onChange={(event) => handleScheduleFieldChange("frequency", event.target.value)}
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`reports.schedules.frequency.${option}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("reports.schedules.fields.time")}</span>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(event) => handleScheduleFieldChange("time", event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("reports.schedules.fields.timezone")}</span>
                  <input
                    type="text"
                    value={scheduleForm.timezone}
                    onChange={(event) => handleScheduleFieldChange("timezone", event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("reports.schedules.fields.delivery")}</span>
                  <select
                    value={scheduleForm.delivery}
                    onChange={(event) => handleScheduleFieldChange("delivery", event.target.value)}
                  >
                    {DELIVERY_CHANNELS.map((option) => (
                      <option key={option} value={option}>
                        {t(`reports.schedules.delivery.${option}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("reports.schedules.fields.format")}</span>
                  <select
                    value={scheduleForm.format}
                    onChange={(event) => handleScheduleFieldChange("format", event.target.value)}
                  >
                    {EXPORT_FORMATS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  <span>{t("reports.schedules.fields.recipients")}</span>
                  <input
                    type="text"
                    value={scheduleForm.recipients}
                    placeholder={t("reports.schedules.placeholders.recipients")}
                    onChange={(event) => handleScheduleFieldChange("recipients", event.target.value)}
                  />
                </label>
                <label className="full">
                  <span>{t("reports.schedules.fields.template")}</span>
                  <select
                    value={scheduleForm.templateId}
                    onChange={(event) => handleScheduleFieldChange("templateId", event.target.value)}
                  >
                    <option value="">{t("reports.schedules.placeholders.template")}</option>
                    {templateOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  <span>{t("reports.schedules.fields.description")}</span>
                  <textarea
                    rows={2}
                    value={scheduleForm.description}
                    onChange={(event) => handleScheduleFieldChange("description", event.target.value)}
                  />
                </label>
                <label className="full">
                  <span>{t("reports.schedules.fields.parameters")}</span>
                  <textarea
                    rows={2}
                    value={scheduleForm.parameters}
                    placeholder={t("reports.schedules.placeholders.parameters")}
                    onChange={(event) => handleScheduleFieldChange("parameters", event.target.value)}
                  />
                </label>
                <label className="reports-inline-checkbox">
                  <input
                    type="checkbox"
                    checked={scheduleForm.enabled}
                    onChange={(event) => handleScheduleFieldChange("enabled", event.target.checked)}
                  />
                  <span>{t("reports.schedules.fields.enabled")}</span>
                </label>
              </div>
              <div className="reports-form-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setIsScheduleFormOpen(false);
                    resetScheduleForm();
                  }}
                >
                  {t("reports.schedules.cancel")}
                </button>
                <button type="submit" className="btn primary">
                  {editingScheduleId
                    ? t("reports.schedules.update")
                    : t("reports.schedules.create")}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
