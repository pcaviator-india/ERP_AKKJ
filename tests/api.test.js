jest.mock("exceljs", () => {
  class Worksheet {
    constructor() {
      this.columns = [];
    }
    addRow() {
      return null;
    }
  }

  return {
    Workbook: class WorkbookMock {
      constructor() {
        this._worksheet = new Worksheet();
        this.xlsx = {
          writeBuffer: jest.fn(() => Promise.resolve(Buffer.from("fake-xlsx"))),
        };
      }
      addWorksheet() {
        return this._worksheet;
      }
    },
  };
});

jest.mock(
  "pdfkit",
  () => {
    const { Readable } = require("stream");
    return class PDFDocumentMock extends Readable {
      constructor() {
        super();
      }
      pipe(destination) {
        return Readable.prototype.pipe.call(this, destination);
      }
      fontSize() {
        return this;
      }
      font() {
        return this;
      }
      text() {
        return this;
      }
      moveDown() {
        return this;
      }
      end() {
        this.push(Buffer.from("fake-pdf"));
        this.push(null);
      }
    };
  },
  { virtual: true }
);

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/server");
const { pool: mockPool } = require("../src/db");

function authHeader(payload = {}) {
  const token = jwt.sign(
    {
      EmployeeID: payload.EmployeeID || 1,
      CompanyID: payload.CompanyID || 1,
      Email: payload.Email || "user@example.com",
      Role: payload.Role || "CompanyAdmin",
    },
    process.env.JWT_SECRET || "test-secret"
  );

  return `Bearer ${token}`;
}

function binaryParser(res, callback) {
  res.setEncoding("binary");
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    callback(null, Buffer.from(data, "binary"));
  });
}

describe("Public endpoints", () => {
  test("GET / returns API status message", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "ERP AKKJ API is running");
  });

  test("POST /api/auth/login without valid credentials returns 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ Email: "nouser@example.com", Password: "invalid" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });
});

