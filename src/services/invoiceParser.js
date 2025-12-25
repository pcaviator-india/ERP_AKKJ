// Invoice parser utility for Chilean invoices
// Handles FACTURA, BOLETA, GUIA DESPACHO formats

const parseChileanInvoice = (ocrText) => {
  if (!ocrText) return null;

  const result = {
    supplierName: null,
    supplierRut: null,
    invoiceNumber: null,
    invoiceDate: null,
    items: [],
    totalAmount: null,
    taxAmount: null,
    netAmount: null,
    confidence: 0,
  };

  // Normalize text
  const text = ocrText.toUpperCase();
  const lines = ocrText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);

  // 1. Extract Supplier Name & RUT (Pattern: "Company Name\nRUT: XX.XXX.XXX-X")
  const rutMatch = text.match(/RUT[:\s]+(\d{2,3}\.\d{3}\.\d{3}-[\d\dK])/i);
  if (rutMatch) {
    result.supplierRut = rutMatch[1];
    // Find supplier name (usually above RUT)
    const rutLineIndex = lines.findIndex((l) => l.includes("RUT"));
    if (rutLineIndex > 0) {
      result.supplierName = lines[rutLineIndex - 1] || lines[rutLineIndex - 2];
    }
  }

  // 2. Extract Invoice Number (Pattern: "N°XXXXX" or "Nº XXXXX" or "FACTURA N°XXXXX")
  const invoiceMatch = text.match(/N[°º]?\s*(\d{4,6})/);
  if (invoiceMatch) {
    result.invoiceNumber = invoiceMatch[1];
  }

  // 3. Extract Invoice Date (Pattern: "DD de Month del YYYY" or "DD/MM/YYYY")
  const dateMatch =
    ocrText.match(/(\d{1,2})\s+de\s+(\w+)\s+del?\s+(\d{4})/i) ||
    ocrText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    if (dateMatch[2] && isNaN(dateMatch[2])) {
      // Text format: "20 de Febrero del 2025"
      const monthNames = {
        enero: "01",
        febrero: "02",
        marzo: "03",
        abril: "04",
        mayo: "05",
        junio: "06",
        julio: "07",
        agosto: "08",
        septiembre: "09",
        octubre: "10",
        noviembre: "11",
        diciembre: "12",
      };
      const day = String(dateMatch[1]).padStart(2, "0");
      const month = monthNames[dateMatch[2].toLowerCase()] || "01";
      const year = dateMatch[3];
      result.invoiceDate = `${year}-${month}-${day}`;
    } else {
      // Numeric format: "20/02/2025"
      const day = String(dateMatch[1]).padStart(2, "0");
      const month = String(dateMatch[2]).padStart(2, "0");
      const year = dateMatch[3];
      result.invoiceDate = `${year}-${month}-${day}`;
    }
  }

  // 4. Extract Items (from table with Codigo, Descripcion, Cantidad, Precio, etc.)
  // Look for table rows with product info
  const items = extractItemsFromTable(lines);
  result.items = items;

  // 5. Extract Totals (MONTO NETO, I.V.A., TOTAL)
  const netMatch = text.match(/MONTO\s+NETO\s*\$?\s*([\d.,]+)/i);
  if (netMatch) {
    result.netAmount = parseChileanCurrency(netMatch[1]);
  }

  const taxMatch = text.match(/I\.?V\.?A\.?\s*(?:19%)?\s*\$?\s*([\d.,]+)/i);
  if (taxMatch) {
    result.taxAmount = parseChileanCurrency(taxMatch[1]);
  }

  const totalMatch = text.match(/TOTAL\s*\$?\s*([\d.,]+)/i);
  if (totalMatch) {
    result.totalAmount = parseChileanCurrency(totalMatch[1]);
  }

  // If no total found, calculate it
  if (!result.totalAmount && result.netAmount && result.taxAmount) {
    result.totalAmount = result.netAmount + result.taxAmount;
  }

  // Calculate confidence score
  result.confidence = calculateConfidence(result);

  return result;
};

const extractItemsFromTable = (lines) => {
  const items = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect table header
    if (
      /codigo|descripcion|cantidad|precio|valor/i.test(line) &&
      line.length > 20
    ) {
      inTable = true;
      continue;
    }

    // Exit table on totals row
    if (/MONTO|TOTAL|I\.V\.A|IMPUESTO/i.test(line)) {
      inTable = false;
      continue;
    }

    // Parse table rows
    if (inTable && line.length > 15) {
      const item = parseItemRow(line);
      if (item.description) {
        items.push(item);
      }
    }
  }

  return items;
};

const parseItemRow = (line) => {
  // Pattern: "VELA LISA NARANJA 1.7X18    2    48.320    96.640"
  // or: "Codigo  Descripcion  Cantidad  Precio  Descuento  Valor"

  const item = {
    description: "",
    quantity: 0,
    unitPrice: 0,
    totalPrice: 0,
  };

  // Split by multiple spaces
  const parts = line.split(/\s{2,}/).filter((p) => p.trim());

  if (parts.length >= 3) {
    // Assume: first part(s) = description, then quantity, price, etc.
    // Try to find numbers
    const numberParts = parts.filter((p) =>
      /^\d+[.,]?\d*$/.test(p.replace(/[.,]/g, ""))
    );

    if (numberParts.length >= 2) {
      // Last few parts are likely numbers
      item.quantity = parseFloat(numberParts[0].replace(/[.,]/g, "."));
      item.unitPrice = parseChileanCurrency(
        numberParts[numberParts.length - 2] || "0"
      );
      item.totalPrice = parseChileanCurrency(
        numberParts[numberParts.length - 1] || "0"
      );

      // Description is everything that's not a number
      item.description = parts
        .slice(0, parts.length - numberParts.length)
        .join(" ")
        .trim();
    }
  }

  return item;
};

