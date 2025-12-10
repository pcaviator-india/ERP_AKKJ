const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// --------------------------
// Helper: Calculate Status
// --------------------------
function getInvoiceStatus(invoiceTotal, paid) {
  invoiceTotal = Number(invoiceTotal || 0);
  paid = Number(paid || 0);

  if (paid <= 0) return "Unpaid";
  if (paid >= invoiceTotal) return "Paid";
  return "PartiallyPaid";
}

// ===================================================================
// 1️⃣ CUSTOMER BALANCE SUMMARY
// GET /api/ar/customers/summary
// ===================================================================
router.get("/customers/summary", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT 
         s.CustomerID,
         c.CustomerName,
         SUM(COALESCE(s.FinalAmount, 0)) AS TotalInvoiced,
         SUM(COALESCE(p.PaidAmount, 0)) AS TotalPaid,
         SUM(COALESCE(s.FinalAmount, 0) - COALESCE(p.PaidAmount, 0)) AS Balance
       FROM Sales s
       LEFT JOIN Customers c ON s.CustomerID = c.CustomerID
       LEFT JOIN (
         SELECT SaleID, SUM(Amount) AS PaidAmount
         FROM SalesPayments
         GROUP BY SaleID
       ) p ON p.SaleID = s.SaleID
       WHERE s.CompanyID = ?
         AND s.Status <> 'Cancelled'
       GROUP BY s.CustomerID, c.CustomerName
       ORDER BY Balance DESC`,
      [companyId]
    );

    // Optional: log what DB returned while debugging
    // console.log("AR SUMMARY ROWS:", rows);

    res.json(rows);
  } catch (err) {
    console.error("Error loading AR summary:", err);
    res.status(500).json({ error: "Failed to load AR summary" });
  }
});

// ===================================================================
// 2️⃣ INVOICES FOR ONE CUSTOMER
// GET /api/ar/customers/:customerId/invoices
// ===================================================================
router.get("/customers/:customerId/invoices", async (req, res) => {
  const companyId = req.user.CompanyID;
  const customerId = req.params.customerId;

  try {
    const [rows] = await pool.query(
      `SELECT 
         s.SaleID,
         s.CustomerID,
         s.DocumentType,
         s.DocumentNumber,
         s.SaleDate,
         s.FinalAmount,
         s.Status,
         IFNULL(p.PaidAmount, 0) AS AmountPaid,
         (s.FinalAmount - IFNULL(p.PaidAmount, 0)) AS Balance
       FROM Sales s
       LEFT JOIN (
         SELECT SaleID, SUM(Amount) AS PaidAmount
         FROM SalesPayments
         GROUP BY SaleID
       ) p ON p.SaleID = s.SaleID
       WHERE s.CompanyID = ?
         AND s.CustomerID = ?
         AND s.Status NOT IN ('Draft', 'Cancelled')
       ORDER BY s.SaleDate DESC, s.SaleID DESC`,
      [companyId, customerId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error loading customer invoices:", err);
    res.status(500).json({ error: "Failed to load customer invoices" });
  }
});

// ===================================================================
// 3️⃣ GET INVOICE (SALE) DETAIL
// GET /api/ar/invoices/:saleId
// ===================================================================
router.get("/invoices/:saleId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const saleId = req.params.saleId;

  try {
    const [[header]] = await pool.query(
      `SELECT 
         s.*,
         c.CustomerName
       FROM Sales s
       LEFT JOIN Customers c ON s.CustomerID = c.CustomerID
       WHERE s.SaleID = ? AND s.CompanyID = ?`,
      [saleId, companyId]
    );

    if (!header) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Items
    const [items] = await pool.query(
      `SELECT 
         si.*,
         p.ProductName
       FROM SalesItems si
       LEFT JOIN Products p ON si.ProductID = p.ProductID
       WHERE si.SaleID = ?`,
      [saleId]
    );

    // Payments
    const [payments] = await pool.query(
      `SELECT
     sp.SalesPaymentID,
     sp.SaleID,
     sp.PaymentMethodID,
     sp.Amount,
     sp.PaymentDate,
     sp.ReferenceNumber,
     sp.BankTransactionID,
     pm.MethodName AS PaymentMethodName
   FROM SalesPayments sp
   LEFT JOIN PaymentMethods pm ON sp.PaymentMethodID = pm.PaymentMethodID
   WHERE sp.SaleID = ?`,
      [saleId]
    );

    res.json({ header, items, payments });
  } catch (err) {
    console.error("Error loading invoice detail:", err);
    res.status(500).json({ error: "Failed to load invoice detail" });
  }
});

// ===================================================================
// 4️⃣ APPLY PAYMENT TO AN INVOICE
// POST /api/ar/invoices/:saleId/pay
// ===================================================================
router.post("/invoices/:saleId/pay", async (req, res) => {
  const companyId = req.user.CompanyID;
  const saleId = req.params.saleId;

  const {
    Amount,
    PaymentMethodID,
    ReferenceNumber,
    BankTransactionID,
    PaymentDate,
  } = req.body;

  if (!Amount || Number(Amount) <= 0) {
    return res.status(400).json({ error: "Invalid Amount" });
  }
  if (!PaymentMethodID) {
    return res.status(400).json({ error: "PaymentMethodID is required" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Get current totals
    const [[sale]] = await conn.query(
      `SELECT 
         FinalAmount,
         AmountPaid,
         PaymentStatus,
         Status,
         (SELECT IFNULL(SUM(Amount),0)
            FROM SalesPayments WHERE SaleID = ?) AS AlreadyPaid
       FROM Sales 
       WHERE SaleID = ? AND CompanyID = ?
       FOR UPDATE`,
      [saleId, saleId, companyId]
    );

    if (!sale) throw new Error("Sale does not exist");

    const currentPaid = Math.max(
      Number(sale.AmountPaid || 0),
      Number(sale.AlreadyPaid || 0)
    );
    const amountNumber = Number(Amount);
    const finalAmount = Number(sale.FinalAmount || 0);
    const newPaid = currentPaid + amountNumber;

    if (newPaid - finalAmount > 0.0001) {
      await conn.rollback();
      return res.status(400).json({
        error: "Payment exceeds remaining balance",
        remainingBalance: Math.max(finalAmount - currentPaid, 0),
      });
    }

    const newStatus = getInvoiceStatus(finalAmount, newPaid);
    const nextStatus =
      newStatus === "Unpaid" ? sale.Status || "Completed" : newStatus;

    // Insert payment
    await conn.query(
      `INSERT INTO SalesPayments (
     SaleID, PaymentMethodID, Amount, PaymentDate, ReferenceNumber, BankTransactionID
   )
   VALUES (?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        PaymentMethodID,
        Amount,
        PaymentDate || new Date(),
        ReferenceNumber || null,
        BankTransactionID || null,
      ]
    );

    // Update sale payment tracking
    await conn.query(
      `UPDATE Sales
       SET 
         AmountPaid = ?,
         PaymentStatus = ?,
         Status = ?
       WHERE SaleID = ? AND CompanyID = ?`,
      [newPaid, newStatus, nextStatus, saleId, companyId]
    );

    await conn.commit();

    res.json({
      message: "Payment recorded successfully",
      newStatus,
      amountPaid: newPaid,
      remainingBalance: Math.max(finalAmount - newPaid, 0),
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error applying payment:", err);
    res.status(500).json({ error: "Failed to apply payment" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