const protectedEndpoints = [
  { method: "get", path: "/api/auth/me" },
  { method: "post", path: "/api/auth/register", payload: { Email: "x", Password: "x" } },
  { method: "get", path: "/api/companies" },
  { method: "post", path: "/api/companies", payload: { CompanyName: "Test Co" } },
  { method: "get", path: "/api/units" },
  { method: "post", path: "/api/units", payload: { UnitName: "Box", Abbreviation: "BX" } },
  { method: "get", path: "/api/categories" },
  { method: "post", path: "/api/categories", payload: { CategoryName: "Cat" } },
  { method: "get", path: "/api/brands" },
  { method: "post", path: "/api/brands", payload: { BrandName: "Brand" } },
  { method: "get", path: "/api/products" },
  { method: "post", path: "/api/products", payload: { SKU: "SKU1", ProductName: "Prod", UnitID: 1 } },
  { method: "get", path: "/api/customer-groups" },
  { method: "post", path: "/api/customer-groups", payload: { GroupName: "VIP" } },
  { method: "get", path: "/api/customers" },
  { method: "post", path: "/api/customers", payload: { CustomerName: "Customer" } },
  { method: "get", path: "/api/sales/tickets" },
  { method: "post", path: "/api/sales/tickets", payload: { CustomerID: 1, Items: [] } },
  { method: "get", path: "/api/sales" },
  { method: "post", path: "/api/sales", payload: { CustomerID: 1, WarehouseID: 1, Items: [{}] } },
  { method: "post", path: "/api/sales/credit-note", payload: {} },
  { method: "post", path: "/api/sales/debit-note", payload: {} },
  { method: "post", path: "/api/sales/guia-despacho", payload: {} },
  { method: "get", path: "/api/warehouses" },
  { method: "get", path: "/api/reports/sources" },
  { method: "get", path: "/api/reports/templates" },
  { method: "get", path: "/api/reports/recent" },
  { method: "get", path: "/api/reports/schedules" },
  {
    method: "post",
    path: "/api/reports/preview",
    payload: { source: "sales_orders" },
  },
  {
    method: "post",
    path: "/api/reports/export",
    payload: { source: "sales_orders", exportFormat: "csv" },
  },
  {
    method: "post",
    path: "/api/reports/schedules",
    payload: { name: "Weekly summary" },
  },
  {
    method: "put",
    path: "/api/reports/schedules/sched-1",
    payload: { name: "Weekly summary" },
  },
  {
    method: "patch",
    path: "/api/reports/schedules/sched-1",
    payload: { enabled: false },
  },
  { method: "delete", path: "/api/reports/schedules/sched-1" },
  { method: "post", path: "/api/warehouses", payload: { WarehouseName: "W1" } },
  { method: "get", path: "/api/inventory/levels" },
  { method: "post", path: "/api/inventory/adjust", payload: { ProductID: 1, WarehouseID: 1, QuantityChange: 1 } },
  { method: "get", path: "/api/suppliers" },
  { method: "post", path: "/api/suppliers", payload: { SupplierName: "Sup" } },
  { method: "get", path: "/api/purchase-orders" },
  { method: "post", path: "/api/purchase-orders", payload: { SupplierID: 1, Items: [] } },
  { method: "get", path: "/api/goods-receipts" },
  { method: "post", path: "/api/goods-receipts", payload: { SupplierID: 1, ReceiptNumber: "R1", WarehouseID: 1, Items: [] } },
  { method: "get", path: "/api/supplier-invoices" },
  { method: "post", path: "/api/supplier-invoices", payload: { SupplierID: 1, DocumentType: "FACTURA", InvoiceNumber_Supplier: "INV1", InvoiceDate: "2025-01-01", TotalAmount: 1, TaxAmount: 0, Items: [{ Description: "Item", Quantity: 1, UnitPrice: 1 }] } },
  { method: "get", path: "/api/supplier-payments" },
  { method: "post", path: "/api/supplier-payments", payload: { SupplierID: 1, AmountPaid: 1, PaymentMethodID: 1, Allocations: [{ SupplierInvoiceID: 1, AmountAllocated: 1 }] } },
  { method: "get", path: "/api/ar/customers/summary" },
  { method: "post", path: "/api/ar/invoices/1/pay", payload: { Amount: 1, PaymentMethodID: 1 } },
  { method: "get", path: "/api/payment-methods" },
  { method: "post", path: "/api/payment-methods", payload: { MethodName: "Cash" } },
  { method: "get", path: "/api/bank-accounts" },
  { method: "post", path: "/api/bank-accounts", payload: { GLAccountID: 1, AccountName: "Bank", AccountNumber: "123", CurrencyID: 1 } },
  { method: "get", path: "/api/document-sequences" },
  { method: "post", path: "/api/document-sequences", payload: { DocumentType: "FACTURA" } },
];

describe("Protected endpoints require authentication", () => {
  test.each(protectedEndpoints)(
    "%s %s returns 401 without token",
    async ({ method, path, payload }) => {
      const agent = request(app);
      let req = agent[method](path);
      if (payload) {
        req = req.send(payload);
      }
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    }
  );
});

