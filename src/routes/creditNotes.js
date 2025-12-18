const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Utility: interpret AR and Inventory signs
function getInventorySign(documentType, generatedFromGuiaID) {
  if (documentType === "GUIA_DESPACHO") return -1;
  if (documentType === "FACTURA" && generatedFromGuiaID) return 0;
  if (["FACTURA", "BOLETA", "ND"].includes(documentType)) return -1;
  if (documentType === "NOTA_CREDITO") return +1;
  return 0;
}

function getARSign(documentType) {
  if (["FACTURA", "BOLETA", "ND"].includes(documentType)) return +1;
  if (documentType === "NOTA_CREDITO") return -1;
  if (documentType === "GUIA_DESPACHO") return 0;
  return 0;
}

/**
 * -----------------------------------------
 *  POST /api/sales/credit-note
 * -----------------------------------------
 *  Creates a Nota de Crédito (NOTA_CREDITO)
 */
router.post("/credit-note", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  console.log("NC BODY:", req.body);
  const body = req.body || {};

  const {
    OriginalSaleID,
    WarehouseID,
    DocumentNumber,
    NCType, // not stored yet, reserved for future use
    ReturnReason, // not stored yet, reserved for future use
    Notes,
    Items,
  } = body;

  if (!OriginalSaleID)
    return res.status(400).json({ error: "OriginalSaleID is required." });

  if (!WarehouseID)
    return res.status(400).json({ error: "WarehouseID is required." });

  if (!Items || !Array.isArray(Items) || Items.length === 0)
    return res.status(400).json({ error: "At least 1 item is required." });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Load original sale
    const [[originalSale]] = await conn.query(
      `SELECT * FROM Sales WHERE SaleID = ? AND CompanyID = ? LIMIT 1`,
      [OriginalSaleID, companyId]
    );

    if (!originalSale)
      throw new Error("Original sale not found for this company.");

    if (!["FACTURA", "BOLETA"].includes(originalSale.DocumentType)) {
      throw new Error(
        "Credit note can only reference FACTURA or BOLETA (not Guia Despacho, NOTA_CREDITO, ND, etc)."
      );
    }

    const customerId = originalSale.CustomerID;
    const isExenta = originalSale.IsExenta || 0;

    // 2. Validate each returned item
    for (const item of Items) {
      const { ProductID, Quantity } = item;

      if (!ProductID || !Quantity)
        throw new Error("Each item must include ProductID and Quantity.");

      // original sold qty
      const [[sold]] = await conn.query(
        `SELECT SUM(Quantity) AS QtySold
         FROM SalesItems
         WHERE SaleID = ? AND ProductID = ?`,
        [OriginalSaleID, ProductID]
      );

      if (!sold || !sold.QtySold) {
        throw new Error(
          `ProductID ${ProductID} was not sold in the original sale.`
        );
      }

      // qty returned so far via previous NOTA_CREDITO
      const [[returned]] = await conn.query(
        `SELECT SUM(si.Quantity) AS QtyReturned
         FROM SalesItems si
         JOIN Sales s ON s.SaleID = si.SaleID
         WHERE s.OriginalSaleID = ? 
           AND si.ProductID = ? 
           AND s.DocumentType = 'NOTA_CREDITO'`,
        [OriginalSaleID, ProductID]
      );

      const qtyReturnedSoFar = returned?.QtyReturned || 0;
      const remaining = sold.QtySold - qtyReturnedSoFar;

      if (Quantity > remaining) {
        throw new Error(
          `Return quantity (${Quantity}) exceeds remaining quantity (${remaining}) for ProductID ${ProductID}.`
        );
      }
    }

    // 3. Calculate totals (for info; DB will compute FinalAmount/SubTotal)
    let totalAmount = 0;

    Items.forEach((item) => {
      totalAmount += Number(item.Quantity) * Number(item.UnitPrice);
    });

    // 4. Insert NOTA_CREDITO into Sales table
    // Do NOT insert into generated columns (SubTotal, FinalAmount)
    const [ncRes] = await conn.query(
      `INSERT INTO Sales (
        CompanyID, CustomerID, EmployeeID, SaleDate,
        DocumentType, DocumentNumber, IsExenta,
        OriginalSaleID, GeneratedFromGuiaID,
        TotalAmount, DiscountAmountTotal, TaxAmountTotal,
        AmountPaid, PaymentStatus, CurrencyID, Status,
        Notes, ShippingAddress, BillingAddress, MarketplaceOrderID_External
      ) VALUES (
        ?, ?, ?, NOW(),
        'NOTA_CREDITO', ?, ?,
        ?, NULL,
        ?, 0, 0,
        0, 'Unpaid', 1, 'Completed',
        ?, NULL, NULL, NULL
      )`,
      [
        companyId,
        customerId,
        employeeId,
        DocumentNumber || null,
        isExenta,
        OriginalSaleID,
        totalAmount, // TotalAmount
        Notes || null,
      ]
    );

    const newNCID = ncRes.insertId;

    // 5. Insert NC items + Inventory + Inventory Transactions
    for (const item of Items) {
      const { ProductID, Quantity, UnitPrice, Notes: ItemNotes, ProductLotID } = item;

      // Insert into SalesItems (quantities & prices positive)
      await conn.query(
        `INSERT INTO SalesItems (
          SaleID, ProductID, Description,
          Quantity, UnitPrice,
          DiscountPercentage, DiscountAmountItem,
          TaxRatePercentage, TaxAmountItem,
          IsLineExenta, ProductLotID, ProductSerialID
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, NULL)`,
        [newNCID, ProductID, ItemNotes || null, Quantity, UnitPrice, ProductLotID || null]
      );

      const lotId = ProductLotID || null;
      const [invRows] = await conn.query(
        `SELECT ProductInventoryLevelID
         FROM ProductInventoryLevels
         WHERE ProductID = ? AND WarehouseID = ? AND
               ((ProductLotID IS NULL AND ? IS NULL) OR ProductLotID = ?)
         LIMIT 1`,
        [ProductID, WarehouseID, lotId, lotId]
      );

      let pilId;
      if (invRows.length === 0) {
        const [insertLevel] = await conn.query(
          `INSERT INTO ProductInventoryLevels (
             ProductID, WarehouseID, StockQuantity, ReservedQuantity,
             MinStockLevel, MaxStockLevel, ProductLotID
           ) VALUES (?, ?, 0, 0, NULL, NULL, ?)`,
          [ProductID, WarehouseID, lotId]
        );
        pilId = insertLevel.insertId;
      } else {
        pilId = invRows[0].ProductInventoryLevelID;
      }

      await conn.query(
        `UPDATE ProductInventoryLevels
         SET StockQuantity = StockQuantity + ?, LastUpdatedAt = NOW()
         WHERE ProductInventoryLevelID = ?`,
        [Quantity, pilId]
      );

      if (lotId) {
        await conn.query(
          `INSERT INTO ProductLotInventory (ProductLotID, WarehouseID, Quantity)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE Quantity = Quantity + VALUES(Quantity)`,
          [lotId, WarehouseID, Quantity]
        );
      }

      // Log Inventory Transaction
      await conn.query(
        `INSERT INTO InventoryTransactions (
          CompanyID, ProductID, WarehouseID,
          TransactionType, QuantityChange,
          TransactionDate, ReferenceDocumentType, ReferenceDocumentID,
          ProductLotID, ProductSerialID, Notes
        )
        VALUES (?, ?, ?, 'CreditNote', ?, NOW(), 'NOTA_CREDITO', ?, ?, NULL, ?)`,
        [
          companyId,
          ProductID,
          WarehouseID,
          Quantity,
          newNCID,
          lotId,
          "NOTA_CREDITO creada",
        ]
      );
    }

    await conn.commit();

    res.json({
      message: "Credit Note created successfully",
      CreditNoteID: newNCID,
      OriginalSaleID,
      FinalAmount: totalAmount,
      InventoryUpdated: true,
      ARUpdated: true,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating NC:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * -----------------------------------------
 *  GET /api/sales/credit-note/:ncId
 * -----------------------------------------
 */
router.get("/credit-note/:ncId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const ncId = req.params.ncId;

  try {
    const [[header]] = await pool.query(
      `SELECT * 
       FROM Sales 
       WHERE SaleID = ? AND CompanyID = ? AND DocumentType = 'NOTA_CREDITO'`,
      [ncId, companyId]
    );

    if (!header)
      return res.status(404).json({ error: "Credit Note not found" });

    const [items] = await pool.query(
      `SELECT si.*, p.ProductName
       FROM SalesItems si
       LEFT JOIN Products p ON p.ProductID = si.ProductID
       WHERE si.SaleID = ?`,
      [ncId]
    );

    res.json({ header, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * -----------------------------------------
 *  GET /api/sales/:saleId/credit-notes
 * -----------------------------------------
 */
router.get("/:saleId/credit-notes", async (req, res) => {
  const companyId = req.user.CompanyID;
  const saleId = req.params.saleId;

  try {
    const [rows] = await pool.query(
      `SELECT 
          SaleID AS CreditNoteID, 
          DocumentNumber, 
          FinalAmount, 
          Notes, 
          CreatedAt
       FROM Sales
       WHERE CompanyID = ? 
         AND OriginalSaleID = ? 
         AND DocumentType = 'NOTA_CREDITO'
       ORDER BY SaleID DESC`,
      [companyId, saleId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
