const express = require("express");
const router = express.Router();
const { pool } = require("../db");

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

// GET /api/product-lots?productId=&warehouseId=&includeZero=1
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { productId, warehouseId, includeZero } = req.query;

  try {
    const params = [];
    let joinInventory = "LEFT JOIN ProductLotInventory pli ON pl.ProductLotID = pli.ProductLotID";
    let selectQuantity = "IFNULL(SUM(pli.Quantity), 0) AS Quantity";
    let groupBy = "GROUP BY pl.ProductLotID";
    let whereClause = "WHERE pl.CompanyID = ?";

    if (warehouseId) {
      joinInventory =
        "LEFT JOIN ProductLotInventory pli ON pl.ProductLotID = pli.ProductLotID AND pli.WarehouseID = ?";
      selectQuantity = "IFNULL(pli.Quantity, 0) AS Quantity";
      groupBy = "";
    }

    if (warehouseId) {
      params.push(warehouseId);
    }
    params.push(companyId);

    if (productId) {
      whereClause += " AND pl.ProductID = ?";
      params.push(productId);
    }

    let havingClause = "";
    if (!includeZero) {
      if (warehouseId) {
        whereClause += " AND IFNULL(pli.Quantity, 0) <> 0";
      } else {
        havingClause = "HAVING IFNULL(SUM(pli.Quantity), 0) <> 0";
      }
    }

    const [rows] = await pool.query(
      `SELECT
         pl.ProductLotID,
         pl.ProductID,
         pl.LotNumber,
         pl.ExpirationDate,
         pl.CreatedAt,
         ${warehouseId ? "pli.WarehouseID," : "NULL AS WarehouseID,"}
         ${warehouseId ? "w.WarehouseName," : "NULL AS WarehouseName,"}
         ${selectQuantity}
       FROM ProductLots pl
       ${joinInventory}
       LEFT JOIN Warehouses w ON w.WarehouseID = pli.WarehouseID
       ${whereClause}
       ${groupBy}
       ${havingClause}
       ORDER BY
         CASE WHEN pl.ExpirationDate IS NULL THEN 1 ELSE 0 END,
         pl.ExpirationDate ASC,
         pl.CreatedAt ASC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching product lots:", err);
    res.status(500).json({ error: "Failed to fetch product lots" });
  }
});

// GET /api/product-lots/fefo?productId=&warehouseId=
router.get("/fefo", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { productId, warehouseId } = req.query;

  if (!productId || !warehouseId) {
    return res.status(400).json({ error: "productId and warehouseId are required" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         pl.ProductLotID,
         pl.ProductID,
         pl.LotNumber,
         pl.ExpirationDate,
         pli.WarehouseID,
         pli.Quantity
       FROM ProductLots pl
       INNER JOIN ProductLotInventory pli ON pl.ProductLotID = pli.ProductLotID
       WHERE pl.CompanyID = ?
         AND pl.ProductID = ?
         AND pli.WarehouseID = ?
         AND pli.Quantity > 0
       ORDER BY
         CASE WHEN pl.ExpirationDate IS NULL THEN 1 ELSE 0 END,
         pl.ExpirationDate ASC,
         pl.CreatedAt ASC
       LIMIT 1`,
      [companyId, productId, warehouseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No available lot for this product" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching FEFO lot:", err);
    res.status(500).json({ error: "Failed to fetch FEFO lot" });
  }
});

