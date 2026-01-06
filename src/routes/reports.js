const express = require("express");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { pool } = require("../db");
const {
  getTemplates,
  getRecentRuns,
  getSchedules,
  createSchedule,
  updateSchedule,
  patchSchedule,
  deleteSchedule,
} = require("../services/reportStore");

const DEFAULT_OPERATORS = {
  number: ["gt", "gte", "lt", "lte", "between"],
  date: ["between", "gte", "lte"],
  enum: ["equals", "notEquals", "in"],
  string: ["equals", "notEquals", "contains", "startsWith", "in"],
};

const FIELD_GROUP_LABELS = {
  sale: "Sale",
  customer: "Customer",
  employee: "Employee",
  items: "Items",
  payment: "Payment",
  currency: "Currency",
  inventory: "Inventory",
  product: "Product",
  warehouse: "Warehouse",
  brand: "Brand",
  category: "Category",
  lot: "Lot",
  company: "Company",
};

const router = express.Router();

const BASE_DATASETS = [
  {
    id: "sales_orders",
    table: "fact_sales_orders",
    labelKey: "reports.sources.salesOrders.label",
    descriptionKey: "reports.sources.salesOrders.description",
    label: "Sales orders",
    description: "Sales orders with customer, employee, and totals.",
    defaultSelect: [
      { field: "order_date", alias: "order_date", agg: "" },
      { field: "gross_total", alias: "gross_total", agg: "SUM" },
    ],
    defaultGroupBy: ["order_date"],
    defaultSort: [{ field: "order_date", direction: "asc" }],
    fieldOverrides: {
      company_id: {
        type: "number",
        groupable: true,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.companyId",
        label: "Company ID",
        group: "company",
        groupLabel: FIELD_GROUP_LABELS.company,
      },
      sale_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.saleId",
        label: "Sale ID",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      order_date: {
        type: "date",
        groupable: true,
        operators: DEFAULT_OPERATORS.date,
        labelKey: "reports.fields.orderDate",
        label: "Order date",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      order_timestamp: {
        type: "date",
        groupable: true,
        operators: DEFAULT_OPERATORS.date,
        labelKey: "reports.fields.orderTimestamp",
        label: "Order timestamp",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      document_type: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.documentType",
        label: "Document type",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      document_number: {
        type: "string",
        groupable: true,
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.documentNumber",
        label: "Document number",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      channel: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.channel",
        label: "Channel",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      status: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.saleStatus",
        label: "Sale status",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      payment_status: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.paymentStatus",
        label: "Payment status",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      gross_total: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.grossTotal",
        label: "Gross total",
        group: "items",
        groupLabel: FIELD_GROUP_LABELS.items,
      },
      net_total: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.netTotal",
        label: "Net total",
        group: "items",
        groupLabel: FIELD_GROUP_LABELS.items,
      },
      tax_total: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.taxTotal",
        label: "Tax total",
        group: "items",
        groupLabel: FIELD_GROUP_LABELS.items,
      },
      discount_total: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.discountTotal",
        label: "Discount total",
        group: "items",
        groupLabel: FIELD_GROUP_LABELS.items,
      },
      final_total: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.finalTotal",
        label: "Final total",
        group: "items",
        groupLabel: FIELD_GROUP_LABELS.items,
      },
      line_count: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.lineCount",
        label: "Line count",
        group: "items",
        groupLabel: FIELD_GROUP_LABELS.items,
      },
      distinct_products: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.distinctProducts",
        label: "Distinct products",
        group: "items",
        groupLabel: FIELD_GROUP_LABELS.items,
      },
      total_quantity: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.totalQuantity",
        label: "Total quantity",
        group: "items",
        groupLabel: FIELD_GROUP_LABELS.items,
      },
      product_ids: {
        type: "string",
        groupable: false,
        operators: DEFAULT_OPERATORS.string,
        label: "Product IDs",
        group: "product",
        groupLabel: FIELD_GROUP_LABELS.product,
      },
      product_skus: {
        type: "string",
        groupable: false,
        operators: DEFAULT_OPERATORS.string,
        label: "Product SKUs",
        group: "product",
        groupLabel: FIELD_GROUP_LABELS.product,
      },
      product_names: {
        type: "string",
        groupable: false,
        operators: DEFAULT_OPERATORS.string,
        label: "Product names",
        group: "product",
        groupLabel: FIELD_GROUP_LABELS.product,
      },
      product_brand_ids: {
        type: "string",
        groupable: false,
        operators: DEFAULT_OPERATORS.string,
        label: "Product brand IDs",
        group: "brand",
        groupLabel: FIELD_GROUP_LABELS.brand,
      },
      product_brand_names: {
        type: "string",
        groupable: false,
        operators: DEFAULT_OPERATORS.string,
        label: "Product brand names",
        group: "brand",
        groupLabel: FIELD_GROUP_LABELS.brand,
      },
      product_category_ids: {
        type: "string",
        groupable: false,
        operators: DEFAULT_OPERATORS.string,
        label: "Product category IDs",
        group: "category",
        groupLabel: FIELD_GROUP_LABELS.category,
      },
      product_category_names: {
        type: "string",
        groupable: false,
        operators: DEFAULT_OPERATORS.string,
        label: "Product category names",
        group: "category",
        groupLabel: FIELD_GROUP_LABELS.category,
      },
      created_at: {
        type: "date",
        groupable: true,
        operators: DEFAULT_OPERATORS.date,
        labelKey: "reports.fields.createdAt",
        label: "Created at",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      updated_at: {
        type: "date",
        groupable: true,
        operators: DEFAULT_OPERATORS.date,
        labelKey: "reports.fields.updatedAt",
        label: "Updated at",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      currency_id: {
        type: "string",
        groupable: true,
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.currencyId",
        label: "Currency ID",
        group: "currency",
        groupLabel: FIELD_GROUP_LABELS.currency,
      },
      currency_code: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.currencyCode",
        label: "Currency code",
        group: "currency",
        groupLabel: FIELD_GROUP_LABELS.currency,
      },
      currency_symbol: {
        type: "string",
        groupable: false,
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.currencySymbol",
        label: "Currency symbol",
        group: "currency",
        groupLabel: FIELD_GROUP_LABELS.currency,
      },
      customer_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerId",
        label: "Customer ID",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerName",
        label: "Customer name",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_tax_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerTaxId",
        label: "Customer tax ID",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_email: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerEmail",
        label: "Customer email",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_phone: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerPhone",
        label: "Customer phone",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_billing_address: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerBillingAddress",
        label: "Billing address",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_billing_city: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerBillingCity",
        label: "Billing city",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_shipping_address: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerShippingAddress",
        label: "Shipping address",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_shipping_city: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerShippingCity",
        label: "Shipping city",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_group_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerGroupId",
        label: "Customer group ID",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_group_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerGroupName",
        label: "Customer group",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      employee_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeId",
        label: "Employee ID",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_first_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeFirstName",
        label: "Employee first name",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_last_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeLastName",
        label: "Employee last name",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_full_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeFullName",
        label: "Employee full name",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_email: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeEmail",
        label: "Employee email",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_phone: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeePhone",
        label: "Employee phone",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
    },
  },
  {
    id: "payments",
    table: "fact_payments",
    labelKey: "reports.sources.payments.label",
    descriptionKey: "reports.sources.payments.description",
    label: "Sales payments",
    description: "Payments recorded against sales orders.",
    defaultSelect: [
      { field: "payment_date", alias: "payment_date", agg: "" },
      { field: "amount", alias: "amount", agg: "SUM" },
    ],
    defaultGroupBy: ["payment_date"],
    defaultSort: [{ field: "payment_date", direction: "asc" }],
    fieldOverrides: {
      company_id: {
        type: "number",
        groupable: true,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.companyId",
        label: "Company ID",
        group: "company",
        groupLabel: FIELD_GROUP_LABELS.company,
      },
      payment_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.paymentId",
        label: "Payment ID",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      sale_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.saleId",
        label: "Sale ID",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      payment_date: {
        type: "date",
        groupable: true,
        operators: DEFAULT_OPERATORS.date,
        labelKey: "reports.fields.paymentDate",
        label: "Payment date",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      payment_timestamp: {
        type: "date",
        groupable: true,
        operators: DEFAULT_OPERATORS.date,
        labelKey: "reports.fields.paymentTimestamp",
        label: "Payment timestamp",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      amount: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.paymentAmount",
        label: "Amount",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      method: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.paymentMethod",
        label: "Payment method",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      status: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.paymentStatus",
        label: "Payment status",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      sale_payment_status: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.salePaymentStatus",
        label: "Sale payment status",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      sale_status: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.saleStatus",
        label: "Sale status",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      reference_number: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.paymentReference",
        label: "Reference number",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      bank_transaction_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.bankTransaction",
        label: "Bank transaction ID",
        group: "payment",
        groupLabel: FIELD_GROUP_LABELS.payment,
      },
      document_type: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.documentType",
        label: "Document type",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      document_number: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.documentNumber",
        label: "Document number",
        group: "sale",
        groupLabel: FIELD_GROUP_LABELS.sale,
      },
      customer_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerId",
        label: "Customer ID",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerName",
        label: "Customer name",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_tax_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerTaxId",
        label: "Customer tax ID",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_email: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerEmail",
        label: "Customer email",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_phone: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerPhone",
        label: "Customer phone",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_billing_address: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerBillingAddress",
        label: "Billing address",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_billing_city: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerBillingCity",
        label: "Billing city",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_shipping_address: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerShippingAddress",
        label: "Shipping address",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_shipping_city: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerShippingCity",
        label: "Shipping city",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_group_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerGroupId",
        label: "Customer group ID",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      customer_group_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.customerGroupName",
        label: "Customer group",
        group: "customer",
        groupLabel: FIELD_GROUP_LABELS.customer,
      },
      employee_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeId",
        label: "Employee ID",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_first_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeFirstName",
        label: "Employee first name",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_last_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeLastName",
        label: "Employee last name",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_full_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeFullName",
        label: "Employee full name",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_email: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeeEmail",
        label: "Employee email",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      employee_phone: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.employeePhone",
        label: "Employee phone",
        group: "employee",
        groupLabel: FIELD_GROUP_LABELS.employee,
      },
      currency_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.currencyId",
        label: "Currency ID",
        group: "currency",
        groupLabel: FIELD_GROUP_LABELS.currency,
      },
      currency_code: {
        type: "enum",
        groupable: true,
        operators: DEFAULT_OPERATORS.enum,
        labelKey: "reports.fields.currencyCode",
        label: "Currency code",
        group: "currency",
        groupLabel: FIELD_GROUP_LABELS.currency,
      },
      currency_symbol: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.currencySymbol",
        label: "Currency symbol",
        group: "currency",
        groupLabel: FIELD_GROUP_LABELS.currency,
      },
    },
  },
  {
    id: "inventory_balances",
    table: "fact_inventory_balances",
    labelKey: "reports.sources.inventoryBalances.label",
    descriptionKey: "reports.sources.inventoryBalances.description",
    label: "Inventory balances",
    description: "Daily inventory balances by warehouse and product.",
    defaultSelect: [
      { field: "snapshot_date", alias: "snapshot_date", agg: "" },
      { field: "warehouse_name", alias: "warehouse_name", agg: "" },
      { field: "stock_on_hand", alias: "stock_on_hand", agg: "" },
    ],
    defaultGroupBy: ["snapshot_date", "warehouse_name"],
    defaultSort: [
      { field: "snapshot_date", direction: "desc" },
      { field: "warehouse_name", direction: "asc" },
    ],
    fieldOverrides: {
      company_id: {
        type: "number",
        groupable: true,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.companyId",
        label: "Company ID",
        group: "company",
        groupLabel: FIELD_GROUP_LABELS.company,
      },
      product_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.productId",
        label: "Product ID",
        group: "product",
        groupLabel: FIELD_GROUP_LABELS.product,
      },
      product_sku: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.productSku",
        label: "Product SKU",
        group: "product",
        groupLabel: FIELD_GROUP_LABELS.product,
      },
      product_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.productName",
        label: "Product name",
        group: "product",
        groupLabel: FIELD_GROUP_LABELS.product,
      },
      brand_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.brandId",
        label: "Brand ID",
        group: "brand",
        groupLabel: FIELD_GROUP_LABELS.brand,
      },
      brand_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.brandName",
        label: "Brand name",
        group: "brand",
        groupLabel: FIELD_GROUP_LABELS.brand,
      },
      category_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.categoryId",
        label: "Category ID",
        group: "category",
        groupLabel: FIELD_GROUP_LABELS.category,
      },
      category_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.categoryName",
        label: "Category name",
        group: "category",
        groupLabel: FIELD_GROUP_LABELS.category,
      },
      warehouse_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.warehouseId",
        label: "Warehouse ID",
        group: "warehouse",
        groupLabel: FIELD_GROUP_LABELS.warehouse,
      },
      warehouse_name: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.warehouseName",
        label: "Warehouse name",
        group: "warehouse",
        groupLabel: FIELD_GROUP_LABELS.warehouse,
      },
      warehouse_address: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.warehouseAddress",
        label: "Warehouse address",
        group: "warehouse",
        groupLabel: FIELD_GROUP_LABELS.warehouse,
      },
      warehouse_city: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.warehouseCity",
        label: "Warehouse city",
        group: "warehouse",
        groupLabel: FIELD_GROUP_LABELS.warehouse,
      },
      snapshot_date: {
        type: "date",
        groupable: true,
        operators: DEFAULT_OPERATORS.date,
        labelKey: "reports.fields.snapshotDate",
        label: "Snapshot date",
        group: "inventory",
        groupLabel: FIELD_GROUP_LABELS.inventory,
      },
      product_lot_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.productLotId",
        label: "Product lot ID",
        group: "lot",
        groupLabel: FIELD_GROUP_LABELS.lot,
      },
      product_serial_id: {
        type: "string",
        operators: DEFAULT_OPERATORS.string,
        labelKey: "reports.fields.productSerialId",
        label: "Product serial ID",
        group: "lot",
        groupLabel: FIELD_GROUP_LABELS.lot,
      },
      lot_expiry: {
        type: "date",
        groupable: true,
        operators: DEFAULT_OPERATORS.date,
        labelKey: "reports.fields.lotExpiry",
        label: "Lot expiry",
        group: "lot",
        groupLabel: FIELD_GROUP_LABELS.lot,
      },
      stock_on_hand: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.stockOnHand",
        label: "Stock on hand",
        group: "inventory",
        groupLabel: FIELD_GROUP_LABELS.inventory,
      },
      stock_reserved: {
        type: "number",
        groupable: false,
        operators: DEFAULT_OPERATORS.number,
        labelKey: "reports.fields.stockReserved",
        label: "Stock reserved",
        group: "inventory",
        groupLabel: FIELD_GROUP_LABELS.inventory,
      },
    },
  },
];

