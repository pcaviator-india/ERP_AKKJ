const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { getConfig } = require("../services/configStore");

async function getDefaultWarehouseId(companyId) {
  const [[row]] = await pool.query(
    `SELECT WarehouseID
       FROM Warehouses
      WHERE CompanyID = ?
        AND IsActive = 1
      ORDER BY IsPrimary DESC, WarehouseID ASC
      LIMIT 1`,
    [companyId]
  );
  return row ? row.WarehouseID : null;
}

// function to get the next document number
async function getNextDocumentNumber(conn, companyId, documentType) {
  // We assume IsElectronic = 1 for now; adjust if needed
  const [[seq]] = await conn.query(
    `
      SELECT DocumentSequenceID, Prefix, NextNumber, Suffix
      FROM DocumentSequences
      WHERE CompanyID = ?
        AND DocumentType = ?
        AND IsElectronic = 1
        AND IsActive = 1
      FOR UPDATE
    `,
    [companyId, documentType]
  );

  if (!seq) {
    throw new Error(
      `No active DocumentSequence configured for ${documentType} (CompanyID=${companyId})`
    );
  }

  const nextNumber = Number(seq.NextNumber);
  let fullNumber = nextNumber.toString();

  if (seq.Prefix) {
    fullNumber = `${seq.Prefix}${fullNumber}`;
  }
  if (seq.Suffix) {
    fullNumber = `${fullNumber}${seq.Suffix}`;
  }

  // Update sequence to next
  await conn.query(
    `
      UPDATE DocumentSequences
      SET NextNumber = NextNumber + 1, LastUsedAt = NOW()
      WHERE DocumentSequenceID = ?
    `,
    [seq.DocumentSequenceID]
  );

  return fullNumber;
}

function generateFallbackDocumentNumber(documentType) {
  const stamp = Date.now();
  return `${documentType || "DOC"}-${stamp}`;
}

// Helper to compute totals from items
function calculateTotals(items, isExentaHeader) {
  let totalAmount = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const processedItems = items.map((item) => {
    const quantity = Number(item.Quantity || 0);
    const unitPrice = Number(item.UnitPrice || 0);
    const discountPerc = Number(item.DiscountPercentage || 0);
    const taxRatePerc = Number(item.TaxRatePercentage || 0);
    const taxRateId = item.TaxRateID || null;
    const isLineExenta = item.IsLineExenta ? 1 : 0;

    const gross = quantity * unitPrice;
    const discountAmountItem =
      item.DiscountAmountItem != null
        ? Number(item.DiscountAmountItem)
        : (gross * discountPerc) / 100;

    const subTotalItem = gross - discountAmountItem;

    let taxAmountItem = 0;
    if (!isExentaHeader && !isLineExenta) {
      taxAmountItem = (subTotalItem * taxRatePerc) / 100;
    }

    const lineTotal = subTotalItem + taxAmountItem;

    totalAmount += gross;
    totalDiscount += discountAmountItem;
    totalTax += taxAmountItem;

    return {
      ...item,
      Quantity: quantity,
      UnitPrice: unitPrice,
      DiscountPercentage: discountPerc,
      DiscountAmountItem: discountAmountItem,
      SubTotalItem: subTotalItem,
      TaxRatePercentage: taxRatePerc,
      TaxAmountItem: taxAmountItem,
      TaxRateID: taxRateId,
      LineTotal: lineTotal,
      IsLineExenta: isLineExenta,
    };
  });

  const finalAmount = totalAmount - totalDiscount + totalTax;

  return {
    processedItems,
    totalAmount,
    totalDiscount,
    totalTax,
    finalAmount,
  };
}

function calculatePaymentStatus(amountPaid, finalAmount) {
  if (amountPaid <= 0) return "Unpaid";
  if (amountPaid < finalAmount) return "PartiallyPaid";
  if (amountPaid >= finalAmount) return "Paid";
  return "Unpaid";
}

