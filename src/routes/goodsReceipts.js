const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/goods-receipts -> list GRNs for company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT
         gr.GoodsReceiptID,
         gr.CompanyID,
         gr.PurchaseOrderID,
         gr.SupplierID,
         s.SupplierName,
         gr.ReceiptDate,
         gr.ReceiptNumber,
         gr.SupplierGuiaDespachoNumber,
         gr.Notes,
         gr.ReceivedByEmployeeID,
         po.PurchaseOrderNumber
       FROM GoodsReceipts gr
       LEFT JOIN Suppliers s ON gr.SupplierID = s.SupplierID
       LEFT JOIN PurchaseOrders po ON gr.PurchaseOrderID = po.PurchaseOrderID
       WHERE gr.CompanyID = ?
       ORDER BY gr.ReceiptDate DESC, gr.GoodsReceiptID DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching goods receipts:", err);
    res.status(500).json({ error: "Failed to fetch goods receipts" });
  }
});

// GET /api/goods-receipts/:id -> header + items
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [headerRows] = await pool.query(
      `SELECT
         gr.GoodsReceiptID,
         gr.CompanyID,
         gr.PurchaseOrderID,
         po.PurchaseOrderNumber,
         gr.SupplierID,
         s.SupplierName,
         gr.ReceiptDate,
         gr.ReceiptNumber,
         gr.SupplierGuiaDespachoNumber,
         gr.Notes,
         gr.ReceivedByEmployeeID
       FROM GoodsReceipts gr
       LEFT JOIN Suppliers s ON gr.SupplierID = s.SupplierID
       LEFT JOIN PurchaseOrders po ON gr.PurchaseOrderID = po.PurchaseOrderID
       WHERE gr.GoodsReceiptID = ? AND gr.CompanyID = ?`,
      [id, companyId]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ error: "Goods receipt not found" });
    }

    const header = headerRows[0];

    const [items] = await pool.query(
      `SELECT
         gri.GoodsReceiptItemID,
         gri.GoodsReceiptID,
         gri.PurchaseOrderItemID,
         gri.ProductID,
         p.ProductName,
         gri.QuantityReceived,
         gri.UnitPrice,
         gri.ProductLotID,
         gri.ProductSerialID,
         gri.Notes,
         poi.Quantity AS OrderedQuantity,
         poi.ReceivedQuantity AS PurchaseOrderReceivedQuantity
       FROM GoodsReceiptItems gri
       LEFT JOIN Products p ON gri.ProductID = p.ProductID
       LEFT JOIN PurchaseOrderItems poi ON gri.PurchaseOrderItemID = poi.PurchaseOrderItemID
       WHERE gri.GoodsReceiptID = ?`,
      [id]
    );

    res.json({ header, items });
  } catch (err) {
    console.error("Error fetching goods receipt details:", err);
    res.status(500).json({ error: "Failed to fetch goods receipt details" });
  }
});