const SQL_TYPE_MAP = {
  date: { type: "date", groupable: true, operators: DEFAULT_OPERATORS.date },
  datetime: { type: "date", groupable: true, operators: DEFAULT_OPERATORS.date },
  timestamp: { type: "date", groupable: true, operators: DEFAULT_OPERATORS.date },
  time: { type: "string", groupable: true, operators: DEFAULT_OPERATORS.string },
  decimal: { type: "number", groupable: false, operators: DEFAULT_OPERATORS.number },
  numeric: { type: "number", groupable: false, operators: DEFAULT_OPERATORS.number },
  float: { type: "number", groupable: false, operators: DEFAULT_OPERATORS.number },
  double: { type: "number", groupable: false, operators: DEFAULT_OPERATORS.number },
  int: { type: "number", groupable: true, operators: DEFAULT_OPERATORS.number },
  bigint: { type: "number", groupable: true, operators: DEFAULT_OPERATORS.number },
  mediumint: { type: "number", groupable: true, operators: DEFAULT_OPERATORS.number },
  smallint: { type: "number", groupable: true, operators: DEFAULT_OPERATORS.number },
  tinyint: { type: "number", groupable: true, operators: DEFAULT_OPERATORS.number },
  varchar: { type: "string", groupable: true, operators: DEFAULT_OPERATORS.string },
  char: { type: "string", groupable: true, operators: DEFAULT_OPERATORS.string },
  text: { type: "string", groupable: false, operators: DEFAULT_OPERATORS.string },
  longtext: { type: "string", groupable: false, operators: DEFAULT_OPERATORS.string },
  mediumtext: { type: "string", groupable: false, operators: DEFAULT_OPERATORS.string },
  enum: { type: "enum", groupable: true, operators: DEFAULT_OPERATORS.enum },
  set: { type: "enum", groupable: true, operators: DEFAULT_OPERATORS.enum },
  json: { type: "string", groupable: false, operators: DEFAULT_OPERATORS.string },
  default: { type: "string", groupable: true, operators: DEFAULT_OPERATORS.string },
};