describe("Sample authenticated flows", () => {
  test("GET /api/companies returns tenant-scoped data", async () => {
    const tenantCompanies = [
      {
        CompanyID: 7,
        CompanyName: "Tenant Co",
        LegalName: "Tenant Co Ltd",
        TaxID: "123",
        City: "Santiago",
        CountryCode: "CL",
        Email: "info@tenant.cl",
        IsActive: 1,
        CreatedAt: "2025-01-01",
        UpdatedAt: "2025-01-02",
      },
    ];

    mockPool.query.mockResolvedValueOnce([tenantCompanies]);

    const res = await request(app)
      .get("/api/companies")
      .set("Authorization", authHeader({ CompanyID: 7, Role: "CompanyAdmin" }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(tenantCompanies);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE CompanyID = ?"),
      [7]
    );
  });

  test("GET /api/reports/sources returns dataset catalog", async () => {
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [
          {
            TABLE_NAME: "fact_sales_orders",
            COLUMN_NAME: "order_date",
            DATA_TYPE: "date",
            COLUMN_TYPE: "date",
            ORDINAL_POSITION: 1,
          },
          {
            TABLE_NAME: "fact_sales_orders",
            COLUMN_NAME: "gross_total",
            DATA_TYPE: "decimal",
            COLUMN_TYPE: "decimal(10,2)",
            ORDINAL_POSITION: 2,
          },
          {
            TABLE_NAME: "fact_inventory_balances",
            COLUMN_NAME: "snapshot_date",
            DATA_TYPE: "date",
            COLUMN_TYPE: "date",
            ORDINAL_POSITION: 1,
          },
          {
            TABLE_NAME: "fact_payments",
            COLUMN_NAME: "payment_date",
            DATA_TYPE: "date",
            COLUMN_TYPE: "date",
            ORDINAL_POSITION: 1,
          },
        ],
      ]);

    const res = await request(app)
      .get("/api/reports/sources")
      .set("Authorization", authHeader({ Role: "CompanyAdmin" }));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sources)).toBe(true);
    expect(res.body.sources.length).toBeGreaterThan(0);
    expect(res.body.count).toBe(res.body.sources.length);
    expect(res.body.sources[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), table: expect.any(String) })
    );
    expect(Array.isArray(res.body.sources[0].fields)).toBe(true);
  });

  test("GET /api/reports/templates returns catalog", async () => {
    const templates = [
      {
        id: "daily-sales",
        category: "sales",
        title: "Daily sales performance",
        source: "sales_orders",
      },
    ];
    mockReportStore.getTemplates.mockResolvedValueOnce(templates);

    const res = await request(app)
      .get("/api/reports/templates")
      .set("Authorization", authHeader({ Role: "CompanyAdmin" }));

    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual(templates);
    expect(res.body.count).toBe(templates.length);
    expect(mockReportStore.getTemplates).toHaveBeenCalled();
  });

  test("GET /api/reports/recent returns recent runs", async () => {
    const recentRuns = [
      {
        id: "run-1",
        name: "Daily sales performance",
        ranAt: "2025-12-30T10:00:00.000Z",
        rows: 42,
      },
    ];
    mockReportStore.getRecentRuns.mockResolvedValueOnce(recentRuns);

    const res = await request(app)
      .get("/api/reports/recent")
      .set("Authorization", authHeader({ CompanyID: 5, Role: "CompanyAdmin" }));

    expect(res.status).toBe(200);
    expect(res.body.runs).toEqual(recentRuns);
    expect(res.body.count).toBe(recentRuns.length);
    expect(mockReportStore.getRecentRuns).toHaveBeenCalledWith(5);
  });

  test("GET /api/reports/schedules returns schedules", async () => {
    const schedules = [
      {
        id: "sched-1",
        name: "Daily email",
        frequency: "daily",
      },
    ];
    mockReportStore.getSchedules.mockResolvedValueOnce(schedules);

    const res = await request(app)
      .get("/api/reports/schedules")
      .set("Authorization", authHeader({ CompanyID: 9, Role: "CompanyAdmin" }));

    expect(res.status).toBe(200);
    expect(res.body.schedules).toEqual(schedules);
    expect(res.body.count).toBe(1);
    expect(mockReportStore.getSchedules).toHaveBeenCalledWith(9);
  });

  test("POST /api/reports/schedules creates schedule", async () => {
    const createdSchedule = {
      id: "sched-1",
      name: "Daily email",
      description: "Daily sales report",
      frequency: "daily",
      delivery: "email",
      recipients: ["ops@example.com"],
      format: "csv",
      enabled: true,
    };
    mockReportStore.createSchedule.mockResolvedValueOnce(createdSchedule);

    const payload = {
      name: "Daily email",
      description: "Daily sales report",
      frequency: "daily",
      delivery: "email",
      recipients: ["ops@example.com"],
      templateId: "daily-sales",
      source: "sales_orders",
    };

    const res = await request(app)
      .post("/api/reports/schedules")
      .set("Authorization", authHeader({ CompanyID: 11, Role: "CompanyAdmin" }))
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(createdSchedule);
    expect(mockReportStore.createSchedule).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        name: "Daily email",
        delivery: "email",
        format: "csv",
        templateId: "daily-sales",
      })
    );
  });

  test("PUT /api/reports/schedules/:id updates schedule", async () => {
    const updatedSchedule = {
      id: "sched-1",
      name: "Weekly digest",
      frequency: "weekly",
      delivery: "email",
      recipients: ["ops@example.com"],
      format: "csv",
      enabled: true,
    };
    mockReportStore.updateSchedule.mockResolvedValueOnce(updatedSchedule);

    const payload = {
      name: "Weekly digest",
      frequency: "weekly",
      delivery: "email",
      recipients: ["ops@example.com"],
      templateId: "daily-sales",
      source: "sales_orders",
    };

    const res = await request(app)
      .put("/api/reports/schedules/sched-1")
      .set("Authorization", authHeader({ CompanyID: 12, Role: "CompanyAdmin" }))
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updatedSchedule);
    expect(mockReportStore.updateSchedule).toHaveBeenCalledWith(
      12,
      "sched-1",
      expect.objectContaining({ name: "Weekly digest", frequency: "weekly" })
    );
  });

  test("PATCH /api/reports/schedules/:id toggles schedule", async () => {
    const patchedSchedule = {
      id: "sched-1",
      name: "Daily email",
      frequency: "daily",
      delivery: "email",
      recipients: ["ops@example.com"],
      format: "csv",
      enabled: false,
    };
    mockReportStore.patchSchedule.mockResolvedValueOnce(patchedSchedule);

    const res = await request(app)
      .patch("/api/reports/schedules/sched-1")
      .set("Authorization", authHeader({ CompanyID: 13, Role: "CompanyAdmin" }))
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(patchedSchedule);
    expect(mockReportStore.patchSchedule).toHaveBeenCalledWith(13, "sched-1", { enabled: false });
  });

  test("DELETE /api/reports/schedules/:id removes schedule", async () => {
    mockReportStore.deleteSchedule.mockResolvedValueOnce(true);

    const res = await request(app)
      .delete("/api/reports/schedules/sched-1")
      .set("Authorization", authHeader({ CompanyID: 14, Role: "CompanyAdmin" }));

    expect(res.status).toBe(204);
    expect(mockReportStore.deleteSchedule).toHaveBeenCalledWith(14, "sched-1");
  });

  test("POST /api/reports/preview returns preview rows", async () => {
    const metadataRows = [
      {
        TABLE_NAME: "fact_sales_orders",
        COLUMN_NAME: "order_date",
        DATA_TYPE: "date",
        COLUMN_TYPE: "date",
        ORDINAL_POSITION: 1,
      },
      {
        TABLE_NAME: "fact_sales_orders",
        COLUMN_NAME: "gross_total",
        DATA_TYPE: "decimal",
        COLUMN_TYPE: "decimal(10,2)",
        ORDINAL_POSITION: 2,
      },
    ];

    const previewRows = [
      { order_date: "2025-01-01", gross_total: 123.45 },
      { order_date: "2025-01-02", gross_total: 90.12 },
    ];

    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([metadataRows])
      .mockResolvedValueOnce([previewRows]);

    const payload = {
      source: "sales_orders",
      select: [
        { field: "order_date", alias: "order_date" },
        { field: "gross_total", agg: "SUM", alias: "gross_total" },
      ],
      groupBy: ["order_date"],
      sort: [{ field: "order_date", direction: "asc" }],
      limit: 1,
      page: 0,
    };

    const res = await request(app)
      .post("/api/reports/preview")
      .set("Authorization", authHeader({ Role: "CompanyAdmin" }))
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.columns).toEqual([
      expect.objectContaining({ id: "order_date" }),
      expect.objectContaining({ id: "gross_total" }),
    ]);
    expect(res.body.rows).toEqual([
      { order_date: "2025-01-01", gross_total: 123.45 },
    ]);
    expect(res.body.pagination).toMatchObject({
      page: 0,
      pageSize: 1,
      hasNext: true,
      hasPrev: false,
    });

    const previewCall = mockPool.query.mock.calls[2];
    const sql = previewCall[0].replace(/\s+/g, " ");
    expect(sql).toContain("FROM `fact_sales_orders`");
    expect(sql).toContain("GROUP BY `order_date`");
    expect(sql).toContain("ORDER BY `order_date` ASC");
    expect(sql).toContain("LIMIT ?");
    expect(previewCall[1]).toEqual([2]);
  });

  test("POST /api/reports/export returns PDF file", async () => {
    const exportRows = [
      { order_date: "2025-01-01", gross_total: 123.45 },
      { order_date: "2025-01-02", gross_total: 90.12 },
    ];

    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([exportRows]);

    const res = await request(app)
      .post("/api/reports/export")
      .set("Authorization", authHeader({ Role: "CompanyAdmin" }))
      .send({
        source: "sales_orders",
        select: [
          { field: "order_date", alias: "order_date" },
          { field: "gross_total", alias: "gross_total" },
        ],
        groupBy: ["order_date"],
        exportFormat: "pdf",
        limit: 10,
      })
      .buffer()
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(".pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("POST /api/reports/export returns XLSX file", async () => {
    const exportRows = [
      { order_date: "2025-01-01", gross_total: 123.45 },
      { order_date: "2025-01-02", gross_total: 90.12 },
    ];

    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([exportRows]);

    const res = await request(app)
      .post("/api/reports/export")
      .set("Authorization", authHeader({ Role: "CompanyAdmin" }))
      .send({
        source: "sales_orders",
        select: [
          { field: "order_date", alias: "order_date" },
          { field: "gross_total", alias: "gross_total" },
        ],
        groupBy: ["order_date"],
        exportFormat: "xlsx",
        limit: 10,
      })
      .buffer()
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers["content-disposition"]).toContain(".xlsx");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("POST /api/payment-methods creates method when run by SuperAdmin", async () => {
    const methodPayload = { MethodName: "Cash" };
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 101 }])
      .mockResolvedValueOnce([
        [
          {
            PaymentMethodID: 101,
            MethodName: "Cash",
            IsActive: 1,
          },
        ],
      ]);

    const res = await request(app)
      .post("/api/payment-methods")
      .set("Authorization", authHeader({ Role: "SuperAdmin" }))
      .send(methodPayload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      PaymentMethodID: 101,
      MethodName: "Cash",
      IsActive: 1,
    });
    expect(mockPool.query.mock.calls[1][1][0]).toBe("Cash");
  });

  test("POST /api/ar/invoices/:saleId/pay handles payment updates", async () => {
    const saleId = 42;
    const companyId = 5;
    const paymentPayload = {
      Amount: 1000,
      PaymentMethodID: 2,
      ReferenceNumber: "TRX-1",
    };

    const saleRow = {
      FinalAmount: 5000,
      AmountPaid: 2000,
      PaymentStatus: "PartiallyPaid",
      Status: "Completed",
      AlreadyPaid: 2000,
    };

    const mockConn = global.mockConnection;

    mockPool.getConnection.mockResolvedValueOnce(mockConn);
    mockConn.query
      // SELECT ... FOR UPDATE
      .mockResolvedValueOnce([[saleRow]])
      // INSERT SalesPayments
      .mockResolvedValueOnce([{ insertId: 77 }])
      // UPDATE Sales
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post(`/api/ar/invoices/${saleId}/pay`)
      .set("Authorization", authHeader({ CompanyID: companyId }))
      .send(paymentPayload);

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT"),
      [saleId.toString(), saleId.toString(), companyId]
    );
    expect(mockConn.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO SalesPayments"),
      expect.arrayContaining([
        saleId.toString(),
        paymentPayload.PaymentMethodID,
        paymentPayload.Amount,
        expect.anything(),
      ])
    );
    expect(mockConn.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("UPDATE Sales"),
      expect.arrayContaining([
        3000,
        "PartiallyPaid",
        "PartiallyPaid",
        saleId.toString(),
        companyId,
      ])
    );
    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: "Payment recorded successfully",
      amountPaid: 3000,
      remainingBalance: 2000,
    });
  });

  test("POST /api/sales creates sale and updates inventory", async () => {
    const companyId = 3;
    const employeeId = 9;
    const salePayload = {
      CustomerID: 11,
      DocumentType: "FACTURA",
      WarehouseID: 2,
      Items: [
        {
          ProductID: 7,
          Quantity: 2,
          UnitPrice: 100,
          DiscountPercentage: 0,
          TaxRatePercentage: 0,
        },
      ],
    };

    const seqRow = {
      DocumentSequenceID: 50,
      Prefix: "F-",
      NextNumber: 100,
      Suffix: "",
    };

    const mockConn = global.mockConnection;

    mockPool.getConnection.mockResolvedValueOnce(mockConn);
    mockConn.query
      // Document sequence select
      .mockResolvedValueOnce([[seqRow]])
      // Document sequence update
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // Insert sale header
      .mockResolvedValueOnce([{ insertId: 999 }])
      // Insert sales item
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // Select inventory level
      .mockResolvedValueOnce([[]])
      // Insert inventory level
      .mockResolvedValueOnce([{ insertId: 321 }])
      // Update stock
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // Insert inventory transaction
      .mockResolvedValueOnce([{ insertId: 654 }]);

    const res = await request(app)
      .post("/api/sales")
      .set(
        "Authorization",
        authHeader({ CompanyID: companyId, EmployeeID: employeeId })
      )
      .send(salePayload);

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT DocumentSequenceID"),
      [companyId, salePayload.DocumentType]
    );
    expect(mockConn.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE DocumentSequences"),
      [seqRow.DocumentSequenceID]
    );

    const insertSaleCall = mockConn.query.mock.calls[2];
    expect(insertSaleCall[0]).toContain("INSERT INTO Sales");
    expect(insertSaleCall[1][5]).toBe("F-100");

    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      message: "Sale created successfully",
      SaleID: 999,
      totals: {
        TotalAmount: 200,
        DiscountAmountTotal: 0,
        TaxAmountTotal: 0,
        FinalAmount: 200,
      },
    });
  });

  test("POST /api/goods-receipts creates receipt and updates PO status", async () => {
    const companyId = 4;
    const employeeId = 12;
    const payload = {
      SupplierID: 6,
      PurchaseOrderID: 20,
      WarehouseID: 2,
      ReceiptNumber: "GR-500",
      Items: [
        {
          ProductID: 3,
          QuantityReceived: 5,
          UnitPrice: 50,
          PurchaseOrderItemID: 30,
        },
      ],
    };

    const mockConn = global.mockConnection;
    const headerRow = { GoodsReceiptID: 700, ReceiptNumber: payload.ReceiptNumber };
    const itemRow = { GoodsReceiptItemID: 900, GoodsReceiptID: 700 };

    mockPool.getConnection.mockResolvedValueOnce(mockConn);
    mockConn.query
      .mockResolvedValueOnce([{ insertId: 700 }]) // insert GoodsReceipts
      .mockResolvedValueOnce([{ insertId: 900 }]) // insert GoodsReceiptItems
      .mockResolvedValueOnce([[]]) // inventory level select
      .mockResolvedValueOnce([{ insertId: 1000 }]) // insert new inventory level
      .mockResolvedValueOnce([{ insertId: 1100 }]) // insert inventory txn
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update PO item received qty
      .mockResolvedValueOnce([[{ TotalOrdered: 10, TotalReceived: 5 }]]) // agg
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update purchase order status
      .mockResolvedValueOnce([[headerRow]]) // fetch header
      .mockResolvedValueOnce([[itemRow]]); // fetch items

    const res = await request(app)
      .post("/api/goods-receipts")
      .set(
        "Authorization",
        authHeader({ CompanyID: companyId, EmployeeID: employeeId })
      )
      .send(payload);

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.query.mock.calls[0][0]).toContain("INSERT INTO GoodsReceipts");
    expect(mockConn.query.mock.calls[0][1][3]).toBe(payload.SupplierID);
    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      header: headerRow,
      items: [itemRow],
    });
  });

  test("POST /api/supplier-invoices creates invoice with items", async () => {
    const payload = {
      SupplierID: 8,
      DocumentType: "FACTURA",
      InvoiceNumber_Supplier: "INV-100",
      InvoiceDate: "2025-01-01",
      TotalAmount: 1000,
      TaxAmount: 190,
      Items: [
        {
          Description: "Line 1",
          Quantity: 2,
          UnitPrice: 500,
          TaxAmountItem: 0,
        },
      ],
    };

    const mockConn = global.mockConnection;
    mockPool.getConnection.mockResolvedValueOnce(mockConn);
    mockConn.query
      .mockResolvedValueOnce([{ insertId: 555 }]) // insert invoice
      .mockResolvedValueOnce([{ insertId: 556 }]); // insert item

    const res = await request(app)
      .post("/api/supplier-invoices")
      .set("Authorization", authHeader({ CompanyID: 2, EmployeeID: 4 }))
      .send(payload);

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.query.mock.calls[0][0]).toContain("INSERT INTO SupplierInvoices");
    expect(mockConn.query.mock.calls[1][0]).toContain("INSERT INTO SupplierInvoiceItems");
    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: "Supplier invoice created successfully",
      SupplierInvoiceID: 555,
    });
  });

  test("POST /api/supplier-payments creates payment and allocations", async () => {
    const payload = {
      SupplierID: 9,
      AmountPaid: 500,
      PaymentMethodID: 3,
      Allocations: [{ SupplierInvoiceID: 700, AmountAllocated: 500 }],
    };

    const mockConn = global.mockConnection;
    mockPool.getConnection.mockResolvedValueOnce(mockConn);
    mockConn.query
      .mockResolvedValueOnce([{ insertId: 888 }]) // insert SupplierPayments
      .mockResolvedValueOnce([{ insertId: 889 }]) // insert allocation
      .mockResolvedValueOnce([[{ TotalAmount: 500, AmountPaid: 0 }]]) // select invoice
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // update invoice

    const res = await request(app)
      .post("/api/supplier-payments")
      .set("Authorization", authHeader({ CompanyID: 2, EmployeeID: 10 }))
      .send(payload);

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.query.mock.calls[0][0]).toContain("INSERT INTO SupplierPayments");
    expect(mockConn.query.mock.calls[1][0]).toContain("INSERT INTO SupplierPaymentAllocations");
    expect(mockConn.query.mock.calls[3][0]).toContain("UPDATE SupplierInvoices");
    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: "Supplier payment created successfully",
      SupplierPaymentID: 888,
    });
  });

  test("POST /api/sales/credit-note creates credit note and restocks inventory", async () => {
    const payload = {
      OriginalSaleID: 15,
      WarehouseID: 3,
      Items: [
        { ProductID: 5, Quantity: 1, UnitPrice: 200, Notes: "Return" },
      ],
    };

    const originalSale = { SaleID: 15, CompanyID: 2, DocumentType: "FACTURA", CustomerID: 9, IsExenta: 0 };
    const mockConn = global.mockConnection;
    mockPool.getConnection.mockResolvedValueOnce(mockConn);
    mockConn.query
      .mockResolvedValueOnce([[originalSale]]) // load original sale
      .mockResolvedValueOnce([[{ QtySold: 2 }]]) // sold qty
      .mockResolvedValueOnce([[{ QtyReturned: 0 }]]) // returned qty
      .mockResolvedValueOnce([{ insertId: 600 }]) // insert credit note sale
      .mockResolvedValueOnce([{ insertId: 601 }]) // insert SalesItems
      .mockResolvedValueOnce([[]]) // select inventory level
      .mockResolvedValueOnce([{ insertId: 700 }]) // insert level
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update stock
      .mockResolvedValueOnce([{ insertId: 800 }]); // insert inventory txn

    const res = await request(app)
      .post("/api/sales/credit-note")
      .set("Authorization", authHeader({ CompanyID: 2, EmployeeID: 4 }))
      .send(payload);

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.query.mock.calls[0][0]).toContain("SELECT * FROM Sales");
    expect(mockConn.query.mock.calls[3][0]).toContain("INSERT INTO Sales");
    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: "Credit Note created successfully",
      CreditNoteID: 600,
      InventoryUpdated: true,
    });
  });

  test("POST /api/purchase-orders creates order with items", async () => {
    const payload = {
      SupplierID: 5,
      PurchaseOrderNumber: "PO-900",
      Items: [{ ProductID: 2, Quantity: 3, UnitPrice: 50 }],
    };

    const headerRow = { PurchaseOrderID: 444, PurchaseOrderNumber: "PO-900" };
    const itemsRow = { PurchaseOrderItemID: 555, PurchaseOrderID: 444 };

    const mockConn = global.mockConnection;
    mockPool.getConnection.mockResolvedValueOnce(mockConn);
    mockConn.query
      .mockResolvedValueOnce([{ insertId: 444 }]) // insert header
      .mockResolvedValueOnce([{ insertId: 555 }]) // insert item
      .mockResolvedValueOnce([[headerRow]]) // fetch header
      .mockResolvedValueOnce([[itemsRow]]); // fetch items

    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", authHeader({ CompanyID: 2, EmployeeID: 8 }))
      .send(payload);

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.query.mock.calls[0][0]).toContain("INSERT INTO PurchaseOrders");
    expect(mockConn.query.mock.calls[1][0]).toContain("INSERT INTO PurchaseOrderItems");
    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      header: headerRow,
      items: [itemsRow],
    });
  });

  test("POST /api/inventory/adjust updates stock levels", async () => {
    const payload = {
      ProductID: 10,
      WarehouseID: 2,
      QuantityChange: 5,
      Reason: "Adjustment",
    };

    const resultRow = {
      ProductInventoryLevelID: 321,
      ProductID: payload.ProductID,
      WarehouseID: payload.WarehouseID,
      StockQuantity: 5,
    };

    const mockConn = global.mockConnection;
    mockPool.getConnection.mockResolvedValueOnce(mockConn);
    mockConn.query
      .mockResolvedValueOnce([[]]) // select existing
      .mockResolvedValueOnce([{ insertId: 321 }]) // insert new level
      .mockResolvedValueOnce([{ insertId: 400 }]) // insert transaction
      .mockResolvedValueOnce([[resultRow]]); // final select

    const res = await request(app)
      .post("/api/inventory/adjust")
      .set("Authorization", authHeader({ CompanyID: 3, EmployeeID: 6 }))
      .send(payload);

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.query.mock.calls[0][0]).toContain("SELECT");
    expect(mockConn.query.mock.calls[1][0]).toContain("INSERT INTO ProductInventoryLevels");
    expect(mockConn.query.mock.calls[2][0]).toContain("INSERT INTO InventoryTransactions");
    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body).toEqual(resultRow);
  });

  test("POST /api/warehouses creates warehouse", async () => {
    const warehouseRow = {
      WarehouseID: 77,
      CompanyID: 2,
      WarehouseName: "Main",
      IsDefault: 0,
      IsActive: 1,
    };

    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 77 }])
      .mockResolvedValueOnce([[warehouseRow]]);

    const res = await request(app)
      .post("/api/warehouses")
      .set("Authorization", authHeader({ CompanyID: 2 }))
      .send({ WarehouseName: "Main" });

    expect(mockPool.query).toHaveBeenCalledTimes(3);
    expect(mockPool.query.mock.calls[1][0]).toContain("INSERT INTO Warehouses");
    expect(res.status).toBe(201);
    expect(res.body).toEqual(warehouseRow);
  });
});
