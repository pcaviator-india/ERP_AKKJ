import { configureQzSecurity, ensureQzConnection } from "../utils/qz";

/**
 * Print Service - Handles all printing logic
 * Supports: Browser Print, QZ Tray, Thermal Printers (future)
 */

/**
 * Browser-based print (works everywhere, no special setup)
 * Best for: Testing, PDF export, when no thermal printer available
 */
export const printViaBrowser = async (html, windowTitle = "Receipt") => {
  return new Promise((resolve, reject) => {
    try {
      const printWindow = window.open("", windowTitle);
      if (!printWindow) {
        reject(new Error("Failed to open print window - pop-ups may be blocked"));
        return;
      }

      // Write HTML with print-friendly styles
      const styledHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${windowTitle}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: monospace;
              font-size: 12px;
              line-height: 1.4;
              width: 80mm;
              margin: 0;
              padding: 5mm;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
                width: 80mm;
              }
              @page {
                size: 80mm auto;
                margin: 0;
                padding: 0;
              }
            }
            .receipt-content {
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="receipt-content">
            ${html}
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(styledHtml);
      printWindow.document.close();

      // Wait for content to render
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        
        // Close window after print dialog closes
        setTimeout(() => {
          printWindow.close();
          resolve({ success: true, method: "browser" });
        }, 2000);
      }, 500);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Attempt QZ Tray (advanced, requires desktop app)
 */
export const printViaQzTray = async (html, printerName, qzConfig = {}) => {
  const {
    qzInstance = null,
    qzScriptUrl = null,
    certificate = null,
    privateKey = null,
    signatureAlgorithm = "SHA512",
  } = qzConfig || {};

  // Reuse existing instance if caller already loaded QZ
  const qz =
    qzInstance ||
    (await configureQzSecurity({
      qzScriptUrl,
      certificate,
      privateKey,
      signatureAlgorithm,
    }));

  if (!qz) {
    throw new Error("QZ Tray not available");
  }
  if (!qz.configs || !qz.print || !qz.printers || !qz.websocket) {
    throw new Error("QZ Tray APIs are not available");
  }

  await ensureQzConnection(qz);

  // Choose printer: provided name first, then system default
  let targetPrinter = (printerName || "").trim();
  if (!targetPrinter) {
    try {
      targetPrinter = await qz.printers.getDefault();
    } catch (err) {
      throw new Error(
        "No printer selected and failed to read system default from QZ Tray"
      );
    }
  }
  if (!targetPrinter) {
    throw new Error("No printer selected for QZ Tray printing");
  }

  const cfg = qz.configs.create(targetPrinter);
  if (!cfg) {
    throw new Error("Failed to create QZ Tray print configuration");
  }

  await qz.print(cfg, [
    {
      type: "html",
      format: "plain",
      data: html,
    },
  ]);

  return { success: true, method: "qz", printer: targetPrinter };
};

/**
 * Future: Print via thermal printer API
 * This will handle ESC/POS commands for thermal printers
 */
export const printViaThermalPrinter = async (
  html,
  printerName,
  thermalConfig
) => {
  throw new Error(
    "Thermal printer support not yet implemented. Use browser print for now."
  );
  // TODO: Implement ESC/POS command generation
  // TODO: Send to thermal printer via Node.js backend service
};

/**
 * Print with fallback chain
 * Tries multiple methods until one succeeds
 */
export const printWithFallback = async (html, options = {}) => {
  const {
    printerName = null,
    method = "browser", // 'browser', 'qz', 'thermal'
    qzConfig = null,
    thermalConfig = null,
  } = options;

  console.log(`Printing via ${method}...`);

  try {
    switch (method) {
      case "qz":
        return await printViaQzTray(html, printerName, qzConfig);
      case "thermal":
        return await printViaThermalPrinter(html, printerName, thermalConfig);
      case "browser":
      default:
        return await printViaBrowser(html, "Receipt Print");
    }
  } catch (err) {
    console.error(`Print method '${method}' failed:`, err?.message);
    
    // Fallback to browser print
    if (method !== "browser") {
      console.log("Falling back to browser print...");
      try {
        return await printViaBrowser(html, "Receipt Print (Fallback)");
      } catch (fallbackErr) {
        throw new Error(
          `All print methods failed. Browser print error: ${fallbackErr?.message}`
        );
      }
    }
    
    throw err;
  }
};

/**
 * Get available printers (for future use with thermal printers)
 */
export const getAvailablePrinters = async () => {
  // TODO: Implement once thermal printer service is added
  return [
    {
      name: "Browser Print",
      type: "browser",
      available: true,
    },
    // { name: "Kitchen Printer", type: "thermal", available: false },
    // { name: "Cashier Printer", type: "thermal", available: false },
  ];
};

export default {
  printViaBrowser,
  printViaQzTray,
  printViaThermalPrinter,
  printWithFallback,
  getAvailablePrinters,
};
