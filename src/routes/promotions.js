const express = require("express");
const router = express.Router();
const { pool } = require("../db");

const parseArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => String(v)).filter(Boolean);
  return String(val)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

const buildScopesPayload = (scope = {}) => {
  const entries = [];
  const push = (type, list) => {
    parseArray(list).forEach((value) => entries.push({ type, value }));
  };
  push("category", scope.categories);
  push("product", scope.products);
  push("brand", scope.brands);
  push("customer", scope.customers);
  push("employee", scope.employees);
  push("custom_field", scope.customFields);
  push("channel", scope.channels);
  push("day", scope.days);
  return entries;
};

const shapePromotion = (row, scopeMap) => {
  const scopes = scopeMap.get(row.PromotionID) || {};
  return {
    id: row.PromotionID,
    name: row.Name,
    code: row.Code,
    description: row.Description,
    type: row.Type,
    value: Number(row.Value),
    unitPrice: row.UnitPrice !== undefined ? Number(row.UnitPrice) : null,
    enabled: !!row.Enabled,
    stackable: !!row.Stackable,
    priority: row.Priority,
    minQuantity: row.MinQuantity,
    perOrderLimit: row.PerOrderLimit,
    perCustomerLimit: row.PerCustomerLimit,
    totalRedemptions: row.TotalRedemptions,
    startAt: row.StartAt,
    endAt: row.EndAt,
    timezone: row.Timezone,
    scopes,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
};

router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  try {
    const [promos] = await pool.query(
      `SELECT *
       FROM promotions
       WHERE CompanyID = ?
       ORDER BY Priority DESC, Name`,
      [companyId]
    );

    const ids = promos.map((p) => p.PromotionID);
    const scopeMap = new Map();
    if (ids.length) {
      const [scopes] = await pool.query(
        `SELECT PromotionID, ScopeType, ScopeValue
         FROM promotion_scopes
         WHERE PromotionID IN (${ids.map(() => "?").join(",")})`,
        ids
      );
      scopes.forEach((row) => {
        if (!scopeMap.has(row.PromotionID)) {
          scopeMap.set(row.PromotionID, {
            categories: [],
            products: [],
            customers: [],
            brands: [],
            employees: [],
            customFields: [],
            channels: [],
            days: [],
          });
        }
        const bucket = scopeMap.get(row.PromotionID);
        switch (row.ScopeType) {
          case "category":
            bucket.categories.push(row.ScopeValue);
            break;
          case "product":
            bucket.products.push(row.ScopeValue);
            break;
          case "brand":
            bucket.brands.push(row.ScopeValue);
            break;
          case "customer":
            bucket.customers.push(row.ScopeValue);
            break;
          case "employee":
            bucket.employees.push(row.ScopeValue);
            break;
          case "custom_field":
            bucket.customFields.push(row.ScopeValue);
            break;
          case "channel":
            bucket.channels.push(row.ScopeValue);
            break;
          case "day":
            bucket.days.push(row.ScopeValue);
            break;
          default:
            break;
        }
      });
    }

    res.json(promos.map((p) => shapePromotion(p, scopeMap)));
  } catch (err) {
    console.error("Error fetching promotions", err);
    res.status(500).json({ error: "Failed to fetch promotions" });
  }
});