// POST /api/product-lots
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID || null;
  const { ProductID, WarehouseID, LotNumber, ExpirationDate, Quantity } = req.body || {};

  if (!ProductID || !WarehouseID || !LotNumber) {
    return res
      .status(400)
      .json({ error: "ProductID, WarehouseID and LotNumber are required" });
  }

  const normalizedQty = Number.isFinite(Number(Quantity)) ? Number(Quantity) : 0;
  const normalizedDate = normalizeDate(ExpirationDate);

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [prodRows] = await conn.query(
      `SELECT ProductID, UsesLots FROM Products WHERE ProductID = ? AND CompanyID = ?`,
      [ProductID, companyId]
    );
    if (prodRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Product not found" });
    }
    if (!prodRows[0].UsesLots) {
      await conn.rollback();
      return res.status(400).json({ error: "Product does not use lots" });
    }

    const [whRows] = await conn.query(
      `SELECT WarehouseID FROM Warehouses WHERE WarehouseID = ? AND CompanyID = ?`,
      [WarehouseID, companyId]
    );
    if (whRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Warehouse not found" });
    }

    const [existingLot] = await conn.query(
      `SELECT ProductLotID FROM ProductLots
       WHERE CompanyID = ? AND ProductID = ? AND LotNumber = ?
       FOR UPDATE`,
      [companyId, ProductID, LotNumber]
    );

    let lotId;
    if (existingLot.length) {
      lotId = existingLot[0].ProductLotID;
      if (normalizedDate) {
        await conn.query(
          `UPDATE ProductLots SET ExpirationDate = ? WHERE ProductLotID = ?`,
          [normalizedDate, lotId]
        );
      }
    } else {
      const [insertLot] = await conn.query(
        `INSERT INTO ProductLots (CompanyID, ProductID, LotNumber, ExpirationDate, CreatedAt)
         VALUES (?, ?, ?, ?, NOW())`,
        [companyId, ProductID, LotNumber, normalizedDate]
      );
      lotId = insertLot.insertId;
    }

    await conn.query(
      `INSERT INTO ProductLotInventory (ProductLotID, WarehouseID, Quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE Quantity = VALUES(Quantity)`,
      [lotId, WarehouseID, normalizedQty]
    );

    const [levelRows] = await conn.query(
      `SELECT ProductInventoryLevelID, StockQuantity
       FROM ProductInventoryLevels
       WHERE ProductID = ? AND WarehouseID = ? AND
         ((ProductLotID IS NULL AND ? IS NULL) OR ProductLotID = ?)
       FOR UPDATE`,
      [ProductID, WarehouseID, lotId, lotId]
    );

    let pilId;
    let quantityDelta = normalizedQty;

    if (levelRows.length === 0) {
      const [insertLevel] = await conn.query(
        `INSERT INTO ProductInventoryLevels
          (ProductID, WarehouseID, StockQuantity, ReservedQuantity,
           MinStockLevel, MaxStockLevel, LastUpdatedAt, ProductLotID)
         VALUES (?, ?, ?, 0, NULL, NULL, NOW(), ?)`,
        [ProductID, WarehouseID, normalizedQty, lotId]
      );
      pilId = insertLevel.insertId;
    } else {
      const current = Number(levelRows[0].StockQuantity || 0);
      pilId = levelRows[0].ProductInventoryLevelID;
      quantityDelta = normalizedQty - current;
      await conn.query(
        `UPDATE ProductInventoryLevels
         SET StockQuantity = ?, LastUpdatedAt = NOW()
         WHERE ProductInventoryLevelID = ?`,
        [normalizedQty, pilId]
      );
    }

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
          "LotAdjustment",
          pilId,
          lotId,
          null,
          "Lot inventory update",
          employeeId,
        ]
      );
    }

    await conn.commit();

    const [resultRows] = await conn.query(
      `SELECT
         pl.ProductLotID,
         pl.ProductID,
         pl.LotNumber,
         pl.ExpirationDate,
         pli.WarehouseID,
         pli.Quantity
       FROM ProductLots pl
       LEFT JOIN ProductLotInventory pli ON pl.ProductLotID = pli.ProductLotID
       WHERE pl.ProductLotID = ? AND pli.WarehouseID = ?`,
      [lotId, WarehouseID]
    );

    res.status(existingLot.length ? 200 : 201).json(resultRows[0]);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating product lot:", err);
    res.status(500).json({ error: "Failed to create product lot" });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/product-lots/:lotId