// POST /api/goods-receipts -> create GRN + stock IN + update PO
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  const body = req.body || {};

  // 👇 make it super explicit & forgiving on casing
  const SupplierID = body.SupplierID ?? body.supplierId ?? body.SupplierId;
  const PurchaseOrderID = body.PurchaseOrderID ?? body.purchaseOrderId;
  const ReceiptDate = body.ReceiptDate ?? body.receiptDate;
  const ReceiptNumber = body.ReceiptNumber ?? body.receiptNumber;
  const SupplierGuiaDespachoNumber =
    body.SupplierGuiaDespachoNumber ?? body.supplierGuiaDespachoNumber;
  const Notes = body.Notes ?? body.notes;
  const WarehouseID = body.WarehouseID ?? body.warehouseId;
  const Items = body.Items ?? body.items;

  // OPTIONAL: while debugging, you can log body:
  console.log("GRN BODY:", body);

  if (SupplierID == null || !String(ReceiptNumber || "").trim()) {
    return res.status(400).json({
      error: "SupplierID and ReceiptNumber are required",
      debug: { SupplierID, ReceiptNumber }, // (you can remove this later)
    });
  }

  if (!WarehouseID) {
    return res.status(400).json({
      error: "WarehouseID is required to receive inventory",
    });
  }

  if (!Array.isArray(Items) || Items.length === 0) {
    return res.status(400).json({
      error: "At least one item is required for a goods receipt",
    });
  }

  if (!WarehouseID) {
    return res.status(400).json({
      error: "WarehouseID is required to receive inventory",
    });
  }

  if (!Array.isArray(Items) || Items.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one item is required for a goods receipt" });
  }

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Insert GoodsReceipts header
    const [grResult] = await conn.query(
      `INSERT INTO GoodsReceipts
        (CompanyID, PurchaseOrderID, SupplierID,
         ReceiptDate, ReceiptNumber, SupplierGuiaDespachoNumber,
         Notes, ReceivedByEmployeeID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        PurchaseOrderID || null,
        SupplierID,
        ReceiptDate || new Date(),
        ReceiptNumber,
        SupplierGuiaDespachoNumber || null,
        Notes || null,
        employeeId || null,
      ]
    );

    const goodsReceiptId = grResult.insertId;

    // 2) For each item: insert GoodsReceiptItems + stock IN + PO received qty
    for (const item of Items) {
      const QuantityReceived = Number(item.QuantityReceived || 0);
      const UnitPrice = item.UnitPrice != null ? Number(item.UnitPrice) : null;
      const ProductID = item.ProductID;
      const PurchaseOrderItemID = item.PurchaseOrderItemID || null;
      const ProductLotID = item.ProductLotID || null;
      const ProductSerialID = item.ProductSerialID || null;
      const itemNotes = item.Notes || null;

      if (!ProductID || QuantityReceived <= 0) {
        throw new Error(
          "Each item must have ProductID and positive QuantityReceived"
        );
      }

      // 2a) Insert GoodsReceiptItem
      const [griResult] = await conn.query(
        `INSERT INTO GoodsReceiptItems
          (GoodsReceiptID, PurchaseOrderItemID, ProductID,
           QuantityReceived, UnitPrice, ProductLotID, ProductSerialID, Notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          goodsReceiptId,
          PurchaseOrderItemID,
          ProductID,
          QuantityReceived,
          UnitPrice,
          ProductLotID,
          ProductSerialID,
          itemNotes,
        ]
      );

      // 2b) Inventory IN (ProductInventoryLevels + InventoryTransactions)
      // Lock or create inventory level row
      const [existingRows] = await conn.query(
        `SELECT
           ProductInventoryLevelID,
           StockQuantity,
           ReservedQuantity
         FROM ProductInventoryLevels
         WHERE ProductID = ? AND WarehouseID = ?
           AND ((ProductLotID IS NULL AND ? IS NULL) OR ProductLotID = ?)
         FOR UPDATE`,
        [ProductID, WarehouseID, ProductLotID, ProductLotID]
      );

      let pilId;
      let newStockQuantity;

      if (existingRows.length === 0) {
        // create new level
        const [insertLevel] = await conn.query(
          `INSERT INTO ProductInventoryLevels
            (ProductID, WarehouseID, StockQuantity, ReservedQuantity,
             MinStockLevel, MaxStockLevel, LastUpdatedAt, ProductLotID)
           VALUES (?, ?, ?, 0, NULL, NULL, NOW(), ?)`,
          [ProductID, WarehouseID, QuantityReceived, ProductLotID]
        );
        pilId = insertLevel.insertId;
        newStockQuantity = QuantityReceived;
      } else {
        const current = existingRows[0];
        newStockQuantity =
          Number(current.StockQuantity) + Number(QuantityReceived);

        await conn.query(
          `UPDATE ProductInventoryLevels
           SET StockQuantity = ?, LastUpdatedAt = NOW()
           WHERE ProductInventoryLevelID = ?`,
          [newStockQuantity, current.ProductInventoryLevelID]
        );

        pilId = current.ProductInventoryLevelID;
      }

      // Insert InventoryTransactions row (PurchaseReceived)
      await conn.query(
        `INSERT INTO InventoryTransactions
          (CompanyID, ProductID, WarehouseID,
           TransactionType, QuantityChange,
           TransactionDate, ReferenceDocumentType, ReferenceDocumentID,
           ProductLotID, ProductSerialID,
           Notes, EmployeeID)
         VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          ProductID,
          WarehouseID,
          "PurchaseReceived", // TransactionType
          QuantityReceived,
          "GoodsReceipt", // ReferenceDocumentType
          goodsReceiptId, // ReferenceDocumentID
          ProductLotID,
          ProductSerialID,
          itemNotes,
          employeeId || null,
        ]
      );

      // 2c) Update PurchaseOrderItems.ReceivedQuantity (if linked)
      if (PurchaseOrderItemID) {
        await conn.query(
          `UPDATE PurchaseOrderItems
           SET ReceivedQuantity = ReceivedQuantity + ?
           WHERE PurchaseOrderItemID = ?`,
          [QuantityReceived, PurchaseOrderItemID]
        );
      }
    }

    // 3) If linked to a PurchaseOrder, update its Status based on received qty
    if (PurchaseOrderID) {
      const [aggRows] = await conn.query(
        `SELECT
           SUM(Quantity) AS TotalOrdered,
           SUM(ReceivedQuantity) AS TotalReceived
         FROM PurchaseOrderItems
         WHERE PurchaseOrderID = ?`,
        [PurchaseOrderID]
      );

      if (aggRows.length > 0) {
        const totals = aggRows[0];
        const totalOrdered = Number(totals.TotalOrdered || 0);
        const totalReceived = Number(totals.TotalReceived || 0);

        let newStatus = "Submitted";

        if (totalReceived <= 0) {
          newStatus = "Submitted";
        } else if (totalReceived < totalOrdered) {
          newStatus = "PartiallyReceived";
        } else if (totalOrdered > 0 && totalReceived >= totalOrdered) {
          newStatus = "Received";
        }

        await conn.query(
          `UPDATE PurchaseOrders
           SET Status = ?
           WHERE PurchaseOrderID = ? AND CompanyID = ?`,
          [newStatus, PurchaseOrderID, companyId]
        );
      }
    }

    await conn.commit();

    // 4) Return full GRN
    const [headerRows] = await conn.query(
      `SELECT
         gr.GoodsReceiptID,
         gr.CompanyID,
         gr.PurchaseOrderID,
         po.PurchaseOrderNumber,
         gr.SupplierID,
         s.SupplierName,
         gr.ReceiptDate,
         gr.ReceiptNumber,
         gr.SupplierGuiaDespachoNumber,
         gr.Notes,
         gr.ReceivedByEmployeeID
       FROM GoodsReceipts gr
       LEFT JOIN Suppliers s ON gr.SupplierID = s.SupplierID
       LEFT JOIN PurchaseOrders po ON gr.PurchaseOrderID = po.PurchaseOrderID
       WHERE gr.GoodsReceiptID = ?`,
      [goodsReceiptId]
    );

    const [itemsRows] = await conn.query(
      `SELECT
         gri.GoodsReceiptItemID,
         gri.GoodsReceiptID,
         gri.PurchaseOrderItemID,
         gri.ProductID,
         p.ProductName,
         gri.QuantityReceived,
         gri.UnitPrice,
         gri.ProductLotID,
         gri.ProductSerialID,
         gri.Notes
       FROM GoodsReceiptItems gri
       LEFT JOIN Products p ON gri.ProductID = p.ProductID
       WHERE gri.GoodsReceiptID = ?`,
      [goodsReceiptId]
    );

    res.status(201).json({
      header: headerRows[0],
      items: itemsRows,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating goods receipt:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error:
          "ReceiptNumber already exists for this company. Please use a unique number.",
      });
    }

    res.status(500).json({ error: "Failed to create goods receipt" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
