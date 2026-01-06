const express = require("express");
const router = express.Router();
const { pool } = require("../db");

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

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

router.post("/transfer", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;
  const body = req.body || {};

  const {
    ProductID,
    FromWarehouseID,
    ToWarehouseID,
    Quantity,
    Reason,
    ProductLotID,
  } = body;

  if (!ProductID || !FromWarehouseID || !ToWarehouseID || !Quantity) {
    return res.status(400).json({
      error: "ProductID, FromWarehouseID, ToWarehouseID and Quantity are required",
    });
  }

  if (Number(FromWarehouseID) === Number(ToWarehouseID)) {
    return res.status(400).json({ error: "Source and destination warehouses must differ" });
  }

  const transferQty = Number(Quantity);
  if (!Number.isFinite(transferQty) || transferQty <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive number" });
  }

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[productRow]] = await conn.query(
      `SELECT ProductID, ProductName
       FROM Products
       WHERE ProductID = ? AND CompanyID = ?`,
      [ProductID, companyId]
    );

    if (!productRow) {
      throw createError(404, "Product not found");
    }

    const [warehouseRows] = await conn.query(
      `SELECT WarehouseID, WarehouseName
       FROM Warehouses
       WHERE CompanyID = ? AND WarehouseID IN (?, ?)` ,
      [companyId, FromWarehouseID, ToWarehouseID]
    );

    if (warehouseRows.length < 2) {
      throw createError(404, "One or more warehouses not found");
    }

    const fromWarehouse = warehouseRows.find((w) => Number(w.WarehouseID) === Number(FromWarehouseID));
    const toWarehouse = warehouseRows.find((w) => Number(w.WarehouseID) === Number(ToWarehouseID));

    if (!fromWarehouse || !toWarehouse) {
      throw createError(404, "One or more warehouses not found");
    }

    const [[sourceLevel]] = await conn.query(
      `SELECT
         ProductInventoryLevelID,
         StockQuantity,
         ReservedQuantity
       FROM ProductInventoryLevels
       WHERE ProductID = ? AND WarehouseID = ? AND
             ((ProductLotID IS NULL AND ? IS NULL) OR ProductLotID = ?)
       FOR UPDATE`,
      [ProductID, FromWarehouseID, ProductLotID || null, ProductLotID || null]
    );

    if (!sourceLevel) {
      throw createError(400, "Source warehouse has no stock for this product");
    }

    const availableQty = Number(sourceLevel.StockQuantity || 0) - Number(sourceLevel.ReservedQuantity || 0);
    if (availableQty < transferQty) {
      throw createError(400, "Insufficient available stock at source warehouse");
    }

    const updatedSourceQty = Number(sourceLevel.StockQuantity || 0) - transferQty;

    await conn.query(
      `UPDATE ProductInventoryLevels
       SET StockQuantity = ?, LastUpdatedAt = NOW()
       WHERE ProductInventoryLevelID = ?`,
      [updatedSourceQty, sourceLevel.ProductInventoryLevelID]
    );

    if (ProductLotID) {
      const [[lotSource]] = await conn.query(
        `SELECT Quantity
         FROM ProductLotInventory
         WHERE ProductLotID = ? AND WarehouseID = ?
         FOR UPDATE`,
        [ProductLotID, FromWarehouseID]
      );

      if (!lotSource || Number(lotSource.Quantity || 0) < transferQty) {
        throw createError(400, "Insufficient lot quantity at source warehouse");
      }

      const nextLotQty = Number(lotSource.Quantity || 0) - transferQty;

      await conn.query(
        `UPDATE ProductLotInventory
         SET Quantity = ?
         WHERE ProductLotID = ? AND WarehouseID = ?`,
        [nextLotQty, ProductLotID, FromWarehouseID]
      );
    }

    const [[destLevel]] = await conn.query(
      `SELECT
         ProductInventoryLevelID,
         StockQuantity
       FROM ProductInventoryLevels
       WHERE ProductID = ? AND WarehouseID = ? AND
             ((ProductLotID IS NULL AND ? IS NULL) OR ProductLotID = ?)
       FOR UPDATE`,
      [ProductID, ToWarehouseID, ProductLotID || null, ProductLotID || null]
    );

    let destinationLevelId;
    let updatedDestinationQty;

    if (!destLevel) {
      const [insertResult] = await conn.query(
        `INSERT INTO ProductInventoryLevels
          (ProductID, WarehouseID, StockQuantity, ReservedQuantity,
           MinStockLevel, MaxStockLevel, LastUpdatedAt, ProductLotID)
         VALUES (?, ?, ?, 0, NULL, NULL, NOW(), ?)` ,
        [ProductID, ToWarehouseID, transferQty, ProductLotID || null]
      );
      destinationLevelId = insertResult.insertId;
      updatedDestinationQty = transferQty;
    } else {
      updatedDestinationQty = Number(destLevel.StockQuantity || 0) + transferQty;
      await conn.query(
        `UPDATE ProductInventoryLevels
         SET StockQuantity = ?, LastUpdatedAt = NOW()
         WHERE ProductInventoryLevelID = ?`,
        [updatedDestinationQty, destLevel.ProductInventoryLevelID]
      );
      destinationLevelId = destLevel.ProductInventoryLevelID;
    }

    if (ProductLotID) {
      await conn.query(
        `INSERT INTO ProductLotInventory (ProductLotID, WarehouseID, Quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE Quantity = Quantity + VALUES(Quantity)` ,
        [ProductLotID, ToWarehouseID, transferQty]
      );
    }

    const defaultNote = `Transfer ${transferQty} ${productRow.ProductName || "units"} from ${fromWarehouse.WarehouseName} to ${toWarehouse.WarehouseName}`;
    const transferNote = Reason ? `${defaultNote} - ${Reason}` : defaultNote;

    await conn.query(
      `INSERT INTO InventoryTransactions
        (CompanyID, ProductID, WarehouseID,
         TransactionType, QuantityChange,
         TransactionDate, ReferenceDocumentType, ReferenceDocumentID,
         ProductLotID, ProductSerialID,
         Notes, EmployeeID)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)` ,
      [
        companyId,
        ProductID,
        FromWarehouseID,
        "TransferOut",
        -transferQty,
        "InventoryTransfer",
        null,
        ProductLotID || null,
        null,
        transferNote,
        employeeId || null,
      ]
    );

    await conn.query(
      `INSERT INTO InventoryTransactions
        (CompanyID, ProductID, WarehouseID,
         TransactionType, QuantityChange,
         TransactionDate, ReferenceDocumentType, ReferenceDocumentID,
         ProductLotID, ProductSerialID,
         Notes, EmployeeID)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)` ,
      [
        companyId,
        ProductID,
        ToWarehouseID,
        "TransferIn",
        transferQty,
        "InventoryTransfer",
        null,
        ProductLotID || null,
        null,
        transferNote,
        employeeId || null,
      ]
    );

    await conn.commit();

    const [updatedLevels] = await conn.query(
      `SELECT
         pil.ProductInventoryLevelID,
         pil.ProductID,
         p.ProductName,
         pil.WarehouseID,
         w.WarehouseName,
         pil.StockQuantity,
         pil.ReservedQuantity,
         (pil.StockQuantity - pil.ReservedQuantity) AS AvailableQuantity,
         pil.ProductLotID
       FROM ProductInventoryLevels pil
       INNER JOIN Products p ON pil.ProductID = p.ProductID
       INNER JOIN Warehouses w ON pil.WarehouseID = w.WarehouseID
       WHERE pil.ProductID = ? AND pil.WarehouseID IN (?, ?) AND
             ((pil.ProductLotID IS NULL AND ? IS NULL) OR pil.ProductLotID = ?)` ,
      [ProductID, FromWarehouseID, ToWarehouseID, ProductLotID || null, ProductLotID || null]
    );

    res.status(201).json({
      transfer: {
        productId: Number(ProductID),
        fromWarehouseId: Number(FromWarehouseID),
        toWarehouseId: Number(ToWarehouseID),
        quantity: transferQty,
        productLotId: ProductLotID ? Number(ProductLotID) : null,
      },
      levels: updatedLevels,
    });
  } catch (error) {
    if (conn) {
      await conn.rollback();
    }
    if (error?.status) {
      res.status(error.status).json({ error: error.message });
    } else {
      console.error("Error transferring inventory:", error);
      res.status(500).json({ error: "Failed to transfer inventory" });
    }
  } finally {
    if (conn) {
      conn.release();
    }
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
