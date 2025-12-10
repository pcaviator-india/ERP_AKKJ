const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const ExcelJS = require("exceljs");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

async function setPrimaryImage(productId, imageId, conn) {
  // Set chosen image to 1, all others to their own ID to keep uniqueness
  await conn.query(
    `UPDATE ProductImages
       SET IsPrimary = CASE WHEN ProductImageID = ? THEN 1 ELSE ProductImageID END
     WHERE ProductID = ?`,
    [imageId, productId]
  );
}

// Multer storage for temp image import batches
const uploadRoot = path.join(process.cwd(), "uploads");
const tmpRoot = path.join(uploadRoot, "tmp");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const batchId = req.body.batchId || uuidv4();
    const dest = path.join(tmpRoot, batchId);
    fs.mkdirSync(dest, { recursive: true });
    req.importBatchId = batchId;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadManifest(batchId) {
  const manifestPath = path.join(tmpRoot, batchId, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function saveManifest(batchId, manifest) {
  const manifestPath = path.join(tmpRoot, batchId, "manifest.json");
  ensureDir(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

// GET /api/products -> list
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const search = (req.query.q || "").trim();
  const categoryFilter = req.query.category || "";
  const typeFilter = req.query.type || "all";

  try {
    const params = [companyId];
    let whereClause = "WHERE p.CompanyID = ?";

    if (search) {
      const like = `%${search}%`;
      whereClause += " AND (p.ProductName LIKE ? OR p.SKU LIKE ? OR p.Barcode LIKE ?)";
      params.push(like, like, like);
    }
    if (categoryFilter) {
      whereClause += " AND p.ProductCategoryID = ?";
      params.push(categoryFilter);
    }
    if (typeFilter === "active") whereClause += " AND p.IsActive = 1";
    if (typeFilter === "inactive") whereClause += " AND p.IsActive = 0";

    const [rows] = await pool.query(
      `SELECT
         p.ProductID,
         p.CompanyID,
         p.SKU,
         p.ProductName,
         p.Description,
         p.ProductCategoryID,
         p.ProductBrandID,
         p.UnitID,
         p.CostPrice,
         p.SellingPrice,
         p.IsTaxable,
         p.TaxRateID,
         tr.Name AS TaxRateName,
         tr.RatePercentage AS TaxRatePercentage,
         p.IsService,
         p.Weight,
         p.WeightUnitID,
         p.Length,
         p.Width,
         p.Height,
         p.DimensionUnitID,
         p.ImageURL,
         p.Barcode,
         p.IsActive,
         p.CreatedAt,
         p.UpdatedAt,
         c.CategoryName,
         b.BrandName,
         (
           SELECT pi.ImageUrl
           FROM ProductImages pi
           WHERE pi.ProductID = p.ProductID
           ORDER BY pi.IsPrimary DESC, pi.ProductImageID ASC
           LIMIT 1
         ) AS PrimaryImageURL
       FROM Products p
       LEFT JOIN ProductCategories c ON p.ProductCategoryID = c.ProductCategoryID
       LEFT JOIN ProductBrands b ON p.ProductBrandID = b.ProductBrandID
       LEFT JOIN TaxRates tr ON tr.TaxRateID = p.TaxRateID
       ${whereClause}
       ORDER BY p.ProductName
       LIMIT 100`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// POST /api/products/import/images - upload images to temp batch and return manifest
router.post("/import/images", upload.array("files"), async (req, res) => {
  try {
    const batchId = req.importBatchId || uuidv4();
    const files = (req.files || []).map((f) => ({
      originalName: f.originalname,
      storedName: f.filename,
      tempUrl: `/uploads/tmp/${batchId}/${f.filename}`,
      tempPath: f.path,
    }));
    const manifest = {
      batchId,
      createdAt: new Date().toISOString(),
      files,
    };
    saveManifest(batchId, manifest);
    res.json(manifest);
  } catch (err) {
    console.error("Error uploading import images:", err);
    res.status(500).json({ error: "Failed to upload import images" });
  }
});

function mapRowToProduct(row, mapping = {}, lookups = {}) {
  const getVal = (key) => (mapping[key] ? row[mapping[key]] : undefined);
  const toNumber = (val) => {
    if (val === undefined || val === null || val === "") return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };
  const toIdByName = (val, map) => {
    const num = toNumber(val);
    if (num !== null) return num;
    if (!map || val === undefined || val === null || val === "") return null;
    const name = String(val).trim().toLowerCase();
    return map.get(name) || null;
  };
  const toUnit = (val, map) => {
    const num = toNumber(val);
    if (num !== null) return num;
    if (!map || val === undefined || val === null || val === "") return null;
    const name = String(val).trim().toLowerCase();
    return map.get(name) || null;
  };
  const toBool = (val) => {
    if (val === undefined || val === null || val === "") return null;
    const s = String(val).toLowerCase();
    if (s === "1" || s === "true" || s === "yes") return 1;
    if (s === "0" || s === "false" || s === "no") return 0;
    return null;
  };
  const product = {
    SKU: getVal("sku") || "",
    ProductName: getVal("name") || "",
    ProductCategoryID: toIdByName(getVal("category"), lookups.categoryMap),
    ProductBrandID: toIdByName(getVal("brand"), lookups.brandMap),
    UnitID: toUnit(getVal("unit"), lookups.unitMap),
    SellingPrice: toNumber(getVal("price")),
    CostPrice: toNumber(getVal("cost")),
    Barcode: getVal("barcode") || null,
    Description: getVal("description") || null,
    IsActive: toBool(getVal("status")),
    IsTaxable: toBool(getVal("taxable")),
    TaxRateID: toNumber(getVal("taxRateId")),
    IsService: toBool(getVal("service")),
    Weight: toNumber(getVal("weight")),
    WeightUnitID: toUnit(getVal("weightUnit"), lookups.weightUnitMap || lookups.unitMap),
    Length: toNumber(getVal("length")),
    Width: toNumber(getVal("width")),
    Height: toNumber(getVal("height")),
    DimensionUnitID: toUnit(getVal("dimensionUnit"), lookups.dimensionUnitMap || lookups.unitMap),
  };
  const imageRef = getVal("image");
  return {
    product,
    imageRef,
    raw: {
      category: getVal("category"),
      brand: getVal("brand"),
      unit: getVal("unit"),
      weightUnit: getVal("weightUnit"),
      dimensionUnit: getVal("dimensionUnit"),
    },
  };
}

// POST /api/products/import/preview
// body: { rows: [{...}], mapping: {sku,name,...,image}, skipExisting, imageBatchId }
router.post("/import/preview", async (req, res) => {
  const companyId = req.user.CompanyID;
  const {
    rows = [],
    mapping = {},
    skipExisting = true,
    imageBatchId,
    createCategories = false,
    createBrands = false,
    createUnits = false,
  } = req.body || {};

  try {
    const [unitRows] = await pool.query(`SELECT UnitID, UnitName FROM UnitsOfMeasure`);
    const unitMap = new Map(unitRows.map((r) => [String(r.UnitName).toLowerCase(), r.UnitID]));
    const [catRows] = await pool.query(
      `SELECT ProductCategoryID, CategoryName FROM ProductCategories WHERE CompanyID = ?`,
      [companyId]
    );
    const categoryMap = new Map(catRows.map((r) => [String(r.CategoryName).toLowerCase(), r.ProductCategoryID]));
    const [brandRows] = await pool.query(
      `SELECT ProductBrandID, BrandName FROM ProductBrands WHERE CompanyID = ?`,
      [companyId]
    );
    const brandMap = new Map(brandRows.map((r) => [String(r.BrandName).toLowerCase(), r.ProductBrandID]));

    let manifest = null;
    if (imageBatchId) {
      manifest = loadManifest(imageBatchId);
    }

    const [existingSkuRows] = await pool.query(
      `SELECT SKU FROM Products WHERE CompanyID = ?`,
      [companyId]
    );
    const existingSkus = new Set(existingSkuRows.map((r) => r.SKU));

    const previewRows = rows.map((row, idx) => {
      const { product, imageRef, raw } = mapRowToProduct(row, mapping, {
        unitMap,
        weightUnitMap: unitMap,
        dimensionUnitMap: unitMap,
        categoryMap,
        brandMap,
      });
      const errors = [];
      if (!product.SKU) errors.push("SKU required");
      if (!product.ProductName) errors.push("Name required");
      if (!product.UnitID) errors.push("Unit required");
      if (!product.ProductCategoryID && raw.category && !createCategories) errors.push("Category missing");
      if (!product.ProductBrandID && raw.brand && !createBrands) errors.push("Brand missing");
      if (!product.UnitID && raw.unit && !createUnits) errors.push("Unit missing");
      if (!product.WeightUnitID && raw.weightUnit && !createUnits) errors.push("Weight unit missing");
      if (!product.DimensionUnitID && raw.dimensionUnit && !createUnits) errors.push("Dimension unit missing");
      if (skipExisting && existingSkus.has(product.SKU)) {
        errors.push("SKU exists (will skip)");
      }
      let imageMatch = null;
      if (imageRef) {
        const refName = path.basename(String(imageRef)).toLowerCase();
        if (manifest) {
          imageMatch = manifest.files.find((f) => f.originalName.toLowerCase() === refName);
        }
        // Treat existing URLs or paths as already available; no error if not in batch
        if (!imageMatch && (String(imageRef).startsWith("/") || String(imageRef).startsWith("http"))) {
          imageMatch = { existing: true };
        }
        if (!imageMatch && manifest) {
          errors.push("Image not found in batch");
        }
      }
      return {
        index: idx,
        product,
        imageRef: imageRef || null,
        imageMatched: !!imageMatch,
        errors,
      };
    });

    const summary = {
      total: previewRows.length,
      valid: previewRows.filter((r) => r.errors.length === 0).length,
      invalid: previewRows.filter((r) => r.errors.length > 0).length,
    };

    res.json({ summary, rows: previewRows, imageBatchId });
  } catch (err) {
    console.error("Error during import preview:", err);
    res.status(500).json({ error: "Failed to build import preview" });
  }
});

async function moveAndInsertImages(conn, productId, matches = []) {
  if (!matches.length) return;
  const productDir = path.join(uploadRoot, "products");
  ensureDir(productDir);

  // Determine next non-primary value
  const [[maxRow]] = await conn.query(
    `SELECT IFNULL(MAX(IsPrimary),1) AS MaxVal FROM ProductImages WHERE ProductID = ?`,
    [productId]
  );
  let nonPrimaryVal = (maxRow?.MaxVal || 1) + 1;

  for (let i = 0; i < matches.length; i++) {
    const file = matches[i];
    const destName = `${Date.now()}_${file.storedName}`;
    const destPath = path.join(productDir, destName);
    fs.copyFileSync(file.tempPath, destPath);
    const imageUrl = `/uploads/products/${destName}`;
    const isPrimary = i === 0 ? 1 : nonPrimaryVal++;
    const [insertRes] = await conn.query(
      `INSERT INTO ProductImages (ProductID, ImageUrl, AltText, IsPrimary)
       VALUES (?, ?, ?, ?)`,
      [productId, imageUrl, file.originalName, isPrimary]
    );
    if (isPrimary === 1) {
      await setPrimaryImage(productId, insertRes.insertId, conn);
    }
  }
}

// POST /api/products/import/commit
router.post("/import/commit", async (req, res) => {
  const companyId = req.user.CompanyID;
  const {
    rows = [],
    mapping = {},
    skipExisting = true,
    imageBatchId,
    createCategories = false,
    createBrands = false,
    createUnits = false,
  } = req.body || {};

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [unitRows] = await conn.query(`SELECT UnitID, UnitName FROM UnitsOfMeasure`);
    const unitMap = new Map(unitRows.map((r) => [String(r.UnitName).toLowerCase(), r.UnitID]));

    let manifest = null;
    if (imageBatchId) {
      manifest = loadManifest(imageBatchId);
    }

    const [existingSkuRows] = await conn.query(
      `SELECT ProductID, SKU FROM Products WHERE CompanyID = ?`,
      [companyId]
    );
    const skuToId = new Map(existingSkuRows.map((r) => [r.SKU, r.ProductID]));

    const [catRows] = await conn.query(
      `SELECT ProductCategoryID, CategoryName FROM ProductCategories WHERE CompanyID = ?`,
      [companyId]
    );
    const categoryMap = new Map(catRows.map((r) => [String(r.CategoryName).toLowerCase(), r.ProductCategoryID]));
    const [brandRows] = await conn.query(
      `SELECT ProductBrandID, BrandName FROM ProductBrands WHERE CompanyID = ?`,
      [companyId]
    );
    const brandMap = new Map(brandRows.map((r) => [String(r.BrandName).toLowerCase(), r.ProductBrandID]));

    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      createdItems: [],
      updatedItems: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { product, imageRef, raw } = mapRowToProduct(row, mapping, {
        unitMap,
        weightUnitMap: unitMap,
        dimensionUnitMap: unitMap,
        categoryMap,
        brandMap,
      });
      if (!product.SKU || !product.ProductName || (!product.UnitID && !createUnits)) {
        result.errors.push({ index: i, message: "Missing required fields" });
        result.skipped++;
        continue;
      }

      // Create missing lookups if allowed
      if (!product.ProductCategoryID && raw.category && createCategories) {
        const catName = String(raw.category).trim();
        const [ins] = await conn.query(
          `INSERT INTO ProductCategories (CompanyID, CategoryName) VALUES (?, ?)`,
          [companyId, catName]
        );
        product.ProductCategoryID = ins.insertId;
        categoryMap.set(catName.toLowerCase(), ins.insertId);
      }
      if (!product.ProductBrandID && raw.brand && createBrands) {
        const brandName = String(raw.brand).trim();
        const [ins] = await conn.query(
          `INSERT INTO ProductBrands (CompanyID, BrandName) VALUES (?, ?)`,
          [companyId, brandName]
        );
        product.ProductBrandID = ins.insertId;
        brandMap.set(brandName.toLowerCase(), ins.insertId);
      }
      if (!product.UnitID && raw.unit && createUnits) {
        const unitName = String(raw.unit).trim();
        const [ins] = await conn.query(`INSERT INTO UnitsOfMeasure (UnitName) VALUES (?)`, [unitName]);
        product.UnitID = ins.insertId;
        unitMap.set(unitName.toLowerCase(), ins.insertId);
      }
      if (!product.WeightUnitID && raw.weightUnit && createUnits) {
        const unitName = String(raw.weightUnit).trim().toLowerCase();
        let unitId = unitMap.get(unitName);
        if (!unitId) {
          const [ins] = await conn.query(`INSERT INTO UnitsOfMeasure (UnitName) VALUES (?)`, [unitName]);
          unitId = ins.insertId;
          unitMap.set(unitName, unitId);
        }
        product.WeightUnitID = unitId;
      }
      if (!product.DimensionUnitID && raw.dimensionUnit && createUnits) {
        const unitName = String(raw.dimensionUnit).trim().toLowerCase();
        let unitId = unitMap.get(unitName);
        if (!unitId) {
          const [ins] = await conn.query(`INSERT INTO UnitsOfMeasure (UnitName) VALUES (?)`, [unitName]);
          unitId = ins.insertId;
          unitMap.set(unitName, unitId);
        }
        product.DimensionUnitID = unitId;
      }

      const existingId = skuToId.get(product.SKU);
      let productId = existingId;
      if (existingId && skipExisting) {
        result.skipped++;
        continue;
      }

      if (existingId) {
        await conn.query(
          `UPDATE Products
             SET ProductName = ?, Description = ?, ProductCategoryID = ?, ProductBrandID = ?,
                 UnitID = ?, CostPrice = ?, SellingPrice = ?, IsTaxable = ?, TaxRateID = ?, IsService = ?,
                 Barcode = ?, IsActive = ?
           WHERE ProductID = ? AND CompanyID = ?`,
          [
            product.ProductName,
            product.Description || null,
            product.ProductCategoryID || null,
            product.ProductBrandID || null,
            product.UnitID,
            product.CostPrice || null,
            product.SellingPrice || null,
            product.IsTaxable != null ? product.IsTaxable : 0,
            product.TaxRateID || null,
            product.IsService != null ? product.IsService : 0,
            product.Barcode || null,
            product.IsActive != null ? product.IsActive : 1,
            existingId,
            companyId,
          ]
        );
        result.updated++;
        result.updatedItems.push({ SKU: product.SKU, ProductID: productId, ProductName: product.ProductName });
      } else {
        const [insertRes] = await conn.query(
          `INSERT INTO Products
             (CompanyID, SKU, ProductName, Description, ProductCategoryID, ProductBrandID, UnitID,
              CostPrice, SellingPrice, IsTaxable, TaxRateID, IsService, Barcode, IsActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            product.SKU,
            product.ProductName,
            product.Description || null,
            product.ProductCategoryID || null,
            product.ProductBrandID || null,
            product.UnitID,
            product.CostPrice || null,
            product.SellingPrice || null,
            product.IsTaxable != null ? product.IsTaxable : 0,
            product.TaxRateID || null,
            product.IsService != null ? product.IsService : 0,
            product.Barcode || null,
            product.IsActive != null ? product.IsActive : 1,
          ]
        );
        productId = insertRes.insertId;
        skuToId.set(product.SKU, productId);
        result.created++;
        result.createdItems.push({ SKU: product.SKU, ProductID: productId, ProductName: product.ProductName });
      }

      if (imageRef && manifest) {
        const refName = path.basename(String(imageRef)).toLowerCase();
        const matches = manifest.files.filter((f) => f.originalName.toLowerCase() === refName);
        if (matches.length) {
          await moveAndInsertImages(conn, productId, matches);
        }
      }
    }

    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error during import commit:", err);
    res.status(500).json({ error: "Failed to import products" });
  } finally {
    if (conn) conn.release();
  }
});

// ---- Brands, Categories, Units simple CRUD ----
router.get("/brands", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const [rows] = await pool.query(
      `SELECT ProductBrandID, BrandName FROM ProductBrands WHERE CompanyID = ? ORDER BY BrandName`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching brands:", err);
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

router.post("/brands", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { BrandName } = req.body || {};
  if (!BrandName || !BrandName.trim()) return res.status(400).json({ error: "BrandName required" });
  try {
    const [ins] = await pool.query(
      `INSERT INTO ProductBrands (CompanyID, BrandName) VALUES (?, ?)`,
      [companyId, BrandName.trim()]
    );
    res.status(201).json({ ProductBrandID: ins.insertId, BrandName: BrandName.trim() });
  } catch (err) {
    console.error("Error adding brand:", err);
    res.status(500).json({ error: "Failed to add brand" });
  }
});

router.put("/brands/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { BrandName } = req.body || {};
  if (!BrandName || !BrandName.trim()) return res.status(400).json({ error: "BrandName required" });
  try {
    await pool.query(
      `UPDATE ProductBrands SET BrandName = ? WHERE ProductBrandID = ? AND CompanyID = ?`,
      [BrandName.trim(), id, companyId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating brand:", err);
    res.status(500).json({ error: "Failed to update brand" });
  }
});

router.delete("/brands/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM ProductBrands WHERE ProductBrandID = ? AND CompanyID = ?`, [id, companyId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting brand:", err);
    res.status(500).json({ error: "Failed to delete brand" });
  }
});

router.get("/categories", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const [rows] = await pool.query(
      `SELECT ProductCategoryID, CategoryName FROM ProductCategories WHERE CompanyID = ? ORDER BY CategoryName`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { CategoryName } = req.body || {};
  if (!CategoryName || !CategoryName.trim()) return res.status(400).json({ error: "CategoryName required" });
  try {
    const [ins] = await pool.query(
      `INSERT INTO ProductCategories (CompanyID, CategoryName) VALUES (?, ?)`,
      [companyId, CategoryName.trim()]
    );
    res.status(201).json({ ProductCategoryID: ins.insertId, CategoryName: CategoryName.trim() });
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({ error: "Failed to add category" });
  }
});

router.put("/categories/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { CategoryName } = req.body || {};
  if (!CategoryName || !CategoryName.trim()) return res.status(400).json({ error: "CategoryName required" });
  try {
    await pool.query(
      `UPDATE ProductCategories SET CategoryName = ? WHERE ProductCategoryID = ? AND CompanyID = ?`,
      [CategoryName.trim(), id, companyId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    await pool.query(
      `DELETE FROM ProductCategories WHERE ProductCategoryID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

router.get("/units", async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT UnitID, UnitName, Abbreviation FROM UnitsOfMeasure ORDER BY UnitName`);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching units:", err);
    res.status(500).json({ error: "Failed to fetch units" });
  }
});

router.post("/units", async (req, res) => {
  const { UnitName, Abbreviation } = req.body || {};
  if (!UnitName || !UnitName.trim()) return res.status(400).json({ error: "UnitName required" });
  const abbrev = (Abbreviation && Abbreviation.trim()) || UnitName.trim().slice(0, 5).toUpperCase();
  try {
    const [ins] = await pool.query(
      `INSERT INTO UnitsOfMeasure (UnitName, Abbreviation) VALUES (?, ?)`,
      [UnitName.trim(), abbrev]
    );
    res.status(201).json({ UnitID: ins.insertId, UnitName: UnitName.trim(), Abbreviation: abbrev });
  } catch (err) {
    console.error("Error adding unit:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Unit name or abbreviation already exists" });
    }
    res.status(500).json({ error: "Failed to add unit" });
  }
});

router.put("/units/:id", async (req, res) => {
  const { id } = req.params;
  const { UnitName, Abbreviation } = req.body || {};
  if (!UnitName || !UnitName.trim()) return res.status(400).json({ error: "UnitName required" });
  const abbrev = (Abbreviation && Abbreviation.trim()) || UnitName.trim().slice(0, 5).toUpperCase();
  try {
    await pool.query(`UPDATE UnitsOfMeasure SET UnitName = ?, Abbreviation = ? WHERE UnitID = ?`, [
      UnitName.trim(),
      abbrev,
      id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating unit:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Unit name or abbreviation already exists" });
    }
    res.status(500).json({ error: "Failed to update unit" });
  }
});

router.delete("/units/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM UnitsOfMeasure WHERE UnitID = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting unit:", err);
    res.status(500).json({ error: "Failed to delete unit" });
  }
});

// Warehouses
router.get("/warehouses", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const [rows] = await pool.query(
      `SELECT WarehouseID, WarehouseName, AddressLine1, City, IsDefault, IsActive, CreatedAt
         FROM Warehouses 
        WHERE CompanyID = ? 
        ORDER BY WarehouseName`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching warehouses:", err);
    res.status(500).json({ error: "Failed to fetch warehouses" });
  }
});

router.post("/warehouses", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { WarehouseName, AddressLine1 = null, City = null, IsDefault, IsActive } = req.body || {};
  if (!WarehouseName || !WarehouseName.trim()) return res.status(400).json({ error: "WarehouseName required" });
  const isDefault = toBoolFlag(IsDefault, 0);
  const isActive = toBoolFlag(IsActive, 1);
  try {
    const [ins] = await pool.query(
      `INSERT INTO Warehouses (CompanyID, WarehouseName, AddressLine1, City, IsDefault, IsActive) VALUES (?, ?, ?, ?, ?, ?)`,
      [companyId, WarehouseName.trim(), AddressLine1, City, isDefault, isActive]
    );
    res.status(201).json({
      WarehouseID: ins.insertId,
      WarehouseName: WarehouseName.trim(),
      AddressLine1,
      City,
      IsDefault: isDefault,
      IsActive: isActive,
    });
  } catch (err) {
    console.error("Error adding warehouse:", err);
    res.status(500).json({ error: "Failed to add warehouse" });
  }
});

router.put("/warehouses/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { WarehouseName, AddressLine1 = null, City = null, IsDefault, IsActive } = req.body || {};
  if (!WarehouseName || !WarehouseName.trim()) return res.status(400).json({ error: "WarehouseName required" });
  const isDefault = toBoolFlag(IsDefault, 0);
  const isActive = toBoolFlag(IsActive, 1);
  try {
    await pool.query(
      `UPDATE Warehouses 
          SET WarehouseName = ?, AddressLine1 = ?, City = ?, IsDefault = ?, IsActive = ?
        WHERE WarehouseID = ? AND CompanyID = ?`,
      [WarehouseName.trim(), AddressLine1, City, isDefault, isActive, id, companyId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating warehouse:", err);
    res.status(500).json({ error: "Failed to update warehouse" });
  }
});

router.delete("/warehouses/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM Warehouses WHERE WarehouseID = ? AND CompanyID = ?`, [id, companyId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting warehouse:", err);
    res.status(500).json({ error: "Failed to delete warehouse" });
  }
});

// GET /api/products/export?format=csv|xlsx&cols=...&q=&category=&type=
router.get("/export", async (req, res) => {
  const companyId = req.user.CompanyID;
  const format = (req.query.format || "csv").toLowerCase();
  const search = (req.query.q || "").trim();
  const categoryFilter = req.query.category || "";
  const typeFilter = req.query.type || "all";
  const colsParam = (req.query.cols || "").split(",").map((c) => c.trim()).filter(Boolean);

  const allowedCols = {
    ProductName: "p.ProductName",
    SKU: "p.SKU",
    CategoryName: "c.CategoryName",
    BrandName: "b.BrandName",
    UnitName: "u.UnitName",
    WeightUnitName: "wu.UnitName",
    PrimaryImageURL: `(SELECT pi.ImageUrl FROM ProductImages pi WHERE pi.ProductID = p.ProductID ORDER BY pi.IsPrimary DESC, pi.ProductImageID ASC LIMIT 1)`,
    AllImages: `(SELECT GROUP_CONCAT(pi.ImageUrl SEPARATOR '|') FROM ProductImages pi WHERE pi.ProductID = p.ProductID ORDER BY pi.IsPrimary DESC, pi.ProductImageID ASC)`,
    SellingPrice: "p.SellingPrice",
    CostPrice: "p.CostPrice",
    IsTaxable: "p.IsTaxable",
    IsService: "p.IsService",
    Description: "p.Description",
    Weight: "p.Weight",
    WeightUnitName: "wu.UnitName",
    Length: "p.Length",
    Width: "p.Width",
    Height: "p.Height",
    DimensionUnitName: "du.UnitName",
    Barcode: "p.Barcode",
    IsActive: "p.IsActive",
    CreatedAt: "p.CreatedAt",
    UpdatedAt: "p.UpdatedAt",
  };
  const selectedCols = colsParam.length
    ? colsParam.filter((c) => allowedCols[c])
    : ["ProductName", "SKU", "CategoryName", "BrandName", "SellingPrice", "IsActive"];

  if (selectedCols.length === 0) {
    return res.status(400).json({ error: "No valid columns selected" });
  }

  try {
    const params = [companyId];
    let whereClause = "WHERE p.CompanyID = ?";
    if (search) {
      const like = `%${search}%`;
      whereClause += " AND (p.ProductName LIKE ? OR p.SKU LIKE ? OR p.Barcode LIKE ?)";
      params.push(like, like, like);
    }
    if (categoryFilter) {
      whereClause += " AND p.ProductCategoryID = ?";
      params.push(categoryFilter);
    }
    if (typeFilter === "active") whereClause += " AND p.IsActive = 1";
    if (typeFilter === "inactive") whereClause += " AND p.IsActive = 0";

    const selectList = selectedCols.map((col) => `${allowedCols[col]} AS ${col}`).join(", ");
    const [rows] = await pool.query(
      `SELECT ${selectList}
       FROM Products p
       LEFT JOIN ProductCategories c ON p.ProductCategoryID = c.ProductCategoryID
       LEFT JOIN ProductBrands b ON p.ProductBrandID = b.ProductBrandID
       LEFT JOIN UnitsOfMeasure u ON p.UnitID = u.UnitID
       LEFT JOIN UnitsOfMeasure wu ON p.WeightUnitID = wu.UnitID
       LEFT JOIN UnitsOfMeasure du ON p.DimensionUnitID = du.UnitID
       LEFT JOIN TaxRates tr ON tr.TaxRateID = p.TaxRateID
       ${whereClause}
       ORDER BY p.ProductName
       LIMIT 5000`,
      params
    );

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Products");
      ws.addRow(selectedCols);
      rows.forEach((row) => ws.addRow(selectedCols.map((col) => row[col])));
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=\"products.xlsx\"");
      return res.send(Buffer.from(buffer));
    }

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (/["\n,]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const header = selectedCols.join(",");
    const body = rows.map((row) => selectedCols.map((c) => escapeCsv(row[c])).join(",")).join("\n");
    const csv = `${header}\n${body}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"products.csv\"");
    res.send(csv);
  } catch (err) {
    console.error("Error exporting products:", err);
    res.status(500).json({ error: "Failed to export products" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
         p.ProductID,
         p.CompanyID,
         p.SKU,
         p.ProductName,
         p.Description,
         p.ProductCategoryID,
         p.ProductBrandID,
         p.UnitID,
         p.CostPrice,
         p.SellingPrice,
         p.IsTaxable,
         p.TaxRateID,
         tr.Name AS TaxRateName,
         tr.RatePercentage AS TaxRatePercentage,
         p.IsService,
         p.Weight,
         p.WeightUnitID,
         p.Length,
         p.Width,
         p.Height,
         p.DimensionUnitID,
         p.ImageURL,
         p.Barcode,
         p.IsActive,
         p.CreatedAt,
         p.UpdatedAt,
         (
           SELECT pi.ImageUrl
           FROM ProductImages pi
           WHERE pi.ProductID = p.ProductID
           ORDER BY pi.IsPrimary DESC, pi.ProductImageID ASC
           LIMIT 1
         ) AS PrimaryImageURL
       FROM Products p
       LEFT JOIN TaxRates tr ON tr.TaxRateID = p.TaxRateID
       WHERE p.ProductID = ? AND p.CompanyID = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// GET product images
router.get("/:id/images", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    const [prod] = await pool.query(
      `SELECT ProductID FROM Products WHERE ProductID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (prod.length === 0) return res.status(404).json({ error: "Product not found" });

    const [rows] = await pool.query(
      `SELECT ProductImageID, ImageUrl, AltText, IsPrimary
       FROM ProductImages
       WHERE ProductID = ?
       ORDER BY IsPrimary DESC, ProductImageID ASC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching product images:", err);
    res.status(500).json({ error: "Failed to fetch product images" });
  }
});

// POST add product image
router.post("/:id/images", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { ImageUrl, AltText, IsPrimary } = req.body || {};
  if (!ImageUrl) return res.status(400).json({ error: "ImageUrl is required" });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [prod] = await conn.query(
      `SELECT ProductID FROM Products WHERE ProductID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (prod.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Product not found" });
    }

    let nonPrimaryValue = 2;
    const [[maxRow]] = await conn.query(
      `SELECT IFNULL(MAX(IsPrimary),1) AS MaxVal FROM ProductImages WHERE ProductID = ?`,
      [id]
    );
    nonPrimaryValue = (maxRow?.MaxVal || 1) + 1;

    const [insertRes] = await conn.query(
      `INSERT INTO ProductImages (ProductID, ImageUrl, AltText, IsPrimary)
       VALUES (?, ?, ?, ?)`,
      [id, ImageUrl, AltText || null, IsPrimary ? 1 : nonPrimaryValue]
    );

    if (IsPrimary) {
      await setPrimaryImage(id, insertRes.insertId, conn);
    }

    await conn.commit();
    const [row] = await conn.query(
      `SELECT ProductImageID, ImageUrl, AltText, IsPrimary
       FROM ProductImages WHERE ProductImageID = ?`,
      [insertRes.insertId]
    );
    res.status(201).json(row[0]);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error adding product image:", err);
    res.status(500).json({ error: "Failed to add product image" });
  } finally {
    if (conn) conn.release();
  }
});

// PUT update product image (primary/alt)
router.put("/:id/images/:imageId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id, imageId } = req.params;
  const { AltText, IsPrimary } = req.body || {};
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [prod] = await conn.query(
      `SELECT ProductID FROM Products WHERE ProductID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (prod.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Product not found" });
    }

    const [img] = await conn.query(
      `SELECT ProductImageID FROM ProductImages WHERE ProductImageID = ? AND ProductID = ?`,
      [imageId, id]
    );
    if (img.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Image not found" });
    }

    if (AltText !== undefined) {
      await conn.query(
        `UPDATE ProductImages SET AltText = ? WHERE ProductImageID = ?`,
        [AltText || null, imageId]
      );
    }
    if (IsPrimary) {
      await setPrimaryImage(id, imageId, conn);
    }

    await conn.commit();
    const [row] = await conn.query(
      `SELECT ProductImageID, ImageUrl, AltText, IsPrimary
       FROM ProductImages WHERE ProductImageID = ?`,
      [imageId]
    );
    res.json(row[0]);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error updating product image:", err);
    res.status(500).json({ error: "Failed to update product image" });
  } finally {
    if (conn) conn.release();
  }
});

// DELETE product image
router.delete("/:id/images/:imageId", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id, imageId } = req.params;
  try {
    const [prod] = await pool.query(
      `SELECT ProductID FROM Products WHERE ProductID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (prod.length === 0) return res.status(404).json({ error: "Product not found" });

    const [result] = await pool.query(
      `DELETE FROM ProductImages WHERE ProductImageID = ? AND ProductID = ?`,
      [imageId, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Image not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting product image:", err);
    res.status(500).json({ error: "Failed to delete product image" });
  }
});

// GET /api/products/export?format=csv|xlsx&cols=...&q=&category=&type=
router.get("/export", async (req, res) => {
  const companyId = req.user.CompanyID;
  const format = (req.query.format || "csv").toLowerCase();
  const search = (req.query.q || "").trim();
  const categoryFilter = req.query.category || "";
  const typeFilter = req.query.type || "all";
  const colsParam = (req.query.cols || "").split(",").map((c) => c.trim()).filter(Boolean);

  const allowedCols = {
    ProductName: "p.ProductName",
    SKU: "p.SKU",
    CategoryName: "c.CategoryName",
    BrandName: "b.BrandName",
    UnitName: "u.UnitName",
    WeightUnitName: "wu.UnitName",
    SellingPrice: "p.SellingPrice",
    CostPrice: "p.CostPrice",
    IsTaxable: "p.IsTaxable",
    IsService: "p.IsService",
    Barcode: "p.Barcode",
    IsActive: "p.IsActive",
    CreatedAt: "p.CreatedAt",
    UpdatedAt: "p.UpdatedAt",
    PrimaryImageURL: `(SELECT pi.ImageUrl FROM ProductImages pi WHERE pi.ProductID = p.ProductID ORDER BY pi.IsPrimary DESC, pi.ProductImageID ASC LIMIT 1)`,
    DimensionUnitName: "du.UnitName",
    TaxRateName: "tr.Name",
    TaxRatePercentage: "tr.RatePercentage",
  };
  const selectedCols = colsParam.length
    ? colsParam.filter((c) => allowedCols[c])
    : ["ProductName", "SKU", "CategoryName", "BrandName", "SellingPrice", "IsActive"];

  if (selectedCols.length === 0) {
    return res.status(400).json({ error: "No valid columns selected" });
  }

  try {
    const params = [companyId];
    let whereClause = "WHERE p.CompanyID = ?";
    if (search) {
      const like = `%${search}%`;
      whereClause += " AND (p.ProductName LIKE ? OR p.SKU LIKE ? OR p.Barcode LIKE ?)";
      params.push(like, like, like);
    }
    if (categoryFilter) {
      whereClause += " AND p.ProductCategoryID = ?";
      params.push(categoryFilter);
    }
    if (typeFilter === "active") whereClause += " AND p.IsActive = 1";
    if (typeFilter === "inactive") whereClause += " AND p.IsActive = 0";

    const selectList = selectedCols.map((col) => `${allowedCols[col]} AS ${col}`).join(", ");
    const [rows] = await pool.query(
      `SELECT ${selectList}
       FROM Products p
       LEFT JOIN ProductCategories c ON p.ProductCategoryID = c.ProductCategoryID
       LEFT JOIN ProductBrands b ON p.ProductBrandID = b.ProductBrandID
       LEFT JOIN UnitsOfMeasure u ON p.UnitID = u.UnitID
       LEFT JOIN UnitsOfMeasure wu ON p.WeightUnitID = wu.UnitID
       LEFT JOIN UnitsOfMeasure du ON p.DimensionUnitID = du.UnitID
       ${whereClause}
       ORDER BY p.ProductName
       LIMIT 5000`,
      params
    );

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Products");
      ws.addRow(selectedCols);
      rows.forEach((row) => ws.addRow(selectedCols.map((col) => row[col])));
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=\"products.xlsx\"");
      return res.send(Buffer.from(buffer));
    }

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (/[",\n]/.test(str)) return `"${str.replace(/\"/g, '""')}"`;
      return str;
    };
    const header = selectedCols.join(",");
    const body = rows.map((row) => selectedCols.map((c) => escapeCsv(row[c])).join(",")).join("\n");
    const csv = `${header}\n${body}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"products.csv\"");
    res.send(csv);
  } catch (err) {
    console.error("Error exporting products:", err);
    res.status(500).json({ error: "Failed to export products" });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const {
    SKU,
    ProductName,
    Description,
    ProductCategoryID,
    ProductBrandID,
    UnitID,
    CostPrice,
    SellingPrice,
    IsTaxable,
    TaxRateID,
    IsService,
    Weight,
    WeightUnitID,
    Length,
    Width,
    Height,
    DimensionUnitID,
    ImageURL,
    Barcode,
  } = req.body;

  if (!SKU || !ProductName || !UnitID) {
    return res.status(400).json({
      error: "SKU, ProductName and UnitID are required",
    });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO Products
        (CompanyID, SKU, ProductName, Description,
         ProductCategoryID, ProductBrandID, UnitID,
         CostPrice, SellingPrice, IsTaxable, TaxRateID, IsService,
         Weight, WeightUnitID,
         Length, Width, Height, DimensionUnitID,
         ImageURL, Barcode, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        companyId,
        SKU,
        ProductName,
        Description || null,
        ProductCategoryID || null,
        ProductBrandID || null,
        UnitID,
        CostPrice ?? 0,
        SellingPrice ?? 0,
        IsTaxable ?? 1,
        TaxRateID || null,
        IsService ?? 0,
        Weight || null,
        WeightUnitID || null,
        Length || null,
        Width || null,
        Height || null,
        DimensionUnitID || null,
        ImageURL || null,
        Barcode || null,
      ]
    );

    const [rows] = await pool.query(
      `SELECT
         ProductID,
         CompanyID,
         SKU,
         ProductName,
         Description,
         ProductCategoryID,
        ProductBrandID,
        UnitID,
        CostPrice,
        SellingPrice,
        IsTaxable,
        TaxRateID,
        IsService,
        Weight,
        WeightUnitID,
        Length,
        Width,
        Height,
        DimensionUnitID,
        ImageURL,
        Barcode,
        IsActive,
        CreatedAt,
        UpdatedAt
       FROM Products
       WHERE ProductID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating product:", err);
    // might be UNIQUE on (CompanyID, SKU)
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const {
    SKU,
    ProductName,
    Description,
    ProductCategoryID,
    ProductBrandID,
    UnitID,
    CostPrice,
    SellingPrice,
    IsTaxable,
    TaxRateID,
    IsService,
    Weight,
    WeightUnitID,
    Length,
    Width,
    Height,
    DimensionUnitID,
    ImageURL,
    Barcode,
    IsActive,
  } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE Products
       SET
         SKU = ?,
         ProductName = ?,
         Description = ?,
         ProductCategoryID = ?,
         ProductBrandID = ?,
         UnitID = ?,
         CostPrice = ?,
         SellingPrice = ?,
         IsTaxable = ?,
         TaxRateID = ?,
         IsService = ?,
         Weight = ?,
         WeightUnitID = ?,
         Length = ?,
         Width = ?,
         Height = ?,
         DimensionUnitID = ?,
         ImageURL = ?,
         Barcode = ?,
         IsActive = ?
       WHERE ProductID = ? AND CompanyID = ?`,
      [
        SKU,
        ProductName,
        Description || null,
        ProductCategoryID || null,
        ProductBrandID || null,
        UnitID,
        CostPrice ?? 0,
        SellingPrice ?? 0,
        IsTaxable ?? 1,
        TaxRateID || null,
        IsService ?? 0,
        Weight || null,
        WeightUnitID || null,
        Length || null,
        Width || null,
        Height || null,
        DimensionUnitID || null,
        ImageURL || null,
        Barcode || null,
        IsActive ?? 1,
        id,
        companyId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const [rows] = await pool.query(
      `SELECT
         ProductID,
         CompanyID,
         SKU,
         ProductName,
         Description,
         ProductCategoryID,
         ProductBrandID,
         UnitID,
         CostPrice,
         SellingPrice,
         IsTaxable,
         IsService,
         Weight,
         WeightUnitID,
         Length,
         Width,
         Height,
         DimensionUnitID,
         ImageURL,
         Barcode,
         IsActive,
         CreatedAt,
         UpdatedAt
       FROM Products
       WHERE ProductID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /api/products/:id -> soft delete
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE Products
       SET IsActive = 0
       WHERE ProductID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product deactivated" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

module.exports = router;
const toBoolFlag = (val, defaultVal = 0) => {
  if (val === undefined || val === null || val === "") return defaultVal;
  const s = String(val).toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return 1;
  if (s === "0" || s === "false" || s === "no") return 0;
  return defaultVal;
};
