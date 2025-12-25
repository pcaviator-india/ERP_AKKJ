const express = require("express");
const router = express.Router();
const {
  parseChileanInvoice,
  parseChileanInvoiceXML,
} = require("../services/invoiceParser");

// POST /api/ocr/parse-invoice
// Expects: { ocrText: "extracted text from invoice" }
// Returns: parsed invoice data with auto-filled fields
router.post("/parse-invoice", async (req, res) => {
  try {
    const { ocrText } = req.body;

    if (!ocrText || !ocrText.trim()) {
      return res.status(400).json({
        error: "OCR text is required",
        data: null,
      });
    }

    const parsed = parseChileanInvoice(ocrText);

    if (!parsed) {
      return res.status(400).json({
        error: "Failed to parse invoice text",
        data: null,
      });
    }

    res.json({
      success: true,
      data: parsed,
      rawText: ocrText,
    });
  } catch (err) {
    console.error("OCR parsing error:", err);
    res.status(500).json({
      error: "Failed to process OCR data",
      message: err.message,
    });
  }
});

// POST /api/ocr/parse-invoice-with-products
// Enhanced version that matches products from database
// Expects: { ocrText, products: [...] }
router.post("/parse-invoice-with-products", async (req, res) => {
  try {
    const { ocrText, products } = req.body;

    if (!ocrText || !ocrText.trim()) {
      return res.status(400).json({
        error: "OCR text is required",
      });
    }

    const parsed = parseChileanInvoice(ocrText);

    // Try to match items to products by name similarity
    if (Array.isArray(products) && parsed.items.length > 0) {
      parsed.items = parsed.items.map((item) => {
        const matched = findBestProductMatch(item.description, products);
        return {
          ...item,
          ProductID: matched?.ProductID || null,
          ProductName: matched?.ProductName || item.description,
        };
      });
    }

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    console.error("OCR parsing error:", err);
    res.status(500).json({
      error: "Failed to process OCR data",
      message: err.message,
    });
  }
});

// Simple fuzzy match for product names
const findBestProductMatch = (description, products) => {
  if (!description || products.length === 0) return null;

  const descLower = description.toLowerCase().trim();

  // Exact match
  let match = products.find((p) => p.ProductName.toLowerCase() === descLower);
  if (match) return match;

  // Partial match (contains)
  match = products.find(
    (p) =>
      p.ProductName.toLowerCase().includes(descLower) ||
      descLower.includes(p.ProductName.toLowerCase())
  );
  if (match) return match;

  // Levenshtein distance (simple version)
  let bestMatch = null;
  let bestScore = 0;

  products.forEach((p) => {
    const score = calculateSimilarity(descLower, p.ProductName.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  });

  return bestScore > 0.6 ? bestMatch : null;
};

// Simple string similarity (0-1)
const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

// Calculate Levenshtein distance
const getEditDistance = (str1, str2) => {
  const costs = [];

  for (let i = 0; i <= str1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= str2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[str2.length] = lastValue;
  }

  return costs[str2.length];
};

// POST /api/ocr/parse-invoice-xml
// Parse SII XML format (direct, no OCR needed)
// Expects: { xmlContent: "raw XML string" }
// Returns: parsed invoice data with 100% confidence
router.post("/parse-invoice-xml", async (req, res) => {
  try {
    const { xmlContent } = req.body;

    if (!xmlContent || !xmlContent.trim()) {
      return res.status(400).json({
        error: "XML content is required",
        data: null,
      });
    }

    const parsed = parseChileanInvoiceXML(xmlContent);

    if (!parsed) {
      return res.status(400).json({
        error: "Failed to parse XML invoice",
        data: null,
      });
    }

    res.json({
      success: true,
      data: parsed,
      source: "SII_XML", // Indicates direct XML parsing
    });
  } catch (err) {
    console.error("XML parsing error:", err);
    res.status(500).json({
      error: "Failed to process XML",
      message: err.message,
    });
  }
});

module.exports = router;
