const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Helper: calculate total from items
function calculatePurchaseOrderTotal(items) {
  let total = 0;
  const processed = (items || []).map((item) => {
    const Quantity = Number(item.Quantity || 0);
    const UnitPrice = Number(item.UnitPrice || 0);
    const TaxAmount = Number(item.TaxAmount || 0); // can be 0
    const lineTotal = Quantity * UnitPrice + TaxAmount;
    total += lineTotal;
    return {
      ...item,
      Quantity,
      UnitPrice,
      TaxAmount,
    };
  });
  return { total, processedItems: processed };
}

// GET /api/purchase-orders -> list for this company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT
         po.PurchaseOrderID,
         po.CompanyID,
         po.SupplierID,
         s.SupplierName,
         po.OrderDate,
         po.ExpectedDeliveryDate,
         po.PurchaseOrderNumber,
         po.Status,
         po.TotalAmount,
         po.Notes,
         po.ShippingAddress,
         po.CreatedByEmployeeID
       FROM PurchaseOrders po
       LEFT JOIN Suppliers s ON po.SupplierID = s.SupplierID
       WHERE po.CompanyID = ?
       ORDER BY po.OrderDate DESC, po.PurchaseOrderID DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching purchase orders:", err);
    res.status(500).json({ error: "Failed to fetch purchase orders" });
  }
});

// GET /api/purchase-orders/:id -> header + items
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    // Header
    const [headerRows] = await pool.query(
      `SELECT
         po.PurchaseOrderID,
         po.CompanyID,
         po.SupplierID,
         s.SupplierName,
         po.OrderDate,
         po.ExpectedDeliveryDate,
         po.PurchaseOrderNumber,
         po.Status,
         po.TotalAmount,
         po.Notes,
         po.ShippingAddress,
         po.CreatedByEmployeeID
       FROM PurchaseOrders po
       LEFT JOIN Suppliers s ON po.SupplierID = s.SupplierID
       WHERE po.PurchaseOrderID = ? AND po.CompanyID = ?`,
      [id, companyId]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const header = headerRows[0];

    // Items
    const [items] = await pool.query(
      `SELECT
         poi.PurchaseOrderItemID,
         poi.PurchaseOrderID,
         poi.ProductID,
         p.ProductName,
         poi.Description,
         poi.Quantity,
         poi.UnitPrice,
         poi.TaxAmount,
         poi.LineTotal,
         poi.ReceivedQuantity
       FROM PurchaseOrderItems poi
       LEFT JOIN Products p ON poi.ProductID = p.ProductID
       WHERE poi.PurchaseOrderID = ?`,
      [id]
    );

    res.json({ header, items });
  } catch (err) {
    console.error("Error fetching purchase order details:", err);
    res.status(500).json({ error: "Failed to fetch purchase order details" });
  }
});

