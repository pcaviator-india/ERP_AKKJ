// routes/guiaDespacho.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Helper to get next folio from DocumentSequences
async function getNextDocumentNumber(conn, companyId, documentType) {
  // For now we assume IsElectronic = 1 (can extend later)
  const [[seq]] = await conn.query(
    `
      SELECT DocumentSequenceID, Prefix, NextNumber, Suffix, FormatString
      FROM DocumentSequences
      WHERE CompanyID = ? AND DocumentType = ? AND IsElectronic = 1 AND IsActive = 1
      FOR UPDATE
    `,
    [companyId, documentType]
  );

  if (!seq) {
    throw new Error(
      `No DocumentSequence configured for ${documentType} (CompanyID=${companyId})`
    );
  }

  const nextNumber = Number(seq.NextNumber);

  // Format the number (very simple, ignoring FormatString for now)
  let docNumberCore = nextNumber.toString();
  let fullNumber = docNumberCore;

  if (seq.Prefix) fullNumber = `${seq.Prefix}${fullNumber}`;
  if (seq.Suffix) fullNumber = `${fullNumber}${seq.Suffix}`;

  // Update sequence
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

// Very similar logic to your sales route totals
function processGuiaItems(items, isExentaHeader) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one item is required for Guía de Despacho");
  }

  let totalAmount = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const processedItems = items.map((item) => {
    const quantity = Number(item.Quantity || 0);
    const unitPrice = Number(item.UnitPrice || 0);
    const discountPerc = Number(item.DiscountPercentage || 0);
    const taxRatePerc = Number(item.TaxRatePercentage || 0);
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
      ProductID: item.ProductID,
      Description: item.Description || null,
      Quantity: quantity,
      UnitPrice: unitPrice,
      DiscountPercentage: discountPerc,
      DiscountAmountItem: discountAmountItem,
      TaxRatePercentage: taxRatePerc,
      TaxAmountItem: taxAmountItem,
      IsLineExenta: isLineExenta,
      ProductLotID: item.ProductLotID || null,
      ProductSerialID: item.ProductSerialID || null,
      LineTotal: lineTotal,
    };
  });

  return {
    processedItems,
    totalAmount,
    totalDiscount,
    totalTax,
    finalAmount: totalAmount - totalDiscount + totalTax,
  };
}