// GET /api/sales -> list sales for current company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  try {
    const [rows] = await pool.query(
      `SELECT
         s.SaleID,
         s.CompanyID,
         s.SaleDate,
         s.DocumentType,
         s.DocumentNumber,
         s.TotalAmount,
         s.DiscountAmountTotal,
         s.SubTotal,
         s.TaxAmountTotal,
         s.FinalAmount,
         s.AmountPaid,
         s.PaymentStatus,
         s.Status,
         c.CustomerName
       FROM Sales s
       LEFT JOIN Customers c ON s.CustomerID = c.CustomerID
       WHERE s.CompanyID = ?
       ORDER BY s.SaleDate DESC, s.SaleID DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching sales:", err);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

// GET /api/sales/:id -> header + items + payments
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    // Header
    const [headerRows] = await pool.query(
      `SELECT
         s.SaleID,
         s.CompanyID,
         s.CustomerID,
         c.CustomerName,
         s.EmployeeID,
         e.FirstName AS EmployeeFirstName,
         e.LastName AS EmployeeLastName,
         s.SaleDate,
         s.DocumentType,
         s.DocumentNumber,
         s.IsExenta,
         s.TotalAmount,
         s.DiscountAmountTotal,
         s.SubTotal,
         s.TaxAmountTotal,
         s.FinalAmount,
         s.AmountPaid,
         s.PaymentStatus,
         s.CurrencyID,
         s.Status,
         s.Notes,
         s.ShippingAddress,
         s.BillingAddress,
         s.CreatedAt,
         s.UpdatedAt
       FROM Sales s
       LEFT JOIN Customers c ON s.CustomerID = c.CustomerID
       LEFT JOIN Employees e ON s.EmployeeID = e.EmployeeID
       WHERE s.SaleID = ? AND s.CompanyID = ?`,
      [id, companyId]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const header = headerRows[0];

    // Items
    const [items] = await pool.query(
      `SELECT
         si.SalesItemID,
         si.SaleID,
         si.ProductID,
         p.ProductName,
         si.Description,
         si.Quantity,
         si.UnitPrice,
       si.DiscountPercentage,
       si.DiscountAmountItem,
       si.SubTotalItem,
       si.TaxRatePercentage,
       si.TaxAmountItem,
       si.TaxRateID,
       si.LineTotal,
       si.IsLineExenta,
       si.ProductLotID,
       si.ProductSerialID
       FROM SalesItems si
       LEFT JOIN Products p ON si.ProductID = p.ProductID
       WHERE si.SaleID = ?`,
      [id]
    );

    // Payments
    const [payments] = await pool.query(
      `SELECT
         sp.SalesPaymentID,
         sp.SaleID,
         sp.PaymentMethodID,
         pm.MethodName,
         sp.Amount,
         sp.PaymentDate,
         sp.ReferenceNumber,
         sp.BankTransactionID
       FROM SalesPayments sp
       LEFT JOIN PaymentMethods pm ON sp.PaymentMethodID = pm.PaymentMethodID
       WHERE sp.SaleID = ?`,
      [id]
    );

    res.json({
      header,
      items,
      payments,
    });
  } catch (err) {
    console.error("Error fetching sale details:", err);
    res.status(500).json({ error: "Failed to fetch sale details" });
  }
});

function formatDateForMySQL(date = new Date()) {
  const pad = (n) => n.toString().padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// POST /api/sales -> create sale with items + payments
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID; // from JWT

  const body = req.body || {};
  const {
    CustomerID,
    SaleDate,
    DocumentType,
    DocumentNumber,
    CurrencyID,
    IsExenta,
    WarehouseID, // required for stock OUT (defaults if missing)
    Notes,
    ShippingAddress,
    BillingAddress,
    Items,
    Payments = [],
  } = body;

  // Normalize SaleDate: accept ISO strings, timestamps, or null
  let saleDateForDb;

  if (body.SaleDate) {
    // This handles '2025-11-17T12:34:56.123Z', timestamps, etc.
    const parsed = new Date(body.SaleDate);
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "Invalid SaleDate format" });
    }
    saleDateForDb = formatDateForMySQL(parsed);
  } else {
    // Default: now
    saleDateForDb = formatDateForMySQL(new Date());
  }

  // ---- Basic validation ----
  if (!CustomerID) {
    return res.status(400).json({ error: "CustomerID is required" });
  }
  if (!Array.isArray(Items) || Items.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one sale item is required" });
  }
  let resolvedWarehouseId = WarehouseID || null;
  if (!resolvedWarehouseId) {
    resolvedWarehouseId = await getDefaultWarehouseId(companyId);
    if (!resolvedWarehouseId) {
      return res.status(400).json({
        error:
          "WarehouseID is required and no default warehouse is configured for this company",
      });
    }
  }

  // ---- Document type handling ----
  const aliases = {
    TICKET: "COTIZACION", // store charged tickets as COTIZACION to satisfy DB constraint
  };

  const allowedDocumentTypes = new Set([
    "BOLETA",
    "FACTURA",
    "FACTURA_EXENTA",
    "BOLETA_EXENTA",
    "GUIA_DESPACHO",
    "NOTA_DEBITO",
    "NOTA_CREDITO",
    "COTIZACION",
  ]);

  const normalizeDocType = (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : null;

  let normalizedDocumentType = normalizeDocType(DocumentType);

  if (!normalizedDocumentType) {
    const cfg = await getConfig(companyId, employeeId);
    normalizedDocumentType =
      normalizeDocType(cfg?.pos?.documentType) || "TICKET";
  }

  if (aliases[normalizedDocumentType]) {
    normalizedDocumentType = aliases[normalizedDocumentType];
  }

  if (!allowedDocumentTypes.has(normalizedDocumentType)) {
    return res.status(400).json({ error: "Invalid or unsupported document type" });
  }

  // ---- Totals calculation ----
  let totalAmount = 0;
  let discountTotal = 0;
  let subTotal = 0;
  let taxTotal = 0;
  let finalAmount = 0;
  let amountPaid = 0;
  let paymentStatus = "Unpaid";

  const computedItems = Items.map((item) => {
    const qty = Number(item.Quantity || 0);
    const price = Number(item.UnitPrice || 0);
    const discPct = Number(item.DiscountPercentage || 0);
    const taxPct = Number(item.TaxRatePercentage || 0);
    const taxRateId = item.TaxRateID || null;
    const isLineExenta = item.IsLineExenta ? 1 : 0;

    const gross = qty * price;
    const discountAmount = gross * (discPct / 100);
    const lineSubTotal = gross - discountAmount;
    const taxAmount = isLineExenta ? 0 : lineSubTotal * (taxPct / 100);
    const lineTotal = lineSubTotal + taxAmount;

    totalAmount += gross;
    discountTotal += discountAmount;
    subTotal += lineSubTotal;
    taxTotal += taxAmount;
    finalAmount += lineTotal;

    return {
      ProductID: item.ProductID,
      Description: item.Description || null,
      Quantity: qty,
      UnitPrice: price,
      DiscountPercentage: discPct,
      DiscountAmountItem: discountAmount,
      TaxRatePercentage: taxPct,
      TaxAmountItem: taxAmount,
      TaxRateID: taxRateId,
      IsLineExenta: isLineExenta,
      ProductLotID: item.ProductLotID || null,
      ProductSerialID: item.ProductSerialID || null,
    };
  });

  // Normalize payments (optional)
  const normalizedPayments = Array.isArray(Payments)
    ? Payments.map((p) => ({
        PaymentMethodID: p.PaymentMethodID ? Number(p.PaymentMethodID) : null,
        Amount: Number(p.Amount || 0),
        ReferenceNumber: p.ReferenceNumber || null,
        BankTransactionID: p.BankTransactionID || null,
      }))
    : [];

  amountPaid = normalizedPayments.reduce((sum, p) => sum + (Number(p.Amount) || 0), 0);
  if (amountPaid > 0) {
    if (amountPaid >= finalAmount) paymentStatus = "Paid";
    else paymentStatus = "PartiallyPaid";
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // final document number calculation
    let finalDocumentNumber = DocumentNumber || null;
    const docTypesNeedingSequence = new Set([
    "FACTURA",
    "BOLETA",
    "FACTURA_EXENTA",
    "BOLETA_EXENTA",
    "GUIA_DESPACHO",
    "NOTA_DEBITO",
    "NOTA_CREDITO",
  ]);

    if (!finalDocumentNumber) {
      if (docTypesNeedingSequence.has(normalizedDocumentType)) {
        try {
          finalDocumentNumber = await getNextDocumentNumber(
            conn,
            companyId,
            normalizedDocumentType
          );
        } catch (seqErr) {
          console.warn(
            `No sequence for ${normalizedDocumentType}, using fallback number`,
            seqErr
          );
        }
      }
      if (!finalDocumentNumber) {
        finalDocumentNumber = generateFallbackDocumentNumber(
          normalizedDocumentType
        );
      }
    }

    // ---- Insert into Sales ----
    const [saleRes] = await conn.query(
      `INSERT INTO Sales (
     CompanyID, CustomerID, EmployeeID, SaleDate,
     DocumentType, DocumentNumber, IsExenta,
     OriginalSaleID, GeneratedFromGuiaID,
     TotalAmount, DiscountAmountTotal, TaxAmountTotal,
     AmountPaid, PaymentStatus, CurrencyID, Status,
     Notes, ShippingAddress, BillingAddress, MarketplaceOrderID_External
   )
   VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL,
           ?, ?, ?,
           ?, ?, ?, 'Completed',
           ?, ?, ?, NULL)`,
      [
        companyId,
        CustomerID,
        employeeId || null,
        saleDateForDb || new Date(),
        normalizedDocumentType,
        finalDocumentNumber,
        IsExenta ? 1 : 0,
        totalAmount,
        discountTotal,
        taxTotal,
        amountPaid,
        paymentStatus,
        CurrencyID || 1,
        Notes || null,
        ShippingAddress || null,
        BillingAddress || null,
      ]
    );

    const saleId = saleRes.insertId;

    // ---- Insert items + update inventory ----
    for (const ci of computedItems) {
      // Insert into SalesItems
      await conn.query(
        `INSERT INTO SalesItems (
           SaleID, ProductID, Description,
           Quantity, UnitPrice,
           DiscountPercentage, DiscountAmountItem,
           TaxRatePercentage, TaxAmountItem, TaxRateID,
           IsLineExenta, ProductLotID, ProductSerialID
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          ci.ProductID,
          ci.Description,
          ci.Quantity,
          ci.UnitPrice,
          ci.DiscountPercentage,
          ci.DiscountAmountItem,
          ci.TaxRatePercentage,
          ci.TaxAmountItem,
          ci.TaxRateID || null,
          ci.IsLineExenta,
          ci.ProductLotID,
          ci.ProductSerialID,
        ]
      );

      // Ensure inventory level row exists
      const [invRows] = await conn.query(
         `SELECT ProductInventoryLevelID, StockQuantity
         FROM ProductInventoryLevels
         WHERE ProductID = ? AND WarehouseID = ?
         LIMIT 1`,
        [ci.ProductID, resolvedWarehouseId]
      );

      if (invRows.length === 0) {
        // create baseline row at 0, then subtract
        await conn.query(
          `INSERT INTO ProductInventoryLevels (
             ProductID, WarehouseID, StockQuantity, ReservedQuantity,
             MinStockLevel, MaxStockLevel, ProductLotID
           ) VALUES (?, ?, 0, 0, NULL, NULL, NULL)`,
          [ci.ProductID, resolvedWarehouseId]
        );
      }

      // reduce stock
      await conn.query(
        `UPDATE ProductInventoryLevels
         SET StockQuantity = StockQuantity - ?, LastUpdatedAt = NOW()
         WHERE ProductID = ? AND WarehouseID = ?`,
        [ci.Quantity, ci.ProductID, resolvedWarehouseId]
      );

      // inventory transaction
    await conn.query(
      `INSERT INTO InventoryTransactions (
         CompanyID, ProductID, WarehouseID,
         TransactionType, QuantityChange,
         TransactionDate, ReferenceDocumentType, ReferenceDocumentID,
         ProductLotID, ProductSerialID, Notes
      ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [
        companyId,
        ci.ProductID,
        resolvedWarehouseId,
        "Sale",
        -ci.Quantity,
        "Sale",
        saleId,
        ci.ProductLotID,
        ci.ProductSerialID,
        "Sale from API",
      ]
    );
  }

    // Payments (optional)
    for (const pay of normalizedPayments) {
      if (!pay || pay.Amount <= 0) continue;
      await conn.query(
        `INSERT INTO SalesPayments (SaleID, PaymentMethodID, Amount, PaymentDate, ReferenceNumber, BankTransactionID)
         VALUES (?, ?, ?, NOW(), ?, ?)`,
        [saleId, pay.PaymentMethodID || null, pay.Amount, pay.ReferenceNumber || null, pay.BankTransactionID || null]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: "Sale created successfully",
      SaleID: saleId,
      totals: {
        TotalAmount: totalAmount,
        DiscountAmountTotal: discountTotal,
        SubTotal: subTotal,
        TaxAmountTotal: taxTotal,
        FinalAmount: finalAmount,
      },
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating sale:", err);
    res.status(500).json({ error: "Failed to create sale" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
