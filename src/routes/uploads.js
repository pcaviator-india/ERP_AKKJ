const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const multer = require("multer");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const ensureUploadDir = async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureUploadDir();
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    const unique = `${Date.now()}_${safeName}`;
    cb(null, unique);
  },
});

const productFileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image uploads are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter: productFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.post("/products", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// Purchases attachments: allow images or PDFs, slightly higher limit
const purchaseFileFilter = (req, file, cb) => {
  const allowed =
    file.mimetype?.startsWith("image/") ||
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/x-pdf";
  if (allowed) {
    cb(null, true);
  } else {
    cb(new Error("Only images or PDF files are allowed"));
  }
};

const purchaseUpload = multer({
  storage,
  fileFilter: purchaseFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post("/purchases", purchaseUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename, mimetype: req.file.mimetype });
  } catch (err) {
    console.error("Upload error (purchases):", err);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

module.exports = router;
