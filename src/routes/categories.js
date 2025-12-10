const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/categories -> list by company
router.get("/", async (req, res) => {
  const companyId = req.user.CompanyID;

  try {
    const [rows] = await pool.query(
      `SELECT 
         ProductCategoryID,
         CompanyID,
         CategoryName,
         ParentCategoryID,
         IsActive
       FROM ProductCategories
       WHERE CompanyID = ?
       ORDER BY CategoryName`,
      [companyId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/categories -> create
router.post("/", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { CategoryName, ParentCategoryID } = req.body;

  if (!CategoryName) {
    return res.status(400).json({ error: "CategoryName is required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO ProductCategories 
        (CompanyID, CategoryName, ParentCategoryID, IsActive)
       VALUES (?, ?, ?, 1)`,
      [companyId, CategoryName, ParentCategoryID || null]
    );

    const [rows] = await pool.query(
      `SELECT 
         ProductCategoryID,
         CompanyID,
         CategoryName,
         ParentCategoryID,
         IsActive
       FROM ProductCategories
       WHERE ProductCategoryID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating category:", err);
    // might be UNIQUE constraint on (CompanyID, CategoryName, ParentCategoryID)
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/categories/:id -> update (basic)
router.put("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;
  const { CategoryName, ParentCategoryID, IsActive } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE ProductCategories
       SET 
         CategoryName = ?,
         ParentCategoryID = ?,
         IsActive = ?
       WHERE ProductCategoryID = ? AND CompanyID = ?`,
      [CategoryName, ParentCategoryID || null, IsActive ?? 1, id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const [rows] = await pool.query(
      `SELECT 
         ProductCategoryID,
         CompanyID,
         CategoryName,
         ParentCategoryID,
         IsActive
       FROM ProductCategories
       WHERE ProductCategoryID = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/categories/:id -> soft delete (IsActive = 0)
router.delete("/:id", async (req, res) => {
  const companyId = req.user.CompanyID;
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE ProductCategories
       SET IsActive = 0
       WHERE ProductCategoryID = ? AND CompanyID = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category deactivated" });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

module.exports = router;
