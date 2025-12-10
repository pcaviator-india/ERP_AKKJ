// routes/salesTickets.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

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

// ----------------------------------------------------------
// Helper: safely parse numbers
// ----------------------------------------------------------
function toNumber(val, defaultValue = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : defaultValue;
}

// ----------------------------------------------------------
// Helper: process items + calculate totals
// Same logic idea as in normal sales, but used only for
// tickets (stored as COTIZACION; no inventory movement here).
// ----------------------------------------------------------
function processSaleItems(items, isExentaHeader) {
  let totalAmount = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const processedItems = items.map((item) => {
    const quantity = toNumber(item.Quantity, 0);
    const unitPrice = toNumber(item.UnitPrice, 0);
    const discountPerc = toNumber(item.DiscountPercentage, 0);
    const taxRatePerc = toNumber(item.TaxRatePercentage, 0);
    const isLineExenta = item.IsLineExenta ? 1 : 0;

    const gross = quantity * unitPrice;

    const discountAmountItem =
      item.DiscountAmountItem != null
        ? toNumber(item.DiscountAmountItem, 0)
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
      // keep original so we don’t lose fields like ProductID, Description, etc.
      ...item,
      Quantity: quantity,
      UnitPrice: unitPrice,
      DiscountPercentage: discountPerc,
      DiscountAmountItem: discountAmountItem,
      TaxRatePercentage: taxRatePerc,
      TaxAmountItem: taxAmountItem,
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

// ----------------------------------------------------------
// Helper: temp document number for tickets (stored as COTIZACION)
// (You can later replace this with DocumentSequences)
// ----------------------------------------------------------
function generateTempTicketNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ts = now.getTime();
  return `TKT-${y}${m}${d}-${ts}`;
}

function parseIntendedDoc(notes = "") {
  const match = /\bINTENDED_DOC:([A-Z_]+)/.exec(notes);
  return match ? match[1] : null;
}

function appendIntendedDoc(notes = "", docType) {
  const base = notes || "";
  if (!docType) return base;
  return `${base} INTENDED_DOC:${docType}`.trim();
}

// ===================================================================
// 1️⃣ LIST TICKETS (stored as COTIZACION)
// GET /api/sales/tickets
// ===================================================================
router.get("/tickets", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { status, intendedDoc } = req.query; // pending | ready | draft | billed | all

  // Map "status" filter to DB WHERE condition
  let statusCondition = "";
  const params = [companyId];

  // Our internal statuses for tickets (stored as COTIZACION in Sales):
  // - 'Draft'             → parked/in-progress
  // - 'ReadyForBilling'   → saved for cashier with intended doc type
  // - 'TicketBilled'      → already converted to Factura/Boleta/etc.
  if (!status || status === "pending") {
    statusCondition = "AND s.Status IN ('Draft','ReadyForBilling')";
  } else if (status === "draft") {
    statusCondition = "AND s.Status = 'Draft'";
  } else if (status === "ready") {
    statusCondition = "AND s.Status = 'ReadyForBilling'";
  } else if (status === "billed") {
    statusCondition = "AND s.Status = 'TicketBilled'";
  } else if (status === "all") {
    statusCondition = ""; // no extra filter
  } else {
    // Unknown status value
    return res.status(400).json({
      error: "Invalid status filter. Use pending | billed | all",
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         s.SaleID AS TicketID,
         s.SaleDate,
         s.DocumentNumber,
         s.CustomerID,
         c.CustomerName,
         s.TotalAmount,
         s.DiscountAmountTotal,
         s.TaxAmountTotal,
         s.FinalAmount,
         s.Status
       FROM Sales s
       LEFT JOIN Customers c ON s.CustomerID = c.CustomerID
       WHERE s.CompanyID = ?
         AND s.DocumentType = 'COTIZACION'
         AND s.Status <> 'TicketCancelled'
         ${statusCondition}
       ORDER BY s.SaleDate DESC, s.SaleID DESC`,
      params
    );

    const filtered = rows
      .map((row) => ({
        ...row,
        IntendedDocumentType: parseIntendedDoc(row.Notes || row.notes || ""),
      }))
      .filter((row) => {
        if (status === "ready" && intendedDoc) {
          const intended = (row.IntendedDocumentType || "").toUpperCase();
          return !intended || intended === intendedDoc.toUpperCase();
        }
        return true;
      });

    res.json(filtered);
  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// ===================================================================
// 2️⃣ GET TICKET DETAIL
// GET /api/sales/tickets/:id
// ===================================================================
router.get("/tickets/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    // Header
    const [headerRows] = await pool.query(
      `SELECT
         s.SaleID AS TicketID,
         s.CompanyID,
         s.CustomerID,
         c.CustomerName,
         s.EmployeeID,
         s.SaleDate,
        s.DocumentType,
        s.DocumentNumber,
        s.IsExenta,
        s.TotalAmount,
        s.DiscountAmountTotal,
        s.TaxAmountTotal,
        s.FinalAmount,
        s.Notes,
        s.ShippingAddress,
        s.BillingAddress,
        s.Status,
        s.CurrencyID,
        s.CreatedAt,
        s.UpdatedAt
       FROM Sales s
       LEFT JOIN Customers c ON s.CustomerID = c.CustomerID
       WHERE s.SaleID = ?
         AND s.CompanyID = ?
         AND s.Status <> 'TicketCancelled'
         AND s.DocumentType = 'COTIZACION'`,
      [id, companyId]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
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
         si.LineTotal,
         si.IsLineExenta,
         si.ProductLotID,
         si.ProductSerialID
       FROM SalesItems si
       LEFT JOIN Products p ON si.ProductID = p.ProductID
       WHERE si.SaleID = ?`,
      [id]
    );

    res.json({ header, items });
  } catch (err) {
    console.error("Error fetching ticket detail:", err);
    res.status(500).json({ error: "Failed to fetch ticket detail" });
  }
});

// ===================================================================
// GET TICKET DETAIL BY DOCUMENT NUMBER (for scanning tickets)
// GET /api/sales/tickets/by-number/:docNumber
// ===================================================================
router.get("/tickets/by-number/:docNumber", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { docNumber } = req.params;

  try {
    const [headerRows] = await pool.query(
      `SELECT
         s.SaleID AS TicketID,
         s.CompanyID,
         s.CustomerID,
         c.CustomerName,
         s.EmployeeID,
         s.SaleDate,
         s.DocumentType,
        s.DocumentNumber,
        s.IsExenta,
        s.TotalAmount,
        s.DiscountAmountTotal,
        s.TaxAmountTotal,
        s.FinalAmount,
        s.Notes,
        s.ShippingAddress,
        s.BillingAddress,
         s.Status,
         s.CurrencyID,
         s.CreatedAt,
         s.UpdatedAt
       FROM Sales s
       LEFT JOIN Customers c ON s.CustomerID = c.CustomerID
       WHERE s.CompanyID = ?
         AND s.DocumentType = 'COTIZACION'
         AND s.Status <> 'TicketCancelled'
         AND UPPER(s.DocumentNumber) = UPPER(?)`,
      [companyId, docNumber]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const header = headerRows[0];

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
         si.LineTotal,
         si.IsLineExenta,
         si.ProductLotID,
         si.ProductSerialID
       FROM SalesItems si
       LEFT JOIN Products p ON si.ProductID = p.ProductID
       WHERE si.SaleID = ?`,
      [header.TicketID]
    );

    res.json({
      header: {
        ...header,
        IntendedDocumentType: parseIntendedDoc(header.Notes || ""),
      },
      items,
    });
  } catch (err) {
    console.error("Error fetching ticket detail by number:", err);
    res.status(500).json({ error: "Failed to fetch ticket detail" });
  }
});

// ===================================================================
// 3️⃣ CREATE TICKET (stored as COTIZACION)
// POST /api/sales/tickets
// Body example:
// {
//   "CustomerID": 1,              // optional (null allowed)
//   "IsExenta": 0,
//   "CurrencyID": 1,             // default 1 if not sent
//   "Notes": "Mesa 4",
//   "ShippingAddress": null,
//   "BillingAddress": null,
//   "DocumentNumber": "COT-0001", // optional; auto if missing
//   "Items": [
//      {
//        "ProductID": 10,
//        "Description": "Café Latte",
//        "Quantity": 2,
//        "UnitPrice": 1500,
//        "DiscountPercentage": 0,
//        "DiscountAmountItem": 0,
//        "TaxRatePercentage": 19,
//        "IsLineExenta": 0,
//        "ProductLotID": null,
//        "ProductSerialID": null
//      }
//   ]
// }
// ===================================================================
router.post("/tickets", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  const body = req.body || {};
  const {
    CustomerID,
    IsExenta,
    CurrencyID,
    Notes,
    ShippingAddress,
    BillingAddress,
    DocumentNumber,
    Items,
    ReadyForBilling,
    IntendedDocumentType,
  } = body;

  if (!Array.isArray(Items) || Items.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one ticket item is required" });
  }

  const isExenta = IsExenta ? 1 : 0;
  const currencyId = CurrencyID || 1; // default currency (e.g. CLP)
  const docNumber = DocumentNumber || generateTempTicketNumber();
  const readyForBilling =
    ReadyForBilling === true ||
    ReadyForBilling === "true" ||
    ReadyForBilling === 1 ||
    ReadyForBilling === "1" ||
    (!!IntendedDocumentType && IntendedDocumentType !== "");
  const intendedDoc = (IntendedDocumentType || "").toString().trim().toUpperCase() || null;

  const { processedItems, totalAmount, totalDiscount, totalTax, finalAmount } =
    processSaleItems(Items, isExenta === 1);
  const statusValue = readyForBilling ? "ReadyForBilling" : "Draft";
  const preparedNotes = appendIntendedDoc(Notes, readyForBilling ? intendedDoc : null);

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Insert header in Sales as COTIZACION (ticket stored type)
    const [insertHeader] = await conn.query(
      `INSERT INTO Sales (
         CompanyID, CustomerID, EmployeeID, SaleDate,
         DocumentType, DocumentNumber, IsExenta,
         OriginalSaleID, GeneratedFromGuiaID,
         TotalAmount, DiscountAmountTotal, TaxAmountTotal,
         AmountPaid, PaymentStatus, CurrencyID, Status,
         Notes, ShippingAddress, BillingAddress, MarketplaceOrderID_External
       ) VALUES (
         ?, ?, ?, NOW(),
         'COTIZACION', ?, ?,
         NULL, NULL,
         ?, ?, ?,
         0, 'Unpaid', ?, ?,
         ?, ?, ?, NULL
       )`,
      [
        companyId,
        CustomerID || null,
        employeeId,
        docNumber,
        isExenta,
        totalAmount,
        totalDiscount,
        isExenta ? 0 : totalTax,
        currencyId,
        statusValue,
        preparedNotes || null,
        ShippingAddress || null,
        BillingAddress || null,
      ]
    );

    const ticketId = insertHeader.insertId;

    // Insert items (no inventory movement!)
    for (const item of processedItems) {
      const {
        ProductID,
        Description,
        Quantity,
        UnitPrice,
        DiscountPercentage,
        DiscountAmountItem,
        TaxRatePercentage,
        TaxAmountItem,
        IsLineExenta,
        ProductLotID,
        ProductSerialID,
      } = item;

      if (!ProductID) {
        throw new Error("Item ProductID is required");
      }

      await conn.query(
        `INSERT INTO SalesItems (
           SaleID, ProductID, Description,
           Quantity, UnitPrice, DiscountPercentage, DiscountAmountItem,
           TaxRatePercentage, TaxAmountItem, IsLineExenta,
           ProductLotID, ProductSerialID
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ticketId,
          ProductID,
          Description || null,
          Quantity,
          UnitPrice,
          DiscountPercentage,
          DiscountAmountItem,
          TaxRatePercentage,
          TaxAmountItem,
          IsLineExenta ? 1 : 0,
          ProductLotID || null,
          ProductSerialID || null,
        ]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: "Ticket created successfully",
      TicketID: ticketId,
      DocumentNumber: docNumber,
      totals: {
        TotalAmount: totalAmount,
        DiscountAmountTotal: totalDiscount,
        TaxAmountTotal: isExenta ? 0 : totalTax,
        FinalAmount: finalAmount,
      },
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating ticket:", err);
    res.status(500).json({ error: "Failed to create ticket" });
  } finally {
    if (conn) conn.release();
  }
});



/**
 * POST /api/sales/tickets/:id/convert
 *
 * From a ticket (Sales row with DocumentType='COTIZACION') build
 * a payload that can be sent to POST /api/sales to create
 * a FACTURA / BOLETA / FACTURA_EXENTA / BOLETA_EXENTA, etc.
 *
 * Body example:
 * {
 *   "TargetDocumentType": "FACTURA",
 *   "WarehouseID": 1,
 *   "CustomerID": 123,        // optional override
 *   "DocumentNumber": null,   // optional, or pass folio if you manage it
 *   "CurrencyID": 1,          // optional, default from ticket or 1
 *   "Notes": "Facturación desde ticket",
 *   "ShippingAddress": "...",
 *   "BillingAddress": "..."
 * }
 */
router.post("/tickets/:id/convert", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID || null;
  const ticketId = req.params.id;

  const {
    TargetDocumentType,
    WarehouseID,
    CustomerID,
    DocumentNumber,
    CurrencyID,
    Notes,
    ShippingAddress,
    BillingAddress,
  } = req.body || {};

  // Allowed final docs (for now focus FACTURA / BOLETA, but others are ready)
  const allowed = [
    "FACTURA",
    "BOLETA",
    "FACTURA_EXENTA",
    "BOLETA_EXENTA",
    "GUIA_DESPACHO",
  ];

  if (!TargetDocumentType || !allowed.includes(TargetDocumentType)) {
    return res.status(400).json({
      error:
        "TargetDocumentType is required and must be one of: " +
        allowed.join(", "),
    });
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

  let conn;
  try {
    conn = await pool.getConnection();

    // Load ticket header from Sales as COTIZACION
    const [headerRows] = await conn.query(
      `SELECT *
         FROM Sales
        WHERE SaleID = ?
          AND CompanyID = ?
          AND DocumentType = 'COTIZACION'`,
      [ticketId, companyId]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({
        error: "Ticket not found (stored as COTIZACION)",
      });
    }

    const ticket = headerRows[0];

    // Load items from SalesItems
    const [itemRows] = await conn.query(
      `SELECT *
         FROM SalesItems
        WHERE SaleID = ?`,
      [ticketId]
    );

    if (!itemRows.length) {
      return res.status(400).json({ error: "Ticket has no items" });
    }

    // Build Items array compatible with POST /api/sales
    const itemsForSale = itemRows.map((row) => ({
      ProductID: row.ProductID,
      Description: row.Description,
      Quantity: Number(row.Quantity),
      UnitPrice: Number(row.UnitPrice),
      DiscountPercentage: Number(row.DiscountPercentage || 0),
      TaxRatePercentage: Number(row.TaxRatePercentage || 0),
      IsLineExenta: row.IsLineExenta ? 1 : 0,
      ProductLotID: row.ProductLotID || null,
      ProductSerialID: row.ProductSerialID || null,
    }));

    // Build sale payload to send to /api/sales
    const salePayload = {
      CustomerID: CustomerID || ticket.CustomerID,
      SaleDate: formatDateForMySQL(), // ✅ MySQL-friendly string
      DocumentType: TargetDocumentType,
      DocumentNumber: DocumentNumber || null,
      CurrencyID: CurrencyID || ticket.CurrencyID || 1,
      IsExenta: ticket.IsExenta ? 1 : 0,
      WarehouseID: resolvedWarehouseId,
      Notes: Notes || ticket.Notes || null,
      ShippingAddress: ShippingAddress || ticket.ShippingAddress || null,
      BillingAddress: BillingAddress || ticket.BillingAddress || null,
      Items: itemsForSale,
    };

    // Optionally: mark ticket as "Draft" / "ToBeConverted" here later using Status column.
    // For now we just return payload.

    return res.json({
      message: "Ticket converted to sale payload",
      TicketID: ticketId,
      TargetDocumentType,
      salePayload,
    });
  } catch (err) {
    console.error("Error converting ticket:", err);
    return res.status(500).json({ error: "Failed to convert ticket" });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * POST /api/sales/tickets/:id/mark-billed
 * Body: { "FinalSaleID": 123 }  // optional for future linking
 *
 * Marks the ticket (stored as COTIZACION) as billed so it no longer appears
 * in the pending tickets list.
 */
router.post("/tickets/:id/mark-billed", async (req, res) => {
  const companyId = req.user.CompanyID;
  const ticketId = req.params.id;
  const { FinalSaleID } = req.body || {};

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Optionally: verify ticket exists and is stored as COTIZACION
    const [rows] = await conn.query(
      `SELECT SaleID, Status
         FROM Sales
        WHERE SaleID = ?
          AND CompanyID = ?
          AND DocumentType = 'COTIZACION'
        LIMIT 1`,
      [ticketId, companyId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Just mark it as billed. You could also store FinalSaleID in Notes later.
    await conn.query(
      `UPDATE Sales
          SET Status = 'TicketBilled'
        WHERE SaleID = ?
          AND CompanyID = ?
          AND DocumentType = 'COTIZACION'`,
      [ticketId, companyId]
    );

    await conn.commit();

    res.json({
      message: "Ticket marked as billed",
      TicketID: ticketId,
      FinalSaleID: FinalSaleID || null,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error marking ticket as billed:", err);
    res.status(500).json({ error: "Failed to mark ticket as billed" });
  } finally {
    if (conn) conn.release();
  }
});

// ===================================================================
// 4) DELETE/CANCEL TICKET
// DELETE /api/sales/tickets/:id
// ===================================================================
router.delete("/tickets/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE Sales
         SET Status = 'TicketCancelled', UpdatedAt = NOW()
       WHERE SaleID = ?
         AND CompanyID = ?
         AND DocumentType = 'COTIZACION'
         AND Status = 'Draft'`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Ticket not found, already cancelled, or not in draft status",
      });
    }

    res.json({ message: "Ticket cancelled" });
  } catch (err) {
    console.error("Error cancelling ticket:", err);
    res.status(500).json({ error: "Failed to cancel ticket" });
  }
});

module.exports = router;