const ALLOWED_AGGREGATES = ["SUM", "AVG", "MIN", "MAX", "COUNT"];

function escapeIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function humanizeFieldName(name) {
  return String(name)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveSqlTypeFromOverride(override = {}) {
  switch ((override.type || "").toLowerCase()) {
    case "number":
      return "decimal";
    case "date":
      return "date";
    case "enum":
      return "enum";
    default:
      return "varchar";
  }
}

function normalizeField(column, override = {}) {
  const sqlType = (column.DATA_TYPE || "").toLowerCase();
  const base = SQL_TYPE_MAP[sqlType] || SQL_TYPE_MAP.default;
  const group = override.group || null;
  const field = {
    id: column.COLUMN_NAME,
    expression: override.expression || escapeIdentifier(column.COLUMN_NAME),
    sqlType,
    type: override.type || base.type,
    groupable: override.groupable !== undefined ? override.groupable : base.groupable,
    operators: override.operators || base.operators || [],
    ordinalPosition: column.ORDINAL_POSITION,
    label: override.label || humanizeFieldName(column.COLUMN_NAME),
    labelKey: override.labelKey || null,
    group,
    groupLabel: override.groupLabel || (group ? FIELD_GROUP_LABELS[group] || null : null),
  };

  if (override.hidden) {
    field.hidden = true;
  }

  if (override.description) {
    field.description = override.description;
  }

  if (override.sortable === false) {
    field.sortable = false;
  }

  return field;
}

function buildConfiguredDataset(base, catalog) {
  const tableColumns = (catalog || []).filter((column) => column.TABLE_NAME === base.table);
  const overrides = base.fieldOverrides || {};
  const fields = tableColumns.map((column) =>
    normalizeField(column, overrides[column.COLUMN_NAME] || {})
  );

  const existingFieldIds = new Set(fields.map((field) => field.id));
  let syntheticIndex = tableColumns.length + 1;
  for (const [fieldId, override] of Object.entries(overrides)) {
    if (existingFieldIds.has(fieldId)) {
      continue;
    }

    const syntheticColumn = {
      TABLE_NAME: base.table,
      COLUMN_NAME: fieldId,
      DATA_TYPE: deriveSqlTypeFromOverride(override),
      COLUMN_TYPE: null,
      ORDINAL_POSITION: syntheticIndex++,
    };

    fields.push(normalizeField(syntheticColumn, override));
  }

  fields.sort((a, b) => a.ordinalPosition - b.ordinalPosition);

  const groups = [];
  const seenGroups = new Set();
  for (const field of fields) {
    if (field.group && field.groupLabel && !seenGroups.has(field.group)) {
      seenGroups.add(field.group);
      groups.push({ id: field.group, label: field.groupLabel });
    }
  }

  return {
    id: base.id,
    table: base.table,
    labelKey: base.labelKey,
    descriptionKey: base.descriptionKey,
    label: base.label,
    description: base.description,
    defaultSelect: base.defaultSelect || [],
    defaultGroupBy: base.defaultGroupBy || [],
    defaultSort: base.defaultSort || [],
    fields,
    groups,
  };
}

async function loadSourceCatalog() {
  const tableNames = BASE_DATASETS.map((dataset) => dataset.table);
  const [columns] = await pool.query(
    `
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        COLUMN_TYPE,
        ORDINAL_POSITION
      FROM information_schema.columns
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `,
    [tableNames]
  );

  return columns;
}

async function loadSources() {
  const catalog = await loadSourceCatalog();
  return BASE_DATASETS.map((base) => buildConfiguredDataset(base, catalog));
}

function buildFieldMap(dataset) {
  const map = new Map();
  dataset.fields.forEach((field) => {
    map.set(field.id, field);
  });
  return map;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function sanitizeFilename(value) {
  if (!value) {
    return "report";
  }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "report";
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const normalized = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildCsvContent(columns, rows) {
  const headers = columns.map((column) => column.label || column.id);
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    const values = columns.map((column) => escapeCsvValue(row[column.id]));
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

function buildFilterClause(filter, field) {
  const operator = (filter.operator || "equals").toLowerCase();
  const expression = field.expression || escapeIdentifier(field.id);
  const value = filter.value;
  const params = [];
  let clause = null;

  switch (operator) {
    case "equals":
      if (value === null || value === undefined) {
        clause = `${expression} IS NULL`;
      } else {
        clause = `${expression} = ?`;
        params.push(value);
      }
      break;
    case "notequals":
      if (value === null || value === undefined) {
        clause = `${expression} IS NOT NULL`;
      } else {
        clause = `${expression} <> ?`;
        params.push(value);
      }
      break;
    case "contains":
      clause = `${expression} LIKE ?`;
      params.push(`%${value}%`);
      break;
    case "startswith":
      clause = `${expression} LIKE ?`;
      params.push(`${value}%`);
      break;
    case "in":
      if (!Array.isArray(value) || value.length === 0) {
        throw badRequest(`Filter ${field.id} requires a non-empty array value for IN operator`);
      }
      clause = `${expression} IN (${value.map(() => "?").join(", ")})`;
      params.push(...value);
      break;
    case "between":
      if (!Array.isArray(value) || value.length !== 2) {
        throw badRequest(`Filter ${field.id} requires a two-element array for BETWEEN operator`);
      }
      clause = `${expression} BETWEEN ? AND ?`;
      params.push(value[0], value[1]);
      break;
    case "gte":
      clause = `${expression} >= ?`;
      params.push(value);
      break;
    case "lte":
      clause = `${expression} <= ?`;
      params.push(value);
      break;
    case "gt":
      clause = `${expression} > ?`;
      params.push(value);
      break;
    case "lt":
      clause = `${expression} < ?`;
      params.push(value);
      break;
    default:
      throw badRequest(`Unsupported operator ${operator} for field ${field.id}`);
  }

  return { clause, params };
}

function buildPreviewQuery(config, dataset, options) {
  const selectConfig =
    Array.isArray(config.select) && config.select.length
      ? config.select
      : dataset.defaultSelect;

  if (!selectConfig || selectConfig.length === 0) {
    throw badRequest("Select clause must include at least one field");
  }

  const fieldMap = buildFieldMap(dataset);
  const selectClauses = [];
  const columns = [];
  const aliasSet = new Set();
  const selectEntries = [];

  for (const item of selectConfig) {
    const field = fieldMap.get(item.field);
    if (!field) {
      throw badRequest(`Unknown field "${item.field}" in select clause`);
    }

    const alias = item.alias || item.field;
    const aggregate = (item.agg || "").toUpperCase();
    const expression = field.expression || escapeIdentifier(field.id);

    if (aliasSet.has(alias)) {
      throw badRequest(`Duplicate alias "${alias}" in select clause`);
    }
    aliasSet.add(alias);

    if (aggregate) {
      if (!ALLOWED_AGGREGATES.includes(aggregate)) {
        throw badRequest(`Aggregate ${aggregate} is not allowed`);
      }
      selectClauses.push(`${aggregate}(${expression}) AS ${escapeIdentifier(alias)}`);
    } else {
      selectClauses.push(`${expression} AS ${escapeIdentifier(alias)}`);
    }

    selectEntries.push({
      alias,
      fieldId: field.id,
      expression,
      aggregate: Boolean(aggregate),
    });

    columns.push({
      id: alias,
      fieldId: field.id,
      label: field.label,
      type: field.type,
    });
  }

  const filterClauses = [];
  const filterParams = [];

  if (Array.isArray(config.filters)) {
    for (const filter of config.filters) {
      if (!filter || !filter.field) {
        continue;
      }
      const field = fieldMap.get(filter.field);
      if (!field) {
        throw badRequest(`Unknown field "${filter.field}" in filters`);
      }
      const { clause, params } = buildFilterClause(filter, field);
      filterClauses.push(clause);
      filterParams.push(...params);
    }
  }

  const groupByConfig =
    Array.isArray(config.groupBy) && config.groupBy.length
      ? config.groupBy
      : dataset.defaultGroupBy;

  const groupByExpressions = groupByConfig.map((fieldId) => {
    const field = fieldMap.get(fieldId);
    if (!field) {
      throw badRequest(`Unknown field "${fieldId}" in groupBy clause`);
    }
    return field.expression || escapeIdentifier(field.id);
  });

  const hasAggregates = selectEntries.some((entry) => entry.aggregate);
  if (groupByExpressions.length > 0 || hasAggregates) {
    for (const entry of selectEntries) {
      if (entry.aggregate) {
        continue;
      }
      if (!groupByExpressions.includes(entry.expression)) {
        groupByExpressions.push(entry.expression);
      }
    }
  }

  const sortConfig =
    Array.isArray(config.sort) && config.sort.length
      ? config.sort
      : dataset.defaultSort;

  const orderClauses = sortConfig.map((sortItem) => {
    const direction =
      (sortItem.direction || "asc").toUpperCase() === "DESC" ? "DESC" : "ASC";
    if (aliasSet.has(sortItem.field)) {
      return `${escapeIdentifier(sortItem.field)} ${direction}`;
    }
    const field = fieldMap.get(sortItem.field);
    if (!field) {
      throw badRequest(`Unknown field "${sortItem.field}" in sort clause`);
    }
    const expression = field.expression || escapeIdentifier(field.id);
    return `${expression} ${direction}`;
  });

  const whereClause = filterClauses.length ? `WHERE ${filterClauses.join(" AND ")}` : "";
  const groupByClause = groupByExpressions.length ? `GROUP BY ${groupByExpressions.join(", ")}` : "";
  const orderClause = orderClauses.length ? `ORDER BY ${orderClauses.join(", ")}` : "";

  const limitClause =
    options.offset && options.offset > 0
      ? `LIMIT ? OFFSET ${options.offset}`
      : "LIMIT ?";

  const sql = [
    "SELECT",
    `  ${selectClauses.join(",\n  ")}`,
    `FROM ${escapeIdentifier(dataset.table)}`,
    whereClause,
    groupByClause,
    orderClause,
    limitClause,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sql,
    params: [...filterParams, options.fetchSize],
    columns,
  };
}

function coercePositiveInt(value, fallback, max = 500) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, max);
  }
  return Math.min(Math.max(fallback, 1), max);
}

function getCompanyId(req) {
  return req.user && req.user.CompanyID ? Number(req.user.CompanyID) : null;
}

function normalizeSchedulePayload(body = {}) {
  const recipients = Array.isArray(body.recipients)
    ? body.recipients
    : body.recipients != null
    ? [body.recipients]
    : [];

  return {
    ...body,
    delivery: body.delivery || "email",
    format: body.format || "csv",
    recipients: recipients.filter((value) => value !== undefined && value !== null && value !== ""),
  };
}

router.get("/sources", async (req, res, next) => {
  try {
    const sources = await loadSources();
    res.json({ sources, count: sources.length });
  } catch (error) {
    next(error);
  }
});

router.get("/templates", async (req, res, next) => {
  try {
    const templates = await getTemplates();
    res.json({ templates, count: templates.length });
  } catch (error) {
    next(error);
  }
});

router.get("/recent", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const runs = await getRecentRuns(companyId);
    res.json({ runs, count: runs.length });
  } catch (error) {
    next(error);
  }
});

