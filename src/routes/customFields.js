const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Allowed DataTypes in schema (Select is stored as JSON in DB to satisfy existing check constraint)
const ALLOWED_TYPES = new Set(["Text", "Number", "Boolean", "Date", "JSON", "Select"]);

async function ensurePendingTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS PendingProductCustomFieldValues (
      PendingID BIGINT AUTO_INCREMENT PRIMARY KEY,
      PendingToken VARCHAR(64) NOT NULL,
      ProductCustomFieldDefinitionID INT NOT NULL,
      ValueText LONGTEXT NULL,
      ValueNumber DECIMAL(18,4) NULL,
      ValueBoolean TINYINT(1) NULL,
      ValueDate DATE NULL,
      ValueJSON LONGTEXT NULL,
      CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT UQ_PendingCF UNIQUE (PendingToken, ProductCustomFieldDefinitionID)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function ensureOptionsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ProductCustomFieldOptions (
      OptionID INT AUTO_INCREMENT PRIMARY KEY,
      ProductCustomFieldDefinitionID INT NOT NULL,
      OptionValue VARCHAR(255) NOT NULL,
      CONSTRAINT UQ_CF_Option UNIQUE (ProductCustomFieldDefinitionID, OptionValue),
      CONSTRAINT FK_CF_Option_Def FOREIGN KEY (ProductCustomFieldDefinitionID)
        REFERENCES ProductCustomFieldDefinitions(ProductCustomFieldDefinitionID)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// GET list of product custom fields
router.get("/product", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const conn = await pool.getConnection();
    await ensureOptionsTable(conn);

    const [rows] = await conn.query(
      `SELECT ProductCustomFieldDefinitionID AS id,
              FieldName AS label,
              DataType AS type,
              IsActive AS visible
       FROM ProductCustomFieldDefinitions
       WHERE CompanyID = ?
       ORDER BY FieldName`,
      [companyId]
    );
    const defIds = rows.map((r) => r.id);
    let optionsMap = new Map();
    if (defIds.length) {
      const [opts] = await conn.query(
        `SELECT ProductCustomFieldDefinitionID AS defId, OptionValue
         FROM ProductCustomFieldOptions
         WHERE ProductCustomFieldDefinitionID IN (?)`,
        [defIds]
      );
      optionsMap = opts.reduce((acc, o) => {
        const list = acc.get(o.defId) || [];
        list.push(o.OptionValue);
        acc.set(o.defId, list);
        return acc;
      }, new Map());
    }
    const result = rows.map((r) => ({
      ...r,
      type: r.type === "JSON" ? "Select" : r.type,
      options: optionsMap.get(r.id) || [],
    }));
    conn.release();
    res.json(result);
  } catch (err) {
    console.error("Failed to load custom fields", err);
    res.status(500).json({ error: "Failed to load custom fields" });
  }
});