const parseChileanCurrency = (value) => {
  if (!value) return 0;
  // Remove spaces, convert comma to dot for decimals
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
};

const calculateConfidence = (result) => {
  let score = 0;
  let maxScore = 0;

  // Supplier name (20 points)
  if (result.supplierName) score += 20;
  maxScore += 20;

  // Invoice number (20 points)
  if (result.invoiceNumber) score += 20;
  maxScore += 20;

  // Invoice date (15 points)
  if (result.invoiceDate) score += 15;
  maxScore += 15;

  // Items (20 points)
  if (result.items.length > 0) score += 20;
  maxScore += 20;

  // Totals (25 points)
  if (result.totalAmount) score += 15;
  if (result.taxAmount) score += 10;
  maxScore += 25;

  return Math.round((score / maxScore) * 100);
};

// Parse SII XML format (Chilean electronic invoice standard)
const parseChileanInvoiceXML = (xmlContent) => {
  if (!xmlContent) return null;

  const result = {
    supplierName: null,
    supplierRut: null,
    invoiceNumber: null,
    invoiceDate: null,
    items: [],
    totalAmount: null,
    taxAmount: null,
    netAmount: null,
    confidence: 100, // XML parsing has high confidence
  };

  try {
    // Simple XML parsing (without external libraries)
    const parser = new DOMParser() ? new DOMParser() : null;
    let xmlDoc;

    if (parser) {
      xmlDoc = parser.parseFromString(xmlContent, "application/xml");
    } else {
      // Node.js fallback
      const xml2js = require("xml2js");
      const xmlParser = new xml2js.Parser();
      xmlDoc = xmlParser.parseStringSync(xmlContent);
    }

    // Extract from standard SII XML structure
    // <Encabezado><IdDoc><Numero>, <Fecha>
    // <Encabezado><Emisor><RznSoc>, <RUT>
    // <Detalle><Item><NmbItem>, <QtyItem>, <PrcItem>, <MontoItem>
    // <Encabezado><Totales><MntNeto>, <IVA>, <MntTotal>

    // Try DOM approach first
    if (xmlDoc && xmlDoc.documentElement) {
      // Extract invoice number
      const numeroNode =
        xmlDoc.querySelector("Numero") ||
        xmlDoc.querySelector("IdDoc > Numero");
      if (numeroNode) {
        result.invoiceNumber = numeroNode.textContent.trim();
      }

      // Extract date
      const fechaNode =
        xmlDoc.querySelector("Fecha") || xmlDoc.querySelector("IdDoc > Fecha");
      if (fechaNode) {
        result.invoiceDate = fechaNode.textContent.trim();
      }

      // Extract supplier info
      const rznSocNode =
        xmlDoc.querySelector("RznSoc") ||
        xmlDoc.querySelector("Emisor > RznSoc");
      if (rznSocNode) {
        result.supplierName = rznSocNode.textContent.trim();
      }

      const rutNode =
        xmlDoc.querySelector("RUT") || xmlDoc.querySelector("Emisor > RUT");
      if (rutNode) {
        result.supplierRut = rutNode.textContent.trim();
      }

      // Extract items
      const items = xmlDoc.querySelectorAll("Detalle > Item");
      items.forEach((item) => {
        const description =
          item.querySelector("NmbItem")?.textContent.trim() || "";
        const quantity = parseFloat(
          item.querySelector("QtyItem")?.textContent || 0
        );
        const unitPrice = parseChileanCurrency(
          item.querySelector("PrcItem")?.textContent || "0"
        );
        const totalPrice = parseChileanCurrency(
          item.querySelector("MontoItem")?.textContent || "0"
        );

        if (description) {
          result.items.push({
            description,
            quantity,
            unitPrice,
            totalPrice,
          });
        }
      });

      // Extract totals
      const netNode =
        xmlDoc.querySelector("MntNeto") ||
        xmlDoc.querySelector("Totales > MntNeto");
      if (netNode) {
        result.netAmount = parseChileanCurrency(netNode.textContent);
      }

      const ivaNode =
        xmlDoc.querySelector("IVA") || xmlDoc.querySelector("Totales > IVA");
      if (ivaNode) {
        result.taxAmount = parseChileanCurrency(ivaNode.textContent);
      }

      const totalNode =
        xmlDoc.querySelector("MntTotal") ||
        xmlDoc.querySelector("Totales > MntTotal");
      if (totalNode) {
        result.totalAmount = parseChileanCurrency(totalNode.textContent);
      }
    }
  } catch (err) {
    console.error("XML parsing error:", err);
    // Return result with whatever was parsed before error
  }

  return result;
};

module.exports = {
  parseChileanInvoice,
  parseChileanInvoiceXML,
  parseChileanCurrency,
};
