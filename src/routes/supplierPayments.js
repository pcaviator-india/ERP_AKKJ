const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Helper: recalc invoice status from totals
function getInvoiceStatus(totalAmount, amountPaid) {
  totalAmount = Number(totalAmount || 0);
  amountPaid = Number(amountPaid || 0);

  if (amountPaid <= 0) return "Unpaid";
  if (amountPaid >= totalAmount) return "Paid";
  return "PartiallyPaid";
}

// GET /api/supplier-payments -> list payments
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT
         sp.SupplierPaymentID,
         sp.CompanyID,
         sp.SupplierID,
         s.SupplierName,
         sp.PaymentDate,
         sp.AmountPaid,
         sp.PaymentMethodID,
         pm.MethodName AS PaymentMethodName,
         sp.BankAccountID,
         ba.AccountName AS BankAccountName,
         sp.ReferenceNumber,
         sp.Notes,
         sp.ProcessedByEmployeeID
       FROM SupplierPayments sp
       LEFT JOIN Suppliers s ON sp.SupplierID = s.SupplierID
       LEFT JOIN PaymentMethods pm ON sp.PaymentMethodID = pm.PaymentMethodID
       LEFT JOIN BankAccounts ba ON sp.BankAccountID = ba.BankAccountID
       WHERE sp.CompanyID = ?
       ORDER BY sp.PaymentDate DESC, sp.SupplierPaymentID DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error loading supplier payments:", err);
    res.status(500).json({ error: "Failed to load supplier payments" });
  }
});

// GET /api/supplier-payments/:id -> header + allocations
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const id = req.params.id;

  try {
    const [headerRows] = await pool.query(
      `SELECT
         sp.SupplierPaymentID,
         sp.CompanyID,
         sp.SupplierID,
         s.SupplierName,
         sp.PaymentDate,
         sp.AmountPaid,
         sp.PaymentMethodID,
         pm.MethodName AS PaymentMethodName,
         sp.BankAccountID,
         ba.AccountName AS BankAccountName,
         sp.ReferenceNumber,
         sp.Notes,
         sp.ProcessedByEmployeeID
       FROM SupplierPayments sp
       LEFT JOIN Suppliers s ON sp.SupplierID = s.SupplierID
       LEFT JOIN PaymentMethods pm ON sp.PaymentMethodID = pm.PaymentMethodID
       LEFT JOIN BankAccounts ba ON sp.BankAccountID = ba.BankAccountID
       WHERE sp.SupplierPaymentID = ? AND sp.CompanyID = ?`,
      [id, companyId]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ error: "Supplier payment not found" });
    }

    const header = headerRows[0];

    const [allocations] = await pool.query(
      `SELECT
         spa.SupplierPaymentAllocationID,
         spa.SupplierPaymentID,
         spa.SupplierInvoiceID,
         spa.AmountAllocated,
         spa.AllocationDate,
         si.DocumentType,
         si.InvoiceNumber_Supplier AS InvoiceNumber,
         si.InvoiceDate,
         si.TotalAmount,
         si.AmountPaid,
         si.Status
       FROM SupplierPaymentAllocations spa
       JOIN SupplierInvoices si
         ON spa.SupplierInvoiceID = si.SupplierInvoiceID
       WHERE spa.SupplierPaymentID = ?`,
      [id]
    );

    res.json({ header, allocations });
  } catch (err) {
    console.error("Error loading supplier payment detail:", err);
    res.status(500).json({ error: "Failed to load supplier payment detail" });
  }
});

// POST /api/supplier-payments
// Body:
// {
//   "SupplierID": 1,
//   "PaymentDate": "2025-11-20T10:00:00",
//   "AmountPaid": 100000,
//   "PaymentMethodID": 1,
//   "BankAccountID": 1,
//   "ReferenceNumber": "TRX-123",
//   "Notes": "Payment for invoices",
//   "Allocations": [
//     { "SupplierInvoiceID": 1, "AmountAllocated": 60000 },
//     { "SupplierInvoiceID": 2, "AmountAllocated": 40000 }
//   ]
// }
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  const body = req.body || {};
  const {
    SupplierID,
    PaymentDate,
    AmountPaid,
    PaymentMethodID,
    BankAccountID,
    ReferenceNumber,
    Notes,
    Allocations
  } = body;

  if (!SupplierID) {
    return res.status(400).json({ error: "SupplierID is required" });
  }
  if (!AmountPaid || Number(AmountPaid) <= 0) {
    return res.status(400).json({ error: "AmountPaid must be > 0" });
  }
  if (!PaymentMethodID) {
    return res.status(400).json({ error: "PaymentMethodID is required" });
  }
  if (!Array.isArray(Allocations) || Allocations.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one allocation is required" });
  }

  const totalAllocated = Allocations.reduce(
    (sum, a) => sum + Number(a.AmountAllocated || 0),
    0
  );

  if (Math.abs(totalAllocated - Number(AmountPaid)) > 0.0001) {
    return res.status(400).json({
      error: "Sum of allocations must equal AmountPaid",
      debug: { AmountPaid, totalAllocated }
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Insert SupplierPayments header
    const [payRes] = await conn.query(
      `INSERT INTO SupplierPayments (
         CompanyID, SupplierID, PaymentDate, AmountPaid,
         PaymentMethodID, BankAccountID, ReferenceNumber, Notes,
         ProcessedByEmployeeID
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        SupplierID,
        PaymentDate || new Date(),
        AmountPaid,
        PaymentMethodID,
        BankAccountID || null,
        ReferenceNumber || null,
        Notes || null,
        employeeId || null
      ]
    );

    const supplierPaymentId = payRes.insertId;

    // 2) Insert allocations + update invoices
    for (const alloc of Allocations) {
      const invoiceId = alloc.SupplierInvoiceID;
      const amountAllocated = Number(alloc.AmountAllocated || 0);

      if (!invoiceId || amountAllocated <= 0) {
        throw new Error(
          "Each allocation must have SupplierInvoiceID and positive AmountAllocated"
        );
      }

      // Insert allocation row
      await conn.query(
        `INSERT INTO SupplierPaymentAllocations (
           SupplierPaymentID, SupplierInvoiceID, AmountAllocated
         )
         VALUES (?, ?, ?)`,
        [supplierPaymentId, invoiceId, amountAllocated]
      );

      // Load current invoice totals
      const [invRows] = await conn.query(
        `SELECT TotalAmount, AmountPaid
         FROM SupplierInvoices
         WHERE SupplierInvoiceID = ? AND CompanyID = ?`,
        [invoiceId, companyId]
      );

      if (invRows.length === 0) {
        throw new Error(
          `SupplierInvoiceID ${invoiceId} not found or not in this company`
        );
      }

      const inv = invRows[0];
      const newAmountPaid =
        Number(inv.AmountPaid || 0) + Number(amountAllocated);
      const newStatus = getInvoiceStatus(inv.TotalAmount, newAmountPaid);

      // Update invoice
      await conn.query(
        `UPDATE SupplierInvoices
         SET AmountPaid = ?, Status = ?
         WHERE SupplierInvoiceID = ? AND CompanyID = ?`,
        [newAmountPaid, newStatus, invoiceId, companyId]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: "Supplier payment created successfully",
      SupplierPaymentID: supplierPaymentId
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating supplier payment:", err);
    res.status(500).json({ error: "Failed to create supplier payment" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