// Bulk upsert product custom fields
router.post("/product/bulk", async (req, res) => {
  const companyId = req.user.CompanyID;
  const defs = Array.isArray(req.body?.definitions) ? req.body.definitions : [];
  const deletedIds = (Array.isArray(req.body?.deletedIds) ? req.body.deletedIds : [])
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await ensureOptionsTable(conn);

    const resultDefs = [];

    for (const def of defs) {
      const label = (def.label || "").trim();
      if (!label) continue;
      const dataType = ALLOWED_TYPES.has(def.type) ? def.type : "Text";
      const visible = def.visible ? 1 : 0;
      const defId = Number(def.id);
      const hasId = Number.isInteger(defId) && defId > 0;
      const options = Array.isArray(def.options)
        ? def.options.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim())
        : [];
      // Map Select -> JSON for storage to respect existing DB check constraint
      const dbType = dataType === "Select" ? "JSON" : dataType === "JSON" ? "JSON" : dataType;
      if (hasId) {
        await conn.query(
          `UPDATE ProductCustomFieldDefinitions
             SET FieldName = ?, DataType = ?, IsActive = ?
           WHERE ProductCustomFieldDefinitionID = ? AND CompanyID = ?`,
          [label, dbType, visible, defId, companyId]
        );
        await conn.query(
          `DELETE FROM ProductCustomFieldOptions WHERE ProductCustomFieldDefinitionID = ?`,
          [defId]
        );
        if (dataType === "Select" && options.length) {
          const values = options.map((o) => [defId, o]);
          await conn.query(
            `INSERT INTO ProductCustomFieldOptions (ProductCustomFieldDefinitionID, OptionValue)
             VALUES ?`,
            [values]
          );
        }
        resultDefs.push({ id: defId, label, type: dataType, visible, options });
      } else {
        const [insertRes] = await conn.query(
          `INSERT INTO ProductCustomFieldDefinitions
             (CompanyID, FieldName, DataType, IsActive)
           VALUES (?, ?, ?, ?)`,
          [companyId, label, dbType, visible]
        );
        if (dataType === "Select" && options.length) {
          const values = options.map((o) => [insertRes.insertId, o]);
          await conn.query(
            `INSERT INTO ProductCustomFieldOptions (ProductCustomFieldDefinitionID, OptionValue)
             VALUES ?`,
            [values]
          );
        }
        resultDefs.push({
          id: insertRes.insertId,
          label,
          type: dataType,
          visible,
          options,
        });
      }
    }

    if (deletedIds.length > 0) {
      await conn.query(
        `DELETE FROM ProductCustomFieldDefinitions
         WHERE CompanyID = ? AND ProductCustomFieldDefinitionID IN (?)`,
        [companyId, deletedIds]
      );
    }

    await conn.commit();

    res.json({ definitions: resultDefs });
  } catch (err) {
    await conn.rollback();
    console.error("Failed to save custom fields", err);
    res.status(500).json({ error: "Failed to save custom fields" });
  } finally {
    conn.release();
  }
});

// DELETE a product custom field
router.delete("/product/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `DELETE FROM ProductCustomFieldDefinitions
       WHERE ProductCustomFieldDefinitionID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Custom field not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete custom field", err);
    res.status(500).json({ error: "Failed to delete custom field" });
  }
});

// GET values for a product
router.get("/product/values", async (req, res) => {
  const companyId = req.user.CompanyID;
  const productId = Number(req.query.productId);

  if (!productId) {
    return res.status(400).json({ error: "productId is required" });
  }

  try {
    const [prod] = await pool.query(
      "SELECT ProductID FROM Products WHERE ProductID = ? AND CompanyID = ?",
      [productId, companyId]
    );
    if (prod.length === 0) return res.status(404).json({ error: "Product not found" });

    const [rows] = await pool.query(
      `SELECT v.ProductCustomFieldDefinitionID AS definitionId,
              v.ValueText, v.ValueNumber, v.ValueBoolean, v.ValueDate, v.ValueJSON,
              d.DataType
       FROM ProductCustomFieldValues v
       JOIN ProductCustomFieldDefinitions d ON d.ProductCustomFieldDefinitionID = v.ProductCustomFieldDefinitionID
       WHERE v.ProductID = ?`,
      [productId]
    );

    const values = rows.map((r) => ({
      definitionId: r.definitionId,
      value:
        r.ValueText ??
        r.ValueNumber ??
        (r.ValueBoolean === null ? null : Boolean(r.ValueBoolean)) ??
        r.ValueDate ??
        r.ValueJSON ??
        null,
    }));

    res.json(values);
  } catch (err) {
    console.error("Failed to load custom field values", err);
    res.status(500).json({ error: "Failed to load custom field values" });
  }
});

