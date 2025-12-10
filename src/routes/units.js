const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /api/units -> list all active units
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT UnitID, UnitName, Abbreviation, IsActive
       FROM UnitsOfMeasure
       ORDER BY UnitName`
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching units:", err);
    res.status(500).json({ error: "Failed to fetch units" });
  }
});

// POST /api/units -> create unit
router.post("/", async (req, res) => {
  const { UnitName, Abbreviation } = req.body;

  if (!UnitName || !Abbreviation) {
    return res
      .status(400)
      .json({ error: "UnitName and Abbreviation are required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO UnitsOfMeasure (UnitName, Abbreviation, IsActive)
       VALUES (?, ?, 1)`,
      [UnitName, Abbreviation]
    );

    const [rows] = await pool.query(
      `SELECT UnitID, UnitName, Abbreviation, IsActive
       FROM UnitsOfMeasure
       WHERE UnitID = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating unit:", err);
    res.status(500).json({ error: "Failed to create unit" });
  }
});

module.exports = router;
