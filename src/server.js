const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const companiesRouter = require("./routes/companies");
const authRouter = require("./routes/auth");
const unitsRouter = require("./routes/units");
const categoriesRouter = require("./routes/categories");
const brandsRouter = require("./routes/brands");
const productsRouter = require("./routes/products");
const customerGroupsRouter = require("./routes/customerGroups");
const customersRouter = require("./routes/customers");
const salesRouter = require("./routes/sales");
const warehousesRouter = require("./routes/warehouses");
const inventoryRouter = require("./routes/inventory");
const suppliersRouter = require("./routes/suppliers");
const purchaseOrdersRouter = require("./routes/purchaseOrders");
const directPurchasesRouter = require("./routes/directPurchases");
const goodsReceiptsRouter = require("./routes/goodsReceipts");
const supplierInvoicesRouter = require("./routes/supplierInvoices");
const supplierPaymentsRouter = require("./routes/supplierPayments");
const arRouter = require("./routes/ar");
const creditNotesRouter = require("./routes/creditNotes");
const debitNotesRouter = require("./routes/debitNotes");
const guiaDespachoRouter = require("./routes/guiaDespacho");
const salesTicketsRouter = require("./routes/salesTickets");
const paymentMethodsRouter = require("./routes/paymentMethods");
const bankAccountsRouter = require("./routes/bankAccounts");
const documentSequencesRouter = require("./routes/documentSequences");
const onboardingRouter = require("./routes/onboarding");
const employeesRouter = require("./routes/employees");
const configRouter = require("./routes/config");
const uploadsRouter = require("./routes/uploads");
const promotionsRouter = require("./routes/promotions");
const customFieldsRouter = require("./routes/customFields");
const priceListsRouter = require("./routes/priceLists");
const productPacksRouter = require("./routes/productPacks");
const productLotsRouter = require("./routes/productLots");
const productSerialsRouter = require("./routes/productSerials");
const rolesRouter = require("./routes/roles");
const taxRatesRouter = require("./routes/taxRates");
const customerScreenRouter = require("./routes/customerScreen");
const ocrRouter = require("./routes/ocr");
const { initCustomerScreenHub } = require("./services/customerScreenHub");
const http = require("http");

const authMiddleware = require("./middleware/auth");
const {
  requireWritePermission,
  requireMethodPermission,
} = require("./middleware/permissions");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from client public directory (qz-tray.js, etc.)
app.use(express.static(path.join(__dirname, "..", "client", "public")));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/", (req, res) => {
  res.json({ message: "ERP AKKJ API is running" });
});

// Public
app.use("/api/auth", authRouter);
app.use("/api/onboarding", onboardingRouter);

const salesGuard = requireMethodPermission({
  GET: "sales.view",
  POST: "sales.create",
  PUT: "sales.create",
  DELETE: "sales.create",
});

const inventoryGuard = requireMethodPermission({
  GET: "inventory.view",
  POST: "inventory.adjust",
  PUT: "inventory.adjust",
  DELETE: "inventory.adjust",
});

const lotGuard = requireMethodPermission({
  GET: null,
  POST: "inventory.adjust",
  PUT: "inventory.adjust",
  DELETE: "inventory.adjust",
  "*": "inventory.adjust",
});