router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const body = req.body || {};
  const name = (body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required" });

  const code = body.code ? String(body.code).trim() : null;
  const type = body.type || "percent";
  const value = body.value ?? 0;
  const unitPrice =
    body.unitPrice === "" || body.unitPrice === undefined || body.unitPrice === null
      ? null
      : Number(body.unitPrice);
  const description = body.description || null;
  const enabled = body.enabled === undefined ? true : !!body.enabled;
  const stackable = body.stackable === undefined ? true : !!body.stackable;
  const priority = body.priority ?? 100;
  const minQuantity = body.minQuantity ?? null;
  const perOrderLimit = body.perOrderLimit ?? null;
  const perCustomerLimit = body.perCustomerLimit ?? null;
  const totalRedemptions = body.totalRedemptions ?? null;
  const startAt = body.startAt || null;
  const endAt = body.endAt || null;
  const timezone = body.timezone || null;
  const scopes = buildScopesPayload(body.scopes || {});

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [insert] = await conn.query(
      `INSERT INTO promotions
       (CompanyID, Name, Code, Description, Type, Value, UnitPrice, Enabled, Stackable, Priority, MinQuantity,
        PerOrderLimit, PerCustomerLimit, TotalRedemptions, StartAt, EndAt, Timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        name,
        code || null,
        description,
        type,
        value,
        unitPrice,
        enabled ? 1 : 0,
        stackable ? 1 : 0,
        priority,
        minQuantity,
        perOrderLimit,
        perCustomerLimit,
        totalRedemptions,
        startAt,
        endAt,
        timezone,
      ]
    );
    const promoId = insert.insertId;

    if (scopes.length) {
      const values = scopes.map((s) => [promoId, s.type, s.value]);
      await conn.query(
        `INSERT INTO promotion_scopes (PromotionID, ScopeType, ScopeValue)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();

    const [row] = await conn.query(`SELECT * FROM promotions WHERE PromotionID = ?`, [promoId]);
    const [scopeRows] = await conn.query(
      `SELECT PromotionID, ScopeType, ScopeValue FROM promotion_scopes WHERE PromotionID = ?`,
      [promoId]
    );
    const scopeMap = new Map([[promoId, {
      categories: [],
      products: [],
      customers: [],
      brands: [],
      employees: [],
      customFields: [],
      channels: [],
      days: [],
    }]]);
    scopeRows.forEach((s) => {
      const bucket = scopeMap.get(promoId);
      switch (s.ScopeType) {
        case "category":
          bucket.categories.push(s.ScopeValue);
          break;
        case "product":
          bucket.products.push(s.ScopeValue);
          break;
        case "brand":
          bucket.brands.push(s.ScopeValue);
          break;
        case "customer":
          bucket.customers.push(s.ScopeValue);
          break;
        case "employee":
          bucket.employees.push(s.ScopeValue);
          break;
        case "custom_field":
          bucket.customFields.push(s.ScopeValue);
          break;
        case "channel":
          bucket.channels.push(s.ScopeValue);
          break;
        case "day":
          bucket.days.push(s.ScopeValue);
          break;
        default:
          break;
      }
    });

    res.status(201).json(shapePromotion(row[0], scopeMap));
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error creating promotion", err);
    res.status(500).json({ error: "Failed to create promotion" });
  } finally {
    if (conn) conn.release();
  }
});

