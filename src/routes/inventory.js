const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/inventory/levels
// optional query: productId, warehouseId, includeZero=1
router.get("/levels", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { productId, warehouseId, includeZero } = req.query;

  try {
    let sql = `
      SELECT
        pil.ProductInventoryLevelID,
        pil.ProductID,
        p.SKU,
        p.Barcode,
        p.ImageURL,
        p.ProductCategoryID,
        p.ProductName,
        p.IsActive,
        p.UsesLots,
        p.UsesSerials,
        pil.WarehouseID,
        w.WarehouseName,
        pil.StockQuantity,
        pil.ReservedQuantity,
        (pil.StockQuantity - pil.ReservedQuantity) AS AvailableQuantity,
        pil.MinStockLevel,
        pil.MaxStockLevel,
        pil.LastUpdatedAt,
        pil.ProductLotID,
        pl.LotNumber,
        pl.ExpirationDate
      FROM ProductInventoryLevels pil
      INNER JOIN Products p ON pil.ProductID = p.ProductID
      INNER JOIN Warehouses w ON pil.WarehouseID = w.WarehouseID
      LEFT JOIN ProductLots pl ON pil.ProductLotID = pl.ProductLotID
      WHERE p.CompanyID = ? AND w.CompanyID = ?
    `;
    const params = [companyId, companyId];

    if (productId) {
      sql += " AND pil.ProductID = ?";
      params.push(productId);
    }

    if (warehouseId) {
      sql += " AND pil.WarehouseID = ?";
      params.push(warehouseId);
    }

    if (!includeZero) {
      sql += " AND pil.StockQuantity <> 0";
    }

    sql += " ORDER BY p.ProductName, w.WarehouseName";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching inventory levels:", err);
    res.status(500).json({ error: "Failed to fetch inventory levels" });
  }
});