// POST values for a product (upsert/delete)
router.post("/product/values", async (req, res) => {
  const companyId = req.user.CompanyID;
  const productId = Number(req.body?.ProductID);
  const fields = Array.isArray(req.body?.fields) ? req.body.fields : [];

  if (!productId) {
    return res.status(400).json({ error: "ProductID is required" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [prod] = await conn.query(
      "SELECT ProductID FROM Products WHERE ProductID = ? AND CompanyID = ?",
      [productId, companyId]
    );
    if (prod.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Product not found" });
    }

    for (const f of fields) {
      const definitionId = Number(f.definitionId);
      if (!Number.isInteger(definitionId)) continue;

      const [[defRow]] = await conn.query(
        `SELECT ProductCustomFieldDefinitionID, DataType
         FROM ProductCustomFieldDefinitions
         WHERE ProductCustomFieldDefinitionID = ? AND CompanyID = ?`,
        [definitionId, companyId]
      );
      if (!defRow) continue;

      const type = defRow.DataType;
      const val = f.value;
      const payload = {
        ValueText: null,
        ValueNumber: null,
        ValueBoolean: null,
        ValueDate: null,
        ValueJSON: null,
      };

      if (val === null || val === undefined || val === "") {
        await conn.query(
          `DELETE FROM ProductCustomFieldValues
           WHERE ProductID = ? AND ProductCustomFieldDefinitionID = ?`,
          [productId, definitionId]
        );
        continue;
      }

      switch (type) {
        case "Number":
          payload.ValueNumber = Number(val);
          if (Number.isNaN(payload.ValueNumber)) continue;
          break;
        case "Boolean":
          payload.ValueBoolean = val ? 1 : 0;
          break;
        case "Date":
          payload.ValueDate = val;
          break;
        case "JSON":
        case "Select":
          payload.ValueJSON = typeof val === "string" ? val : JSON.stringify(val);
          break;
        default:
          payload.ValueText = String(val);
      }

      await conn.query(
        `INSERT INTO ProductCustomFieldValues
           (ProductID, ProductCustomFieldDefinitionID, ValueText, ValueNumber, ValueBoolean, ValueDate, ValueJSON)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ValueText = VALUES(ValueText),
           ValueNumber = VALUES(ValueNumber),
           ValueBoolean = VALUES(ValueBoolean),
           ValueDate = VALUES(ValueDate),
           ValueJSON = VALUES(ValueJSON)`,
        [
          productId,
          definitionId,
          payload.ValueText,
          payload.ValueNumber,
          payload.ValueBoolean,
          payload.ValueDate,
          payload.ValueJSON,
        ]
      );
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Failed to save custom field values", err);
    res.status(500).json({ error: "Failed to save custom field values" });
  } finally {
    if (conn) conn.release();
  }
});

// Stage values without a product ID
router.post("/product/stage-values", async (req, res) => {
  const fields = Array.isArray(req.body?.fields) ? req.body.fields : [];
  const token = (req.body?.token || "").trim();
  if (!token) {
    return res.status(400).json({ error: "token is required" });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    await ensurePendingTable(conn);
    await conn.beginTransaction();
    // Load definitions to map correct data types
    const definitionIds = fields
      .map((f) => Number(f.definitionId))
      .filter((n) => Number.isInteger(n));
    const [defs] = definitionIds.length
      ? await conn.query(
          `SELECT ProductCustomFieldDefinitionID, DataType
           FROM ProductCustomFieldDefinitions
           WHERE ProductCustomFieldDefinitionID IN (?)`,
          [definitionIds]
        )
      : [[]];
    const typeMap = new Map(defs.map((d) => [d.ProductCustomFieldDefinitionID, d.DataType]));

    for (const f of fields) {
      const definitionId = Number(f.definitionId);
      if (!Number.isInteger(definitionId)) continue;

      const type = typeMap.get(definitionId) || "Text";
      const val = f.value;
      const payload = {
        ValueText: null,
        ValueNumber: null,
        ValueBoolean: null,
        ValueDate: null,
        ValueJSON: null,
      };

      if (val === null || val === undefined || val === "") {
        await conn.query(
          `DELETE FROM PendingProductCustomFieldValues
           WHERE PendingToken = ? AND ProductCustomFieldDefinitionID = ?`,
          [token, definitionId]
        );
        continue;
      }

      switch (type) {
        case "Number":
          payload.ValueNumber = Number(val);
          if (Number.isNaN(payload.ValueNumber)) continue;
          break;
        case "Boolean":
          payload.ValueBoolean = val ? 1 : 0;
          break;
        case "Date":
          payload.ValueDate = val;
          break;
        case "JSON":
        case "Select":
          payload.ValueJSON = Array.isArray(val) ? JSON.stringify(val) : typeof val === "string" ? val : JSON.stringify(val);
          break;
        default:
          payload.ValueText = String(val);
      }

      await conn.query(
        `INSERT INTO PendingProductCustomFieldValues
           (PendingToken, ProductCustomFieldDefinitionID, ValueText, ValueNumber, ValueBoolean, ValueDate, ValueJSON)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ValueText = VALUES(ValueText),
           ValueNumber = VALUES(ValueNumber),
           ValueBoolean = VALUES(ValueBoolean),
           ValueDate = VALUES(ValueDate),
           ValueJSON = VALUES(ValueJSON)`,
        [
          token,
          definitionId,
          payload.ValueText,
          payload.ValueNumber,
          payload.ValueBoolean,
          payload.ValueDate,
          payload.ValueJSON,
        ]
      );
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Failed to stage custom field values", err);
    res.status(500).json({ error: "Failed to stage custom field values" });
  } finally {
    if (conn) conn.release();
  }
});

// Get staged values for a pending token
router.get("/product/stage-values", async (req, res) => {
  const token = (req.query?.token || "").trim();
  if (!token) return res.status(400).json({ error: "token is required" });
  let conn;
  try {
    conn = await pool.getConnection();
    await ensurePendingTable(conn);
    const [rows] = await conn.query(
      `SELECT p.ProductCustomFieldDefinitionID AS definitionId,
              p.ValueText, p.ValueNumber, p.ValueBoolean, p.ValueDate, p.ValueJSON,
              d.DataType
       FROM PendingProductCustomFieldValues p
       JOIN ProductCustomFieldDefinitions d ON d.ProductCustomFieldDefinitionID = p.ProductCustomFieldDefinitionID
       WHERE p.PendingToken = ?`,
      [token]
    );
    const values = rows.map((r) => ({
      definitionId: r.definitionId,
      value:
        r.ValueText ??
        r.ValueNumber ??
        (r.ValueBoolean === null ? null : Boolean(r.ValueBoolean)) ??
        r.ValueDate ??
        r.ValueJSON ??
        null,
    }));
    res.json(values);
  } catch (err) {
    console.error("Failed to load staged custom field values", err);
    res.status(500).json({ error: "Failed to load staged custom field values" });
  } finally {
    if (conn) conn.release();
  }
});

// Attach staged values to a product ID
router.post("/product/attach-staged", async (req, res) => {
  const companyId = req.user.CompanyID;
  const productId = Number(req.body?.ProductID);
  const token = (req.body?.token || "").trim();
  if (!productId || !token) {
    return res.status(400).json({ error: "ProductID and token are required" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await ensurePendingTable(conn);
    await conn.beginTransaction();

    const [prod] = await conn.query(
      "SELECT ProductID FROM Products WHERE ProductID = ? AND CompanyID = ?",
      [productId, companyId]
    );
    if (prod.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Product not found" });
    }

    const [pending] = await conn.query(
      `SELECT ProductCustomFieldDefinitionID, ValueText, ValueNumber, ValueBoolean, ValueDate, ValueJSON
       FROM PendingProductCustomFieldValues
       WHERE PendingToken = ?`,
      [token]
    );

    for (const row of pending) {
      await conn.query(
        `INSERT INTO ProductCustomFieldValues
           (ProductID, ProductCustomFieldDefinitionID, ValueText, ValueNumber, ValueBoolean, ValueDate, ValueJSON)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ValueText = VALUES(ValueText),
           ValueNumber = VALUES(ValueNumber),
           ValueBoolean = VALUES(ValueBoolean),
           ValueDate = VALUES(ValueDate),
           ValueJSON = VALUES(ValueJSON)`,
        [
          productId,
          row.ProductCustomFieldDefinitionID,
          row.ValueText,
          row.ValueNumber,
          row.ValueBoolean,
          row.ValueDate,
          row.ValueJSON,
        ]
      );
    }

    await conn.query(
      `DELETE FROM PendingProductCustomFieldValues WHERE PendingToken = ?`,
      [token]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Failed to attach staged custom field values", err);
    res.status(500).json({ error: "Failed to attach staged custom field values" });
  } finally {
    if (conn) conn.release();
  }
});
module.exports = router;
