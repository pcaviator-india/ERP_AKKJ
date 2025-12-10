const express = require("express");
const router = express.Router();
const { pool } = require("../db");

/**
 * -----------------------------------------
 *  POST /api/sales/debit-note
 * -----------------------------------------
 *  Creates a Nota de Débito (NOTA_DEBITO)
 *  - Increases AR (extra charge)
 *  - Decreases inventory (extra goods delivered)
 */
router.post("/debit-note", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  console.log("ND BODY:", req.body);
  const body = req.body || {};

  const {
    OriginalSaleID,
    WarehouseID,
    DocumentNumber,
    NDType,        // reserved for future use
    Reason,        // reserved for future use
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
        "Debit note can only reference FACTURA or BOLETA (not Guia Despacho, NOTA_CREDITO, ND, etc)."
      );
    }

    const customerId = originalSale.CustomerID;
    const isExenta = originalSale.IsExenta || 0;

    // 2. Basic validation for items (ND = extra charge / extra goods)
    for (const item of Items) {
      const { ProductID, Quantity, UnitPrice } = item;

      if (!ProductID || !Quantity || !UnitPrice) {
        throw new Error(
          "Each item must include ProductID, Quantity and UnitPrice."
        );
      }

      if (Number(Quantity) <= 0 || Number(UnitPrice) < 0) {
        throw new Error(
          `Invalid Quantity/UnitPrice for ProductID ${ProductID}.`
        );
      }
    }

    // 3. Calculate totals
    let totalAmount = 0;

    Items.forEach((item) => {
      totalAmount += Number(item.Quantity) * Number(item.UnitPrice);
    });

    // 4. Insert NOTA_DEBITO into Sales table
    // Do NOT insert into generated columns (SubTotal, FinalAmount)
    const [ndRes] = await conn.query(
      `INSERT INTO Sales (
        CompanyID, CustomerID, EmployeeID, SaleDate,
        DocumentType, DocumentNumber, IsExenta,
        OriginalSaleID, GeneratedFromGuiaID,
        TotalAmount, DiscountAmountTotal, TaxAmountTotal,
        AmountPaid, PaymentStatus, CurrencyID, Status,
        Notes, ShippingAddress, BillingAddress, MarketplaceOrderID_External
      ) VALUES (
        ?, ?, ?, NOW(),
        'NOTA_DEBITO', ?, ?,
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
        totalAmount,          // TotalAmount
        Notes || null
      ]
    );

    const newNDID = ndRes.insertId;

    // 5. Insert ND items + Inventory decrease + Inventory Transactions
    for (const item of Items) {
      const { ProductID, Quantity, UnitPrice, Notes: ItemNotes } = item;

      // Insert into SalesItems
      await conn.query(
        `INSERT INTO SalesItems (
          SaleID, ProductID, Description,
          Quantity, UnitPrice,
          DiscountPercentage, DiscountAmountItem,
          TaxRatePercentage, TaxAmountItem,
          IsLineExenta, ProductLotID, ProductSerialID
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, NULL, NULL)`,
        [newNDID, ProductID, ItemNotes || null, Quantity, UnitPrice]
      );

      // Ensure inventory level row exists (safety)
      const [invRows] = await conn.query(
        `SELECT ProductInventoryLevelID 
         FROM ProductInventoryLevels
         WHERE ProductID = ? AND WarehouseID = ?
         LIMIT 1`,
        [ProductID, WarehouseID]
      );

      if (invRows.length === 0) {
        await conn.query(
          `INSERT INTO ProductInventoryLevels (
             ProductID, WarehouseID, StockQuantity, ReservedQuantity,
             MinStockLevel, MaxStockLevel, ProductLotID
           ) VALUES (?, ?, 0, 0, NULL, NULL, NULL)`,
          [ProductID, WarehouseID]
        );
      }

      // Inventory decrease for NOTA_DEBITO (extra goods out)
      await conn.query(
        `UPDATE ProductInventoryLevels
         SET StockQuantity = StockQuantity - ?, LastUpdatedAt = NOW()
         WHERE ProductID = ? AND WarehouseID = ?`,
        [Quantity, ProductID, WarehouseID]
      );

      // Log Inventory Transaction
      await conn.query(
        `INSERT INTO InventoryTransactions (
          CompanyID, ProductID, WarehouseID,
          TransactionType, QuantityChange,
          TransactionDate, ReferenceDocumentType, ReferenceDocumentID,
          ProductLotID, ProductSerialID, Notes
        )
        VALUES (?, ?, ?, 'DebitNote', ?, NOW(), 'NOTA_DEBITO', ?, NULL, NULL, ?)`,
        [companyId, ProductID, WarehouseID, -Quantity, newNDID, "NOTA_DEBITO creada"]
      );
    }

    await conn.commit();

    res.json({
      message: "Debit Note created successfully",
      DebitNoteID: newNDID,
      OriginalSaleID,
      FinalAmount: totalAmount,
      InventoryUpdated: true,
      ARUpdated: true
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating ND:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * -----------------------------------------
 *  GET /api/sales/debit-note/:ndId
 * -----------------------------------------
 */
router.get("/debit-note/:ndId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const ndId = req.params.ndId;

  try {
    const [[header]] = await pool.query(
      `SELECT * 
       FROM Sales 
       WHERE SaleID = ? AND CompanyID = ? AND DocumentType = 'NOTA_DEBITO'`,
      [ndId, companyId]
    );

    if (!header)
      return res.status(404).json({ error: "Debit Note not found" });

    const [items] = await pool.query(
      `SELECT si.*, p.ProductName
       FROM SalesItems si
       LEFT JOIN Products p ON p.ProductID = si.ProductID
       WHERE si.SaleID = ?`,
      [ndId]
    );

    res.json({ header, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * -----------------------------------------
 *  GET /api/sales/:saleId/debit-notes
 * -----------------------------------------
 */
router.get("/:saleId/debit-notes", async (req, res) => {
  const companyId = req.user.CompanyID;
  const saleId = req.params.saleId;

  try {
    const [rows] = await pool.query(
      `SELECT 
          SaleID AS DebitNoteID, 
          DocumentNumber, 
          FinalAmount, 
          Notes, 
          CreatedAt
       FROM Sales
       WHERE CompanyID = ? 
         AND OriginalSaleID = ? 
         AND DocumentType = 'NOTA_DEBITO'
       ORDER BY SaleID DESC`,
      [companyId, saleId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
