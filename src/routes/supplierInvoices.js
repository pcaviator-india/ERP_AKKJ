const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/supplier-invoices/summary -> balance per supplier
router.get("/summary", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT
         si.SupplierID,
         s.SupplierName,
         SUM(si.TotalAmount) AS TotalInvoiced,
         SUM(si.AmountPaid) AS TotalPaid,
         SUM(si.TotalAmount - si.AmountPaid) AS Balance
       FROM SupplierInvoices si
       LEFT JOIN Suppliers s ON si.SupplierID = s.SupplierID
       WHERE si.CompanyID = ?
       GROUP BY si.SupplierID, s.SupplierName
       HAVING Balance <> 0
       ORDER BY Balance DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error loading supplier balances:", err);
    res.status(500).json({ error: "Failed to load supplier balance summary" });
  }
});

// GET /api/supplier-invoices/by-supplier/:supplierId
router.get("/by-supplier/:supplierId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const supplierId = req.params.supplierId;

  try {
    const [rows] = await pool.query(
      `SELECT 
         si.SupplierInvoiceID,
         si.CompanyID,
         si.SupplierID,
         s.SupplierName,
         si.DocumentType,
         si.InvoiceNumber_Supplier AS InvoiceNumber,
         si.InvoiceDate,
         si.DueDate,
         si.TotalAmount,
         si.TaxAmount,
         si.AmountPaid,
         (si.TotalAmount - si.AmountPaid) AS Balance,
         si.Status
       FROM SupplierInvoices si
       LEFT JOIN Suppliers s ON si.SupplierID = s.SupplierID
       WHERE si.CompanyID = ? AND si.SupplierID = ?
       ORDER BY si.InvoiceDate DESC, si.SupplierInvoiceID DESC`,
      [companyId, supplierId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error loading supplier invoices by supplier:", err);
    res.status(500).json({ error: "Failed to load invoices for supplier" });
  }
});

// GET all invoices
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT 
         si.SupplierInvoiceID,
         si.CompanyID,
         si.SupplierID,
         s.SupplierName,
         si.DocumentType,
         si.InvoiceNumber_Supplier AS InvoiceNumber,
         si.IsSupplierDocExenta,
         si.InvoiceDate,
         si.DueDate,
         si.TotalAmount,
         si.TaxAmount,
         si.AmountPaid,
         si.Status,
         si.PurchaseOrderID,
         si.GoodsReceiptID,
         si.DirectPurchaseID,
         si.SiiTrackID
       FROM SupplierInvoices si
       LEFT JOIN Suppliers s ON si.SupplierID = s.SupplierID
       WHERE si.CompanyID = ?
       ORDER BY si.InvoiceDate DESC, si.SupplierInvoiceID DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error loading supplier invoices:", err);
    res.status(500).json({ error: "Failed to load supplier invoices" });
  }
});

// GET invoice by ID
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const invoiceId = req.params.id;

  try {
    const [headerRows] = await pool.query(
      `SELECT 
         si.*,
         s.SupplierName,
         po.PurchaseOrderNumber,
         gr.ReceiptNumber AS GoodsReceiptNumber,
         dp.ReceiptNumber AS DirectPurchaseReceiptNumber
       FROM SupplierInvoices si
       LEFT JOIN Suppliers s ON si.SupplierID = s.SupplierID
       LEFT JOIN PurchaseOrders po ON si.PurchaseOrderID = po.PurchaseOrderID
       LEFT JOIN GoodsReceipts gr ON si.GoodsReceiptID = gr.GoodsReceiptID
       LEFT JOIN DirectPurchases dp ON si.DirectPurchaseID = dp.DirectPurchaseID
       WHERE si.SupplierInvoiceID = ? AND si.CompanyID = ?`,
      [invoiceId, companyId]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ error: "Supplier invoice not found" });
    }

    const header = headerRows[0];

    const [items] = await pool.query(
      `SELECT 
         sii.SupplierInvoiceItemID,
         sii.SupplierInvoiceID,
         sii.ProductID,
         p.ProductName,
         sii.Description,
         sii.Quantity,
         sii.UnitPrice,
         sii.TaxAmountItem,
         sii.LineTotal,
         sii.GLAccountID
       FROM SupplierInvoiceItems sii
       LEFT JOIN Products p ON sii.ProductID = p.ProductID
       WHERE sii.SupplierInvoiceID = ?`,
      [invoiceId]
    );

    res.json({ header, items });
  } catch (err) {
    console.error("Error loading supplier invoice detail:", err);
    res.status(500).json({ error: "Failed to load invoice detail" });
  }
});

// POST create invoice
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  const body = req.body || {};

  const {
    SupplierID,
    DocumentType,
    InvoiceNumber_Supplier,
    IsSupplierDocExenta,
    InvoiceDate,
    DueDate,
    TotalAmount,
    TaxAmount,
    PurchaseOrderID,
    GoodsReceiptID,
    DirectPurchaseID,
    SiiTrackID,
    Notes,
    Items,
  } = body;

  if (!SupplierID) {
    return res.status(400).json({ error: "SupplierID is required" });
  }
  if (!DocumentType) {
    return res.status(400).json({ error: "DocumentType is required" });
  }
  if (!InvoiceNumber_Supplier) {
    return res
      .status(400)
      .json({ error: "InvoiceNumber_Supplier is required" });
  }
  if (!InvoiceDate) {
    return res.status(400).json({ error: "InvoiceDate is required" });
  }
  if (!Array.isArray(Items) || Items.length === 0) {
    return res
      .status(400)
      .json({ error: "Invoice must contain at least 1 item" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Insert invoice header
    const [invoiceRes] = await conn.query(
      `INSERT INTO SupplierInvoices (
         CompanyID, SupplierID, DocumentType, InvoiceNumber_Supplier,
         IsSupplierDocExenta, InvoiceDate, DueDate, TotalAmount, TaxAmount,
         AmountPaid, Status,
         PurchaseOrderID, GoodsReceiptID, DirectPurchaseID, SiiTrackID, Notes
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        SupplierID,
        DocumentType,
        InvoiceNumber_Supplier,
        IsSupplierDocExenta || 0,
        InvoiceDate,
        DueDate || null,
        TotalAmount,
        TaxAmount,
        0, // AmountPaid
        "Unpaid", // initial status
        PurchaseOrderID || null,
        GoodsReceiptID || null,
        DirectPurchaseID || null,
        SiiTrackID || null,
        Notes || null,
      ]
    );

    const SupplierInvoiceID = invoiceRes.insertId;

    // Insert items
    for (const item of Items) {
      const {
        ProductID,
        Description,
        Quantity,
        UnitPrice,
        TaxAmountItem,
        GLAccountID,
      } = item;

      if (!Description) {
        throw new Error("Item Description is required");
      }

      await conn.query(
        `INSERT INTO SupplierInvoiceItems (
           SupplierInvoiceID, ProductID, Description, Quantity, UnitPrice,
           TaxAmountItem, GLAccountID
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          SupplierInvoiceID,
          ProductID || null,
          Description,
          Quantity,
          UnitPrice,
          TaxAmountItem || 0,
          GLAccountID || null,
        ]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: "Supplier invoice created successfully",
      SupplierInvoiceID,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating supplier invoice:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error: "Duplicate invoice number for this supplier and document type",
      });
    }

    res.status(500).json({ error: "Failed to create supplier invoice" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
