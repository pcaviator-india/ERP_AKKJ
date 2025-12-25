const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Helper: calculate total from items
function calculateDirectPurchaseTotal(items) {
  let total = 0;
  const processed = (items || []).map((item) => {
    const Quantity = Number(item.Quantity || 0);
    const UnitPrice = Number(item.UnitPrice || 0);
    const TaxAmount = Number(item.TaxAmount || 0);
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

// GET /api/direct-purchases -> list for this company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT
         dp.DirectPurchaseID,
         dp.CompanyID,
         dp.SupplierID,
         s.SupplierName,
         dp.PurchaseDate,
         dp.ReceiptNumber,
         dp.Status,
         dp.TotalAmount,
         dp.TaxAmount,
         dp.Notes,
         dp.CreatedByEmployeeID
       FROM DirectPurchases dp
       LEFT JOIN Suppliers s ON dp.SupplierID = s.SupplierID
       WHERE dp.CompanyID = ?
       ORDER BY dp.PurchaseDate DESC, dp.DirectPurchaseID DESC`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching direct purchases:", err);
    res.status(500).json({ error: "Failed to fetch direct purchases" });
  }
});

// GET /api/direct-purchases/:id -> header + items
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    // Header
    const [headerRows] = await pool.query(
      `SELECT
         dp.DirectPurchaseID,
         dp.CompanyID,
         dp.SupplierID,
         s.SupplierName,
         dp.PurchaseDate,
         dp.ReceiptNumber,
         dp.Status,
         dp.TotalAmount,
         dp.TaxAmount,
         dp.Notes,
         dp.CreatedByEmployeeID
       FROM DirectPurchases dp
       LEFT JOIN Suppliers s ON dp.SupplierID = s.SupplierID
       WHERE dp.DirectPurchaseID = ? AND dp.CompanyID = ?`,
      [id, companyId]
    );

    if (headerRows.length === 0) {
      return res.status(404).json({ error: "Direct purchase not found" });
    }

    const header = headerRows[0];

    // Items
    const [items] = await pool.query(
      `SELECT
         dpi.DirectPurchaseItemID,
         dpi.DirectPurchaseID,
         dpi.ProductID,
         p.ProductName,
         dpi.Description,
         dpi.Quantity,
         dpi.UnitPrice,
         dpi.TaxAmount,
         dpi.ReceivedQuantity
       FROM DirectPurchaseItems dpi
       LEFT JOIN Products p ON dpi.ProductID = p.ProductID
       WHERE dpi.DirectPurchaseID = ?`,
      [id]
    );

    res.json({ header, items });
  } catch (err) {
    console.error("Error fetching direct purchase details:", err);
    res.status(500).json({ error: "Failed to fetch direct purchase details" });
  }
});

// POST /api/direct-purchases -> create DirectPurchase + items
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const employeeId = req.user.EmployeeID;

  const body = req.body || {};

  const SupplierID = body.SupplierID ?? body.supplierId;
  const ReceiptNumber = body.ReceiptNumber ?? body.receiptNumber;
  const PurchaseDate = body.PurchaseDate ?? body.purchaseDate;
  const Notes = body.Notes ?? body.notes;
  const Items = body.Items ?? body.items;

  console.log("DirectPurchase BODY:", body);

  if (!SupplierID) {
    return res.status(400).json({ error: "SupplierID is required" });
  }

  if (!ReceiptNumber || !String(ReceiptNumber).trim()) {
    return res.status(400).json({ error: "ReceiptNumber is required" });
  }

  if (!Array.isArray(Items) || Items.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one item is required for direct purchase" });
  }

  const { total, processedItems } = calculateDirectPurchaseTotal(Items);

  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Insert DirectPurchases header
    const [dpResult] = await conn.query(
      `INSERT INTO DirectPurchases
        (CompanyID, SupplierID, PurchaseDate, ReceiptNumber, TotalAmount,
         TaxAmount, Status, Notes, CreatedByEmployeeID)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
      [
        companyId,
        SupplierID,
        PurchaseDate || new Date(),
        ReceiptNumber,
        total,
        processedItems.reduce((sum, item) => sum + item.TaxAmount, 0),
        Notes || null,
        employeeId || null,
      ]
    );

    const directPurchaseId = dpResult.insertId;

    // 2) Insert DirectPurchaseItems
    for (const item of processedItems) {
      const ProductID = item.ProductID;
      const Description = item.Description || null;
      const Quantity = item.Quantity;
      const UnitPrice = item.UnitPrice;
      const TaxAmount = item.TaxAmount;

      if (!ProductID || Quantity <= 0) {
        throw new Error("Each item must have ProductID and positive Quantity");
      }

      await conn.query(
        `INSERT INTO DirectPurchaseItems
          (DirectPurchaseID, ProductID, Description, Quantity, UnitPrice, TaxAmount, ReceivedQuantity)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          directPurchaseId,
          ProductID,
          Description,
          Quantity,
          UnitPrice,
          TaxAmount,
        ]
      );
    }

    await conn.commit();
    conn.release();

    res.json({
      success: true,
      header: {
        DirectPurchaseID: directPurchaseId,
        CompanyID: companyId,
        SupplierID,
        Status: "Pending",
        TotalAmount: total,
        TaxAmount: processedItems.reduce(
          (sum, item) => sum + item.TaxAmount,
          0
        ),
      },
      items: processedItems,
    });
  } catch (err) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error("Error creating direct purchase:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to create direct purchase" });
  }
});

// PUT /api/direct-purchases/:id -> update DirectPurchase (header only)
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { Status, Notes } = req.body;

  try {
    await pool.query(
      `UPDATE DirectPurchases
       SET Status = COALESCE(?, Status),
           Notes = COALESCE(?, Notes)
       WHERE DirectPurchaseID = ? AND CompanyID = ?`,
      [Status || null, Notes || null, id, companyId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating direct purchase:", err);
    res.status(500).json({ error: "Failed to update direct purchase" });
  }
});

// DELETE /api/direct-purchases/:id
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `DELETE FROM DirectPurchases WHERE DirectPurchaseID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Direct purchase not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting direct purchase:", err);
    res.status(500).json({ error: "Failed to delete direct purchase" });
  }
});

module.exports = router;