// POST /api/purchase-orders -> create PO with items
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  const body = req.body || {};
  const {
    SupplierID,
    OrderDate,
    ExpectedDeliveryDate,
    PurchaseOrderNumber,
    Status,
    Notes,
    ShippingAddress,
    Items,
  } = body;

  if (!SupplierID || !PurchaseOrderNumber) {
    return res.status(400).json({
      error: "SupplierID and PurchaseOrderNumber are required",
    });
  }

  if (!Array.isArray(Items) || Items.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one item is required for a purchase order" });
  }

  const { total, processedItems } = calculatePurchaseOrderTotal(Items);
  const poStatus = Status || "Draft";

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Insert header
    const [poResult] = await conn.query(
      `INSERT INTO PurchaseOrders
        (CompanyID, SupplierID, OrderDate, ExpectedDeliveryDate,
         PurchaseOrderNumber, Status, TotalAmount,
         Notes, ShippingAddress, CreatedByEmployeeID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        SupplierID,
        OrderDate || new Date(),
        ExpectedDeliveryDate || null,
        PurchaseOrderNumber,
        poStatus,
        total,
        Notes || null,
        ShippingAddress || null,
        employeeId || null,
      ]
    );

    const purchaseOrderId = poResult.insertId;

    // Insert items
    for (const item of processedItems) {
      await conn.query(
        `INSERT INTO PurchaseOrderItems
          (PurchaseOrderID, ProductID, Description,
           Quantity, UnitPrice, TaxAmount, ReceivedQuantity)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          purchaseOrderId,
          item.ProductID,
          item.Description || null,
          item.Quantity,
          item.UnitPrice,
          item.TaxAmount,
        ]
      );
      // LineTotal will be auto-calculated by MySQL STORED column
    }

    await conn.commit();

    // Return newly created PO with items
    const [headerRows] = await conn.query(
      `SELECT
         po.PurchaseOrderID,
         po.CompanyID,
         po.SupplierID,
         s.SupplierName,
         po.OrderDate,
         po.ExpectedDeliveryDate,
         po.PurchaseOrderNumber,
         po.Status,
         po.TotalAmount,
         po.Notes,
         po.ShippingAddress,
         po.CreatedByEmployeeID
       FROM PurchaseOrders po
       LEFT JOIN Suppliers s ON po.SupplierID = s.SupplierID
       WHERE po.PurchaseOrderID = ?`,
      [purchaseOrderId]
    );

    const [itemsRows] = await conn.query(
      `SELECT
         poi.PurchaseOrderItemID,
         poi.PurchaseOrderID,
         poi.ProductID,
         p.ProductName,
         poi.Description,
         poi.Quantity,
         poi.UnitPrice,
         poi.TaxAmount,
         poi.LineTotal,
         poi.ReceivedQuantity
       FROM PurchaseOrderItems poi
       LEFT JOIN Products p ON poi.ProductID = p.ProductID
       WHERE poi.PurchaseOrderID = ?`,
      [purchaseOrderId]
    );

    res.status(201).json({
      header: headerRows[0],
      items: itemsRows,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating purchase order:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error:
          "PurchaseOrderNumber already exists for this company. Please use a unique number.",
      });
    }

    res.status(500).json({ error: "Failed to create purchase order" });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/purchase-orders/:id -> update header and optionally items
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const body = req.body || {};

  const {
    SupplierID,
    OrderDate,
    ExpectedDeliveryDate,
    PurchaseOrderNumber,
    Status,
    Notes,
    ShippingAddress,
    Items,
  } = body;

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // If Items are provided, recalc total and replace items
    let newTotalAmount = null;

    if (Array.isArray(Items) && Items.length > 0) {
      const { total, processedItems } = calculatePurchaseOrderTotal(Items);
      newTotalAmount = total;

      // delete old items
      await conn.query(
        `DELETE FROM PurchaseOrderItems
         WHERE PurchaseOrderID = ?`,
        [id]
      );

      // insert new items
      for (const item of processedItems) {
        await conn.query(
          `INSERT INTO PurchaseOrderItems
            (PurchaseOrderID, ProductID, Description,
             Quantity, UnitPrice, TaxAmount, ReceivedQuantity)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [
            id,
            item.ProductID,
            item.Description || null,
            item.Quantity,
            item.UnitPrice,
            item.TaxAmount,
          ]
        );
      }
    }

    // update header
    const [result] = await conn.query(
      `UPDATE PurchaseOrders
       SET
         SupplierID = COALESCE(?, SupplierID),
         OrderDate = COALESCE(?, OrderDate),
         ExpectedDeliveryDate = COALESCE(?, ExpectedDeliveryDate),
         PurchaseOrderNumber = COALESCE(?, PurchaseOrderNumber),
         Status = COALESCE(?, Status),
         TotalAmount = COALESCE(?, TotalAmount),
         Notes = COALESCE(?, Notes),
         ShippingAddress = COALESCE(?, ShippingAddress)
       WHERE PurchaseOrderID = ? AND CompanyID = ?`,
      [
        SupplierID || null,
        OrderDate || null,
        ExpectedDeliveryDate || null,
        PurchaseOrderNumber || null,
        Status || null,
        newTotalAmount,
        Notes || null,
        ShippingAddress || null,
        id,
        companyId,
      ]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Purchase order not found" });
    }

    await conn.commit();

    // return updated PO
    const [headerRows] = await pool.query(
      `SELECT
         po.PurchaseOrderID,
         po.CompanyID,
         po.SupplierID,
         s.SupplierName,
         po.OrderDate,
         po.ExpectedDeliveryDate,
         po.PurchaseOrderNumber,
         po.Status,
         po.TotalAmount,
         po.Notes,
         po.ShippingAddress,
         po.CreatedByEmployeeID
       FROM PurchaseOrders po
       LEFT JOIN Suppliers s ON po.SupplierID = s.SupplierID
       WHERE po.PurchaseOrderID = ? AND po.CompanyID = ?`,
      [id, companyId]
    );

    const [itemsRows] = await pool.query(
      `SELECT
         poi.PurchaseOrderItemID,
         poi.PurchaseOrderID,
         poi.ProductID,
         p.ProductName,
         poi.Description,
         poi.Quantity,
         poi.UnitPrice,
         poi.TaxAmount,
         poi.LineTotal,
         poi.ReceivedQuantity
       FROM PurchaseOrderItems poi
       LEFT JOIN Products p ON poi.ProductID = p.ProductID
       WHERE poi.PurchaseOrderID = ?`,
      [id]
    );

    res.json({
      header: headerRows[0],
      items: itemsRows,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error updating purchase order:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error:
          "PurchaseOrderNumber already exists for this company. Please use a unique number.",
      });
    }

    res.status(500).json({ error: "Failed to update purchase order" });
  } finally {
    if (conn) conn.release();
  }
});

// DELETE /api/purchase-orders/:id -> mark as Cancelled
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE PurchaseOrders
       SET Status = 'Cancelled'
       WHERE PurchaseOrderID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    res.json({ message: "Purchase order cancelled" });
  } catch (err) {
    console.error("Error cancelling purchase order:", err);
    res.status(500).json({ error: "Failed to cancel purchase order" });
  }
});

module.exports = router;