// POST /api/inventory/levels/bulk-save
// Body: { entries: [{ ProductID, WarehouseID, StockQuantity, MinStockLevel, MaxStockLevel, ProductLotID? }] }
router.post("/levels/bulk-save", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];

  if (entries.length === 0) {
    return res.status(400).json({ error: "No entries provided" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    let updated = 0;

    for (const entry of entries) {
      const {
        ProductID,
        WarehouseID,
        StockQuantity,
        MinStockLevel,
        MaxStockLevel,
        ProductLotID = null,
      } = entry || {};

      if (!ProductID || !WarehouseID) {
        continue;
      }

      // Ensure product/warehouse belong to the same company
      const [validRows] = await conn.query(
        `SELECT p.ProductID, w.WarehouseID
         FROM Products p
         INNER JOIN Warehouses w ON w.WarehouseID = ?
         WHERE p.ProductID = ? AND p.CompanyID = ? AND w.CompanyID = ?`,
        [WarehouseID, ProductID, companyId, companyId]
      );

      if (validRows.length === 0) {
        continue;
      }

      const [existingRows] = await conn.query(
        `SELECT ProductInventoryLevelID, StockQuantity
         FROM ProductInventoryLevels
         WHERE ProductID = ? AND WarehouseID = ? AND
               ((ProductLotID IS NULL AND ? IS NULL) OR ProductLotID = ?)
         FOR UPDATE`,
        [ProductID, WarehouseID, ProductLotID, ProductLotID]
      );

      const payload = {
        StockQuantity:
          StockQuantity === null || StockQuantity === "" || Number.isNaN(StockQuantity)
            ? 0
            : Number(StockQuantity),
        MinStockLevel:
          MinStockLevel === null || MinStockLevel === "" || Number.isNaN(MinStockLevel)
            ? null
            : Number(MinStockLevel),
        MaxStockLevel:
          MaxStockLevel === null || MaxStockLevel === "" || Number.isNaN(MaxStockLevel)
            ? null
            : Number(MaxStockLevel),
      };

      let pilId;

      let quantityDelta = payload.StockQuantity;

      if (existingRows.length === 0) {
        const [insertResult] = await conn.query(
          `INSERT INTO ProductInventoryLevels
            (ProductID, WarehouseID, StockQuantity, ReservedQuantity,
             MinStockLevel, MaxStockLevel, LastUpdatedAt, ProductLotID)
           VALUES (?, ?, ?, 0, ?, ?, NOW(), ?)`,
          [
            ProductID,
            WarehouseID,
            payload.StockQuantity,
            payload.MinStockLevel,
            payload.MaxStockLevel,
            ProductLotID,
          ]
        );
        pilId = insertResult.insertId;
      } else {
        const currentStock = Number(existingRows[0].StockQuantity || 0);
        pilId = existingRows[0].ProductInventoryLevelID;
        quantityDelta = payload.StockQuantity - currentStock;
        await conn.query(
          `UPDATE ProductInventoryLevels
           SET StockQuantity = ?, MinStockLevel = ?, MaxStockLevel = ?, LastUpdatedAt = NOW()
           WHERE ProductInventoryLevelID = ?`,
          [
            payload.StockQuantity,
            payload.MinStockLevel,
            payload.MaxStockLevel,
            pilId,
          ]
        );
      }

      if (ProductLotID) {
        await conn.query(
          `INSERT INTO ProductLotInventory (ProductLotID, WarehouseID, Quantity)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE Quantity = VALUES(Quantity)`,
          [ProductLotID, WarehouseID, payload.StockQuantity]
        );
      }

      // Record a simple inventory transaction for audit
      if (quantityDelta !== 0) {
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
            "ManualAdjustment",
            quantityDelta,
            "InventoryBulkSave",
            pilId,
            ProductLotID || null,
            null,
            "Bulk inventory save",
            employeeId || null,
          ]
        );
      }

      updated += 1;
    }

    await conn.commit();
    res.json({ updated });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error bulk-saving inventory:", err);
    res.status(500).json({ error: "Failed to save inventory" });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/inventory/adjust
// Body:
// {
//   "ProductID": 1,
//   "WarehouseID": 1,
//   "QuantityChange": 10,   // +10 or -10
//   "Reason": "Opening stock",
//   "ProductLotID": null
// }
router.post("/adjust", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;
  const body = req.body || {};

  const { ProductID, WarehouseID, QuantityChange, Reason, ProductLotID } = body;

  if (!ProductID || !WarehouseID || !QuantityChange) {
    return res.status(400).json({
      error: "ProductID, WarehouseID and QuantityChange are required",
    });
  }

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Ensure inventory level row exists
    const [existingRows] = await conn.query(
      `SELECT
         ProductInventoryLevelID,
         StockQuantity,
         ReservedQuantity
       FROM ProductInventoryLevels
       WHERE ProductID = ? AND WarehouseID = ? AND
             ((ProductLotID IS NULL AND ? IS NULL) OR ProductLotID = ?) 
       FOR UPDATE`,
      [ProductID, WarehouseID, ProductLotID || null, ProductLotID || null]
    );

    let pilId;
    let newStockQuantity;

    if (existingRows.length === 0) {
      // create new row
      const [insertResult] = await conn.query(
        `INSERT INTO ProductInventoryLevels
          (ProductID, WarehouseID, StockQuantity, ReservedQuantity,
           MinStockLevel, MaxStockLevel, LastUpdatedAt, ProductLotID)
         VALUES (?, ?, ?, 0, NULL, NULL, NOW(), ?)`,
        [ProductID, WarehouseID, QuantityChange, ProductLotID || null]
      );
      pilId = insertResult.insertId;
      newStockQuantity = QuantityChange;
    } else {
      const current = existingRows[0];
      newStockQuantity = Number(current.StockQuantity) + Number(QuantityChange);

      await conn.query(
        `UPDATE ProductInventoryLevels
         SET StockQuantity = ?, LastUpdatedAt = NOW()
         WHERE ProductInventoryLevelID = ?`,
        [newStockQuantity, current.ProductInventoryLevelID]
      );

      pilId = current.ProductInventoryLevelID;
    }

    if (ProductLotID) {
      await conn.query(
        `INSERT INTO ProductLotInventory (ProductLotID, WarehouseID, Quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE Quantity = Quantity + VALUES(Quantity)`,
        [ProductLotID, WarehouseID, QuantityChange]
      );
    }

    // Insert inventory transaction
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
        "ManualAdjustment",
        QuantityChange,
        "InventoryAdjustment",
        pilId,
        ProductLotID || null,
        null,
        Reason || null,
        employeeId || null,
      ]
    );

    await conn.commit();

    // Return updated level
    const [resultRows] = await conn.query(
      `SELECT
         pil.ProductInventoryLevelID,
         pil.ProductID,
         p.ProductName,
         pil.WarehouseID,
         w.WarehouseName,
         pil.StockQuantity,
         pil.ReservedQuantity,
         (pil.StockQuantity - pil.ReservedQuantity) AS AvailableQuantity,
         pil.MinStockLevel,
         pil.MaxStockLevel,
         pil.LastUpdatedAt,
         pil.ProductLotID
       FROM ProductInventoryLevels pil
       INNER JOIN Products p ON pil.ProductID = p.ProductID
       INNER JOIN Warehouses w ON pil.WarehouseID = w.WarehouseID
       WHERE pil.ProductInventoryLevelID = ?`,
      [pilId]
    );

    res.status(201).json(resultRows[0]);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error adjusting inventory:", err);
    res.status(500).json({ error: "Failed to adjust inventory" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