// Protected
app.use(
  "/api/companies",
  authMiddleware,
  requireWritePermission("config.manage"),
  companiesRouter
);
app.use(
  "/api/units",
  authMiddleware,
  requireWritePermission("products.manage"),
  unitsRouter
);
app.use(
  "/api/categories",
  authMiddleware,
  requireWritePermission("products.manage"),
  categoriesRouter
);
app.use(
  "/api/brands",
  authMiddleware,
  requireWritePermission("products.manage"),
  brandsRouter
);
app.use(
  "/api/products",
  authMiddleware,
  requireWritePermission("products.manage"),
  productsRouter
);
app.use(
  "/api/product-packs",
  authMiddleware,
  requireWritePermission("products.manage"),
  productPacksRouter
);
app.use("/api/product-lots", authMiddleware, lotGuard, productLotsRouter);
app.use(
  "/api/product-serials",
  authMiddleware,
  inventoryGuard,
  productSerialsRouter
);
app.use(
  "/api/customer-groups",
  authMiddleware,
  requireWritePermission("customers.manage"),
  customerGroupsRouter
);
app.use(
  "/api/customers",
  authMiddleware,
  requireWritePermission("customers.manage"),
  customersRouter
);
app.use("/api/sales", authMiddleware, salesGuard, salesTicketsRouter);
app.use("/api/sales", authMiddleware, salesGuard, salesRouter);
app.use(
  "/api/warehouses",
  authMiddleware,
  requireWritePermission("warehouses.manage"),
  warehousesRouter
);
app.use("/api/inventory", authMiddleware, inventoryGuard, inventoryRouter);
app.use(
  "/api/suppliers",
  authMiddleware,
  requireWritePermission("suppliers.manage"),
  suppliersRouter
);
app.use(
  "/api/purchase-orders",
  authMiddleware,
  requireWritePermission("purchaseOrders.manage"),
  purchaseOrdersRouter
);
app.use(
  "/api/direct-purchases",
  authMiddleware,
  requireWritePermission("purchaseOrders.manage"),
  directPurchasesRouter
);
app.use(
  "/api/goods-receipts",
  authMiddleware,
  requireWritePermission("purchaseOrders.manage"),
  goodsReceiptsRouter
);
app.use(
  "/api/supplier-invoices",
  authMiddleware,
  requireWritePermission("payments.manage"),
  supplierInvoicesRouter
);
app.use(
  "/api/supplier-payments",
  authMiddleware,
  requireWritePermission("payments.manage"),
  supplierPaymentsRouter
);
app.use(
  "/api/ar",
  authMiddleware,
  requireWritePermission("payments.manage"),
  arRouter
);
app.use("/api/sales", authMiddleware, salesGuard, creditNotesRouter);
app.use("/api/sales", authMiddleware, salesGuard, debitNotesRouter);
app.use("/api/sales", authMiddleware, salesGuard, guiaDespachoRouter);
app.use(
  "/api/payment-methods",
  authMiddleware,
  requireWritePermission("payments.manage"),
  paymentMethodsRouter
);
app.use(
  "/api/bank-accounts",
  authMiddleware,
  requireWritePermission("payments.manage"),
  bankAccountsRouter
);
app.use(
  "/api/document-sequences",
  authMiddleware,
  requireWritePermission("config.manage"),
  documentSequencesRouter
);
app.use(
  "/api/employees",
  authMiddleware,
  requireWritePermission("employees.manage"),
  employeesRouter
);
app.use("/api/config", authMiddleware, configRouter);
app.use(
  "/api/custom-fields",
  authMiddleware,
  requireWritePermission("config.manage"),
  customFieldsRouter
);
app.use(
  "/api/price-lists",
  authMiddleware,
  requireWritePermission("priceLists.manage"),
  priceListsRouter
);
app.use("/api/uploads", authMiddleware, uploadsRouter);
app.use("/api/ocr", authMiddleware, ocrRouter);
app.use("/api/promotions", authMiddleware, promotionsRouter);
app.use("/api/roles", authMiddleware, rolesRouter);
app.use(
  "/api/tax-rates",
  authMiddleware,
  requireMethodPermission({
    GET: null, // allow any authenticated user to read; write guarded below
    POST: "config.manage",
    PUT: "config.manage",
    DELETE: "config.manage",
    "*": "config.manage",
  }),
  taxRatesRouter
);
app.use(
  "/api/customer-screen",
  authMiddleware,
  requireMethodPermission({ POST: "sales.create", "*": "sales.create" }),
  customerScreenRouter
);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  const server = http.createServer(app);
  initCustomerScreenHub(server);
  server.listen(PORT, () => {
    console.log(`?Ys? ERP AKKJ API listening on port ${PORT}`);
  });
}

module.exports = app;