router.put("/:lotId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID || null;
  const { lotId } = req.params;
  const { WarehouseID, LotNumber, ExpirationDate, Quantity } = req.body || {};

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [lotRows] = await conn.query(
      `SELECT pl.ProductLotID, pl.ProductID
       FROM ProductLots pl
       WHERE pl.ProductLotID = ? AND pl.CompanyID = ?
       FOR UPDATE`,
      [lotId, companyId]
    );

    if (lotRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Lot not found" });
    }

    const productId = lotRows[0].ProductID;

    if (LotNumber || ExpirationDate !== undefined) {
      await conn.query(
        `UPDATE ProductLots
         SET LotNumber = COALESCE(?, LotNumber),
             ExpirationDate = COALESCE(?, ExpirationDate)
         WHERE ProductLotID = ?`,
        [LotNumber || null, normalizeDate(ExpirationDate), lotId]
      );
    }

    if (WarehouseID && Quantity !== undefined) {
      const [whRows] = await conn.query(
        `SELECT WarehouseID FROM Warehouses WHERE WarehouseID = ? AND CompanyID = ?`,
        [WarehouseID, companyId]
      );
      if (whRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Warehouse not found" });
      }
      const normalizedQty = Number.isFinite(Number(Quantity)) ? Number(Quantity) : 0;
      await conn.query(
        `INSERT INTO ProductLotInventory (ProductLotID, WarehouseID, Quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE Quantity = VALUES(Quantity)`,
        [lotId, WarehouseID, normalizedQty]
      );

      const [levelRows] = await conn.query(
        `SELECT ProductInventoryLevelID, StockQuantity
         FROM ProductInventoryLevels
         WHERE ProductID = ? AND WarehouseID = ? AND
           ((ProductLotID IS NULL AND ? IS NULL) OR ProductLotID = ?)
         FOR UPDATE`,
        [productId, WarehouseID, lotId, lotId]
      );

      let pilId;
      let quantityDelta = normalizedQty;
      if (levelRows.length === 0) {
        const [insertLevel] = await conn.query(
          `INSERT INTO ProductInventoryLevels
            (ProductID, WarehouseID, StockQuantity, ReservedQuantity,
             MinStockLevel, MaxStockLevel, LastUpdatedAt, ProductLotID)
           VALUES (?, ?, ?, 0, NULL, NULL, NOW(), ?)`,
          [productId, WarehouseID, normalizedQty, lotId]
        );
        pilId = insertLevel.insertId;
      } else {
        const current = Number(levelRows[0].StockQuantity || 0);
        pilId = levelRows[0].ProductInventoryLevelID;
        quantityDelta = normalizedQty - current;
        await conn.query(
          `UPDATE ProductInventoryLevels
           SET StockQuantity = ?, LastUpdatedAt = NOW()
           WHERE ProductInventoryLevelID = ?`,
          [normalizedQty, pilId]
        );
      }

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
            productId,
            WarehouseID,
            "ManualAdjustment",
            quantityDelta,
            "LotAdjustment",
            pilId,
            lotId,
            null,
            "Lot inventory update",
            employeeId,
          ]
        );
      }
    }

    await conn.commit();

    const [rows] = await conn.query(
      `SELECT
         pl.ProductLotID,
         pl.ProductID,
         pl.LotNumber,
         pl.ExpirationDate,
         pli.WarehouseID,
         pli.Quantity
       FROM ProductLots pl
       LEFT JOIN ProductLotInventory pli ON pl.ProductLotID = pli.ProductLotID
       WHERE pl.ProductLotID = ? AND (? IS NULL OR pli.WarehouseID = ?)`,
      [lotId, WarehouseID || null, WarehouseID || null]
    );

    res.json(rows[0] || {});
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error updating product lot:", err);
    res.status(500).json({ error: "Failed to update product lot" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