// Ensure inventory row exists + update stock, very similar to /inventory/adjust
async function applyInventoryOutForGuia(
  conn,
  companyId,
  warehouseId,
  employeeId,
  saleId,
  items
) {
  for (const item of items) {
    const { ProductID, Quantity, ProductLotID } = item;

    // For GUIA: stock OUT (negative)
    const qtyChange = -Math.abs(Number(Quantity));

    // Lock existing inventory row
    const [existingRows] = await conn.query(
      `
        SELECT
          ProductInventoryLevelID,
          StockQuantity,
          ReservedQuantity
        FROM ProductInventoryLevels
        WHERE ProductID = ?
          AND WarehouseID = ?
          AND (
            (ProductLotID IS NULL AND ? IS NULL)
            OR ProductLotID = ?
          )
        FOR UPDATE
      `,
      [ProductID, warehouseId, ProductLotID || null, ProductLotID || null]
    );

    let pilId;
    let newStockQuantity;

    if (existingRows.length === 0) {
      // No inventory row yet → create one with negative stock (allowed)
      const [insertResult] = await conn.query(
        `
          INSERT INTO ProductInventoryLevels
            (ProductID, WarehouseID, StockQuantity, ReservedQuantity,
             MinStockLevel, MaxStockLevel, LastUpdatedAt, ProductLotID)
          VALUES (?, ?, ?, 0, NULL, NULL, NOW(), ?)
        `,
        [ProductID, warehouseId, qtyChange, ProductLotID || null]
      );
      pilId = insertResult.insertId;
      newStockQuantity = qtyChange;
    } else {
      const current = existingRows[0];
      newStockQuantity = Number(current.StockQuantity) + qtyChange;

      await conn.query(
        `
          UPDATE ProductInventoryLevels
          SET StockQuantity = ?, LastUpdatedAt = NOW()
          WHERE ProductInventoryLevelID = ?
        `,
        [newStockQuantity, current.ProductInventoryLevelID]
      );

      pilId = current.ProductInventoryLevelID;
    }

    // Insert inventory transaction
    await conn.query(
      `
        INSERT INTO InventoryTransactions
          (CompanyID, ProductID, WarehouseID,
           TransactionType, QuantityChange,
           TransactionDate, ReferenceDocumentType, ReferenceDocumentID,
           ProductLotID, ProductSerialID,
           Notes, EmployeeID)
        VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        ProductID,
        warehouseId,
        "SaleShipment", // 👈 key type for GUIA
        qtyChange,
        "GUIA_DESPACHO",
        saleId,
        ProductLotID || null,
        item.ProductSerialID || null,
        "Guía de Despacho stock OUT",
        employeeId || null,
      ]
    );
  }
}

// POST /api/sales/guia-despacho
router.post("/guia-despacho", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  const body = req.body || {};
  const {
    CustomerID,
    SaleDate,
    DocumentNumber, // optional override
    CurrencyID,
    IsExenta,
    WarehouseID,
    Notes,
    ShippingAddress,
    BillingAddress,
    Items,
  } = body;

  // --- Basic validation ---
  if (!CustomerID) {
    return res.status(400).json({ error: "CustomerID is required" });
  }
  if (!Array.isArray(Items) || Items.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one item is required for Guía de Despacho" });
  }
  if (!WarehouseID) {
    return res
      .status(400)
      .json({ error: "WarehouseID is required (goods are leaving stock)" });
  }
  if (!CurrencyID) {
    return res.status(400).json({ error: "CurrencyID is required" });
  }

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const isExentaHeader = IsExenta ? 1 : 0;

    // 1) Calculate totals
    const {
      processedItems,
      totalAmount,
      totalDiscount,
      totalTax,
      finalAmount,
    } = processGuiaItems(Items, isExentaHeader);

    // 2) Generate DocumentNumber (if not provided)
    const docNumber =
      DocumentNumber ||
      (await getNextDocumentNumber(conn, companyId, "GUIA_DESPACHO"));

    // 3) Insert into Sales
    const [saleResult] = await conn.query(
      `
        INSERT INTO Sales
          (CompanyID, CustomerID, EmployeeID, SaleDate,
           DocumentType, DocumentNumber,
           IsExenta,
           OriginalSaleID, GeneratedFromGuiaID,
           TotalAmount, DiscountAmountTotal, TaxAmountTotal,
           AmountPaid, PaymentStatus, CurrencyID,
           Status, Notes, ShippingAddress, BillingAddress, WarehouseID)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL,
                ?, ?, ?,
                0, 'Unpaid', ?, 'GuiaEmitida', ?, ?, ?, ?)
      `,
      [
        companyId,
        CustomerID,
        employeeId,
        SaleDate || new Date(),
        "GUIA_DESPACHO",
        docNumber,
        isExentaHeader,
        totalAmount,
        totalDiscount,
        totalTax,
        CurrencyID,
        Notes || null,
        ShippingAddress || null,
        BillingAddress || null,
        WarehouseID,
      ]
    );

    const saleId = saleResult.insertId;

    // 4) Insert SalesItems
    for (const item of processedItems) {
      await conn.query(
        `
          INSERT INTO SalesItems
            (SaleID, ProductID, Description,
             Quantity, UnitPrice,
             DiscountPercentage, DiscountAmountItem,
             TaxRatePercentage, TaxAmountItem,
             IsLineExenta,
             ProductLotID, ProductSerialID)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          saleId,
          item.ProductID,
          item.Description,
          item.Quantity,
          item.UnitPrice,
          item.DiscountPercentage,
          item.DiscountAmountItem,
          item.TaxRatePercentage,
          item.TaxAmountItem,
          item.IsLineExenta,
          item.ProductLotID,
          item.ProductSerialID,
        ]
      );
    }

    // 5) Inventory OUT for each item
    await applyInventoryOutForGuia(
      conn,
      companyId,
      WarehouseID,
      employeeId,
      saleId,
      processedItems
    );

    await conn.commit();

    return res.status(201).json({
      message: "Guía de Despacho created successfully",
      SaleID: saleId,
      DocumentNumber: docNumber,
      TotalAmount: totalAmount,
      DiscountAmountTotal: totalDiscount,
      TaxAmountTotal: totalTax,
      FinalAmount: finalAmount,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating Guía de Despacho:", err);
    return res
      .status(500)
      .json({
        error: "Failed to create Guía de Despacho",
        details: err.message,
      });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