router.patch("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const body = req.body || {};
  const incomingUnitPrice =
    body.unitPrice === "" || body.unitPrice === undefined || body.unitPrice === null
      ? null
      : Number(body.unitPrice);

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query(
      `SELECT * FROM promotions WHERE PromotionID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Promotion not found" });
    }

    const updates = {
      Name: body.name !== undefined ? body.name : existing[0].Name,
      Code: body.code !== undefined ? body.code : existing[0].Code,
      Description: body.description !== undefined ? body.description : existing[0].Description,
      Type: body.type !== undefined ? body.type : existing[0].Type,
      Value: body.value !== undefined ? body.value : existing[0].Value,
      UnitPrice:
        body.unitPrice !== undefined
          ? incomingUnitPrice
          : existing[0].UnitPrice !== undefined
          ? existing[0].UnitPrice
          : null,
      Enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing[0].Enabled,
      Stackable: body.stackable !== undefined ? (body.stackable ? 1 : 0) : existing[0].Stackable,
      Priority: body.priority !== undefined ? body.priority : existing[0].Priority,
      MinQuantity: body.minQuantity !== undefined ? body.minQuantity : existing[0].MinQuantity,
      PerOrderLimit:
        body.perOrderLimit !== undefined ? body.perOrderLimit : existing[0].PerOrderLimit,
      PerCustomerLimit:
        body.perCustomerLimit !== undefined ? body.perCustomerLimit : existing[0].PerCustomerLimit,
      TotalRedemptions:
        body.totalRedemptions !== undefined ? body.totalRedemptions : existing[0].TotalRedemptions,
      StartAt: body.startAt !== undefined ? body.startAt : existing[0].StartAt,
      EndAt: body.endAt !== undefined ? body.endAt : existing[0].EndAt,
      Timezone: body.timezone !== undefined ? body.timezone : existing[0].Timezone,
    };

    await conn.query(
      `UPDATE promotions
       SET Name = ?, Code = ?, Description = ?, Type = ?, Value = ?, UnitPrice = ?, Enabled = ?, Stackable = ?, Priority = ?,
           MinQuantity = ?, PerOrderLimit = ?, PerCustomerLimit = ?, TotalRedemptions = ?, StartAt = ?, EndAt = ?, Timezone = ?
       WHERE PromotionID = ? AND CompanyID = ?`,
      [
        updates.Name,
        updates.Code,
        updates.Description,
        updates.Type,
        updates.Value,
        updates.UnitPrice,
        updates.Enabled,
        updates.Stackable,
        updates.Priority,
        updates.MinQuantity,
        updates.PerOrderLimit,
        updates.PerCustomerLimit,
        updates.TotalRedemptions,
        updates.StartAt,
        updates.EndAt,
        updates.Timezone,
        id,
        companyId,
      ]
    );

    if (body.scopes) {
      await conn.query(`DELETE FROM promotion_scopes WHERE PromotionID = ?`, [id]);
      const scopes = buildScopesPayload(body.scopes);
      if (scopes.length) {
        await conn.query(
          `INSERT INTO promotion_scopes (PromotionID, ScopeType, ScopeValue) VALUES ?`,
          [scopes.map((s) => [id, s.type, s.value])]
        );
      }
    }

    await conn.commit();

    const [row] = await conn.query(`SELECT * FROM promotions WHERE PromotionID = ?`, [id]);
    const [scopeRows] = await conn.query(
      `SELECT PromotionID, ScopeType, ScopeValue FROM promotion_scopes WHERE PromotionID = ?`,
      [id]
    );
    const scopeMap = new Map([[Number(id), {
      categories: [],
      products: [],
      customers: [],
      brands: [],
      employees: [],
      customFields: [],
      channels: [],
      days: [],
    }]]);
    scopeRows.forEach((s) => {
      const bucket = scopeMap.get(Number(id));
      switch (s.ScopeType) {
        case "category":
          bucket.categories.push(s.ScopeValue);
          break;
        case "product":
          bucket.products.push(s.ScopeValue);
          break;
        case "brand":
          bucket.brands.push(s.ScopeValue);
          break;
        case "customer":
          bucket.customers.push(s.ScopeValue);
          break;
        case "employee":
          bucket.employees.push(s.ScopeValue);
          break;
        case "custom_field":
          bucket.customFields.push(s.ScopeValue);
          break;
        case "channel":
          bucket.channels.push(s.ScopeValue);
          break;
        case "day":
          bucket.days.push(s.ScopeValue);
          break;
        default:
          break;
      }
    });

    res.json(shapePromotion(row[0], scopeMap));
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error updating promotion", err);
    res.status(500).json({ error: "Failed to update promotion" });
  } finally {
    if (conn) conn.release();
  }
});

router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  try {
    const [existing] = await pool.query(
      `SELECT PromotionID FROM promotions WHERE PromotionID = ? AND CompanyID = ?`,
      [id, companyId]
    );
    if (!existing.length) return res.status(404).json({ error: "Promotion not found" });
    await pool.query(`DELETE FROM promotion_scopes WHERE PromotionID = ?`, [id]);
    await pool.query(`DELETE FROM promotions WHERE PromotionID = ?`, [id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error("Error deleting promotion", err);
    res.status(500).json({ error: "Failed to delete promotion" });
  }
});

module.exports = router;
