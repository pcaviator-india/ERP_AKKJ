const express = require("express");
const router = express.Router();
const { broadcastToScreen } = require("../services/customerScreenHub");

// POST /api/customer-screen/broadcast
router.post("/broadcast", (req, res) => {
  const { channel = "default", payload = {} } = req.body || {};
  broadcastToScreen(channel, payload);
  res.json({ ok: true });
});

module.exports = router;
