const express = require("express");
const router = express.Router();
const { getConfig, updateConfig } = require("../services/configStore");

router.get("/", async (req, res) => {
  try {
    const { CompanyID, EmployeeID } = req.user || {};
    const config = await getConfig(CompanyID, EmployeeID);
    res.json(config);
  } catch (err) {
    console.error("Error loading config:", err);
    res.status(500).json({ error: "Failed to load config" });
  }
});

router.patch("/", async (req, res) => {
  const { updates } = req.body || {};

  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return res
      .status(400)
      .json({ error: "Body must include an 'updates' object" });
  }

  try {
    const { CompanyID, EmployeeID } = req.user || {};
    const config = await updateConfig(CompanyID, EmployeeID, updates);
    res.json(config);
  } catch (err) {
    console.error("Error saving config:", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

module.exports = router;
