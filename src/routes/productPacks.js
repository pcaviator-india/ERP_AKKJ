const express = require("express");
const router = express.Router();
const { pool } = require("../db");

const normalizeComponents = (components = []) =>
  components
    .map((row) => ({
      componentId: Number(row?.ComponentProductID || row?.componentProductId),
      quantity: Number(row?.ComponentQuantity || row?.componentQuantity),
    }))
    .filter((row) => row.componentId && row.quantity > 0);

router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const [rows] = await pool.query(
      `SELECT
        pp.ProductPackID,
        pp.PackProductID,
        pp.ComponentProductID,
        pp.ComponentQuantity,
        pack.ProductName AS PackName,
        pack.SKU AS PackSKU,
        pack.UnitID AS PackUnitID,
        pack.CostPrice AS PackCostPrice,
        pack.SellingPrice AS PackSellingPrice,
        comp.ProductName AS ComponentName,
        comp.SKU AS ComponentSKU
      FROM ProductPacks pp
      INNER JOIN Products pack ON pack.ProductID = pp.PackProductID
      INNER JOIN Products comp ON comp.ProductID = pp.ComponentProductID
      WHERE pp.CompanyID = ?
      ORDER BY pack.ProductName, comp.ProductName`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Failed to load product packs", err);
    res.status(500).json({ error: "Failed to load product packs" });
  }
});

router.get("/:packProductId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const packProductId = Number(req.params.packProductId);
  if (!packProductId) {
    return res.status(400).json({ error: "PackProductID is required" });
  }
  try {
    const [rows] = await pool.query(
      `SELECT
        pp.ComponentProductID,
        pp.ComponentQuantity,
        comp.ProductID,
        comp.ProductName,
        comp.SKU,
        comp.UnitID,
        comp.CostPrice,
        comp.SellingPrice,
        comp.IsTaxable,
        comp.TaxRateID,
        tr.Name AS TaxRateName,
        tr.RatePercentage AS TaxRatePercentage,
        comp.ProductCategoryID,
        comp.ProductBrandID,
        comp.IsService,
        comp.Barcode
      FROM ProductPacks pp
      INNER JOIN Products comp ON comp.ProductID = pp.ComponentProductID
      LEFT JOIN TaxRates tr ON tr.TaxRateID = comp.TaxRateID
      WHERE pp.CompanyID = ? AND pp.PackProductID = ?
      ORDER BY comp.ProductName`,
      [companyId, packProductId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Failed to load pack components", err);
    res.status(500).json({ error: "Failed to load pack components" });
  }
});

const savePack = async (req, res) => {
  const companyId = req.user.CompanyID;
  let packProductId = Number(
    req.params.packProductId || req.body?.PackProductID || req.body?.packProductId
  );
  const packName = String(
    req.body?.PackName ||
      req.body?.packName ||
      req.body?.ProductName ||
      req.body?.productName ||
      ""
  ).trim();
  const packSku = String(
    req.body?.PackSKU || req.body?.packSku || req.body?.SKU || req.body?.sku || ""
  ).trim();
  const packUnitId = Number(req.body?.UnitID || req.body?.unitId);
  const packCostPrice = req.body?.CostPrice ?? req.body?.costPrice ?? null;
  const packSellingPrice = req.body?.SellingPrice ?? req.body?.sellingPrice ?? null;
  const components = normalizeComponents(req.body?.components || []);

  if (req.params.packProductId && !packProductId) {
    return res.status(400).json({ error: "PackProductID is required" });
  }
  if (!packProductId && (!packName || !packSku || !packUnitId)) {
    return res.status(400).json({
      error: "PackName, PackSKU and UnitID are required",
    });
  }
  if (!components.length) {
    return res.status(400).json({ error: "At least one component is required" });
  }
  if (packProductId && components.some((row) => row.componentId === packProductId)) {
    return res.status(400).json({ error: "Pack product cannot include itself" });
  }

  const unique = new Set();
  for (const row of components) {
    if (unique.has(row.componentId)) {
      return res.status(400).json({ error: "Duplicate component product" });
    }
    unique.add(row.componentId);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (!packProductId) {
      const [insertResult] = await conn.query(
        `INSERT INTO Products
          (CompanyID, SKU, ProductName, UnitID, CostPrice, SellingPrice, IsTaxable, IsService, IsActive)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1)`,
        [
          companyId,
          packSku,
          packName,
          packUnitId,
          packCostPrice ?? 0,
          packSellingPrice ?? 0,
        ]
      );
      packProductId = insertResult.insertId;
    } else if (packName || packSku || packUnitId || packCostPrice != null || packSellingPrice != null) {
      await conn.query(
        `UPDATE Products
         SET
           ProductName = COALESCE(?, ProductName),
           SKU = COALESCE(?, SKU),
           UnitID = COALESCE(?, UnitID),
           CostPrice = COALESCE(?, CostPrice),
           SellingPrice = COALESCE(?, SellingPrice),
           UpdatedAt = CURRENT_TIMESTAMP
         WHERE ProductID = ? AND CompanyID = ?`,
        [
          packName || null,
          packSku || null,
          Number.isFinite(packUnitId) ? packUnitId : null,
          packCostPrice != null ? packCostPrice : null,
          packSellingPrice != null ? packSellingPrice : null,
          packProductId,
          companyId,
        ]
      );
    }

    if (components.some((row) => row.componentId === packProductId)) {
      throw new Error("Pack product cannot include itself");
    }

    const productIds = [packProductId, ...components.map((row) => row.componentId)];
    const [productRows] = await conn.query(
      "SELECT ProductID FROM Products WHERE CompanyID = ? AND ProductID IN (?)",
      [companyId, productIds]
    );
    if (productRows.length !== new Set(productIds).size) {
      throw new Error("Invalid product selection");
    }
    await conn.query(
      "DELETE FROM ProductPacks WHERE CompanyID = ? AND PackProductID = ?",
      [companyId, packProductId]
    );
    for (const row of components) {
      await conn.query(
        `INSERT INTO ProductPacks
          (CompanyID, PackProductID, ComponentProductID, ComponentQuantity)
         VALUES (?, ?, ?, ?)`,
        [companyId, packProductId, row.componentId, row.quantity]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    const message = err?.message || "";
    if (
      message === "Invalid product selection" ||
      message === "Pack product cannot include itself"
    ) {
      res.status(400).json({ error: message });
      return;
    }
    console.error("Failed to save product pack", err);
    res.status(500).json({ error: "Failed to save product pack" });
  } finally {
    conn.release();
  }
};

router.post("/", savePack);
router.put("/:packProductId", savePack);

router.delete("/:packProductId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const packProductId = Number(req.params.packProductId);
  if (!packProductId) {
    return res.status(400).json({ error: "PackProductID is required" });
  }
  try {
    await pool.query(
      "DELETE FROM ProductPacks WHERE CompanyID = ? AND PackProductID = ?",
      [companyId, packProductId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete product pack", err);
    res.status(500).json({ error: "Failed to delete product pack" });
  }
});

module.exports = router;