router.get("/schedules", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const schedules = await getSchedules(companyId);
    res.json({ schedules, count: schedules.length });
  } catch (error) {
    next(error);
  }
});

router.post("/schedules", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const schedulePayload = normalizeSchedulePayload(req.body || {});
    const created = await createSchedule(companyId, schedulePayload);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put("/schedules/:id", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const schedulePayload = normalizeSchedulePayload(req.body || {});
    const updated = await updateSchedule(companyId, req.params.id, schedulePayload);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/schedules/:id", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const patched = await patchSchedule(companyId, req.params.id, req.body);
    res.json(patched);
  } catch (error) {
    next(error);
  }
});

router.delete("/schedules/:id", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    await deleteSchedule(companyId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/export", async (req, res, next) => {
  try {
    const { source } = req.body || {};
    if (!source) {
      throw badRequest("Source is required for export");
    }

    const sources = await loadSources();
    const dataset = sources.find((item) => item.id === source);
    if (!dataset) {
      throw badRequest(`Unknown source "${source}"`);
    }

    const format = String(req.body.exportFormat || "csv").toLowerCase();
    const allowedFormats = new Set(["csv", "xlsx", "json", "pdf"]);
    if (!allowedFormats.has(format)) {
      throw badRequest(`Unsupported export format "${format}"`);
    }

    const sizeInput = req.body.pageSize || req.body.limit || 1000;
    const fetchSize = coercePositiveInt(sizeInput, 1000, 50000);
    const page = Math.max(Number.parseInt(req.body.page, 10) || 0, 0);
    const offsetOverride = Number.parseInt(req.body.offset, 10);
    const offset = Number.isFinite(offsetOverride) && offsetOverride >= 0 ? offsetOverride : page * fetchSize;

    const query = buildPreviewQuery(
      {
        select: req.body.select,
        filters: req.body.filters,
        groupBy: req.body.groupBy,
        sort: req.body.sort,
      },
      dataset,
      { fetchSize, offset }
    );

    const [rows] = await pool.query(query.sql, query.params);

    const baseLabel = dataset.label || dataset.id || "report";
    const filenameBase = `${sanitizeFilename(baseLabel)}-${new Date().toISOString().replace(/[:.]/g, "-")}`;

    switch (format) {
      case "xlsx": {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(baseLabel);
        worksheet.columns = query.columns.map((column) => ({
          header: column.label || column.id,
          key: column.id,
          width: Math.min(Math.max((column.label || column.id).length + 4, 12), 40),
        }));
        rows.forEach((row) => {
          const shaped = {};
          query.columns.forEach((column) => {
            shaped[column.id] = row[column.id] ?? "";
          });
          worksheet.addRow(shaped);
        });
        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filenameBase}.xlsx"`
        );
        res.send(Buffer.from(buffer));
        return;
      }
      case "pdf": {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filenameBase}.pdf"`
        );
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        doc.pipe(res);
        doc.fontSize(16).text(baseLabel, { underline: false });
        doc.moveDown();
        if (!rows.length) {
          doc.fontSize(12).text("No rows returned for this selection.");
        } else {
          const headerLabels = query.columns.map((column) => column.label || column.id);
          doc.font("Helvetica-Bold").fontSize(10).text(headerLabels.join(" | "));
          doc.moveDown(0.5);
          doc.font("Helvetica");
          rows.forEach((row) => {
            const line = query.columns
              .map((column) => {
                const value = row[column.id];
                return value === null || value === undefined ? "" : String(value);
              })
              .join(" | ");
            doc.text(line);
          });
        }
        doc.end();
        return;
      }
      case "json": {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filenameBase}.json"`
        );
        res.json(rows);
        return;
      }
      default: {
        const csv = buildCsvContent(query.columns, rows);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filenameBase}.csv"`
        );
        res.send(csv);
      }
    }
  } catch (error) {
    next(error);
  }
});

router.post("/preview", async (req, res, next) => {
  try {
    const { source } = req.body || {};
    if (!source) {
      throw badRequest("Source is required for preview");
    }

    const sources = await loadSources();
    const dataset = sources.find((item) => item.id === source);
    if (!dataset) {
      throw badRequest(`Unknown source "${source}"`);
    }

    const limit = coercePositiveInt(req.body.limit, 50);
    const page = Math.max(Number.parseInt(req.body.page, 10) || 0, 0);
    const fetchSize = limit + 1;
    const offset = page * limit;

    const query = buildPreviewQuery(
      {
        select: req.body.select,
        filters: req.body.filters,
        groupBy: req.body.groupBy,
        sort: req.body.sort,
      },
      dataset,
      { fetchSize, offset }
    );

    const [rows] = await pool.query(query.sql, query.params);
    const hasNext = rows.length > limit;
    const dataRows = hasNext ? rows.slice(0, limit) : rows;

    res.json({
      columns: query.columns,
      rows: dataRows,
      pagination: {
        page,
        pageSize: limit,
        hasNext,
        hasPrev: page > 0,
      },
    });
  } catch (error) {
    if (error.status && error.status >= 400 && error.status < 500) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

module.exports = router;
