import { useEffect, useRef, useState } from "react";
import api from "../api/http";

// Simple OCR component using Tesseract.js
// Can be embedded in DirectPurchasesPage or standalone
export default function InvoiceOCRUpload({ onDataExtracted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Check file type
    const isImage = selected.type.startsWith("image/");
    const isPDF =
      selected.type === "application/pdf" || selected.name.endsWith(".pdf");
    const isXML =
      selected.type === "application/xml" ||
      selected.type === "text/xml" ||
      selected.name.endsWith(".xml");

    if (!isImage && !isPDF && !isXML) {
      setError("Please select an image (JPG, PNG), PDF, or XML file");
      return;
    }

    setFile(selected);
    setError("");

    // Preview (only for images)
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPreview(evt.target.result);
      };
      reader.readAsDataURL(selected);
    } else if (isPDF) {
      setPreview("📄 PDF File Selected");
    } else if (isXML) {
      setPreview("📋 XML File Selected");
    }
  };

  const performOCR = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const isImage = file.type.startsWith("image/");
      const isPDF =
        file.type === "application/pdf" || file.name.endsWith(".pdf");
      const isXML =
        file.type === "application/xml" ||
        file.type === "text/xml" ||
        file.name.endsWith(".xml");

      if (isXML) {
        // XML parsing (direct SII format)
        await handleXMLParsing();
      } else if (isPDF) {
        // PDF text extraction
        await handlePDFExtraction();
      } else if (isImage) {
        // Image OCR
        await handleImageOCR();
      }
    } catch (err) {
      console.error("Processing error:", err);
      setError("Failed to process file. Please try again.");
      setLoading(false);
    }
  };

  const handleXMLParsing = async () => {
    try {
      const text = await file.text();

      // Send to backend for XML parsing
      const parseResponse = await api.post("/api/ocr/parse-invoice-xml", {
        xmlContent: text,
      });

      if (parseResponse.data.success) {
        setExtractedData(parseResponse.data.data);
        setOcrText("[XML Direct Parsing - No OCR needed]");
        if (onDataExtracted) {
          onDataExtracted(parseResponse.data.data);
        }
      } else {
        setError(parseResponse.data.error || "Failed to parse XML file");
      }
    } catch (err) {
      console.error("XML parsing error:", err);
      setError("Failed to read or parse XML file");
    } finally {
      setLoading(false);
    }
  };

  const handlePDFExtraction = async () => {
    try {
      // Load PDF.js from CDN
      const pdfjsLib = await import(
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.mjs"
      );
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const pdf = await pdfjsLib.getDocument({ data: evt.target.result })
            .promise;
          let fullText = "";

          // Extract text from all pages
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item) => item.str).join(" ");
            fullText += text + "\n";
          }

          setOcrText(fullText);

          // Send to backend for parsing
          const parseResponse = await api.post("/api/ocr/parse-invoice", {
            ocrText: fullText,
          });

          if (parseResponse.data.success) {
            setExtractedData(parseResponse.data.data);
            if (onDataExtracted) {
              onDataExtracted(parseResponse.data.data);
            }
          } else {
            setError(parseResponse.data.error || "Failed to parse PDF");
          }
        } catch (err) {
          console.error("PDF extraction error:", err);
          setError("Failed to extract text from PDF");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("PDF.js loading error:", err);
      setError("Failed to load PDF processor");
      setLoading(false);
    }
  };

  const handleImageOCR = async () => {
    try {
      // Load Tesseract from CDN (no installation needed)
      const { createWorker } = await import(
        "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.1"
      );

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const worker = await createWorker("spa"); // Spanish language
          const result = await worker.recognize(evt.target.result);
          const text = result.data.text;

          setOcrText(text);

          // Send to backend for parsing
          const parseResponse = await api.post("/api/ocr/parse-invoice", {
            ocrText: text,
          });

          if (parseResponse.data.success) {
            setExtractedData(parseResponse.data.data);
            if (onDataExtracted) {
              onDataExtracted(parseResponse.data.data);
            }
          } else {
            setError(parseResponse.data.error || "Failed to parse invoice");
          }

          await worker.terminate();
        } catch (err) {
          console.error("OCR error:", err);
          setError(
            "OCR processing failed. Please check your image and try again."
          );
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Tesseract.js loading error:", err);
      setError("Failed to load OCR processor");
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.uploadSection}>
        <h3>Upload Invoice</h3>
        <p style={styles.hint}>
          Upload a photo, PDF, or XML of your supplier's FACTURA to auto-extract
          data.
          <br />
          Supports: JPG • PNG • PDF • XML (SII format)
        </p>

        <div style={styles.uploadArea}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={styles.hiddenInput}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={styles.uploadBtn}
          >
            📷 Select Image
          </button>
          {file && <p style={styles.fileName}>{file.name}</p>}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {preview && (
          <div style={styles.previewSection}>
            <img src={preview} alt="Invoice preview" style={styles.preview} />
          </div>
        )}

        {preview && !extractedData && (
          <button
            onClick={performOCR}
            disabled={loading}
            style={{
              ...styles.primaryBtn,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "🔄 Processing..." : "✨ Extract Data from File"}
          </button>
        )}
      </div>

      {extractedData && (
        <ExtractedDataReview data={extractedData} ocrText={ocrText} />
      )}
    </div>
  );
}

// Component to review and edit extracted data
export function ExtractedDataReview({ data, ocrText }) {
  const [editedData, setEditedData] = useState(data);
  const [showRawText, setShowRawText] = useState(false);

  const handleChange = (field, value) => {
    setEditedData({
      ...editedData,
      [field]: value,
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...editedData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditedData({ ...editedData, items: newItems });
  };

  const handleRemoveItem = (index) => {
    const newItems = editedData.items.filter((_, i) => i !== index);
    setEditedData({ ...editedData, items: newItems });
  };

  return (
    <div style={styles.reviewSection}>
      <h3>Review Extracted Data (Confidence: {editedData.confidence}%)</h3>

      {editedData.confidence < 70 && (
        <div style={styles.warning}>
          ⚠️ Low confidence in OCR extraction. Please review and correct all
          fields carefully.
        </div>
      )}

      {/* Header Info */}
      <div style={styles.section}>
        <h4>Supplier Information</h4>

        <div style={styles.formRow}>
          <label>Supplier Name:</label>
          <input
            type="text"
            value={editedData.supplierName || ""}
            onChange={(e) => handleChange("supplierName", e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.formRow}>
          <label>Supplier RUT:</label>
          <input
            type="text"
            value={editedData.supplierRut || ""}
            onChange={(e) => handleChange("supplierRut", e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.formRow}>
          <label>Invoice Number:</label>
          <input
            type="text"
            value={editedData.invoiceNumber || ""}
            onChange={(e) => handleChange("invoiceNumber", e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.formRow}>
          <label>Invoice Date:</label>
          <input
            type="date"
            value={editedData.invoiceDate || ""}
            onChange={(e) => handleChange("invoiceDate", e.target.value)}
            style={styles.input}
          />
        </div>
      </div>

      {/* Items */}
      <div style={styles.section}>
        <h4>Items ({editedData.items.length})</h4>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {editedData.items.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    value={item.description || ""}
                    onChange={(e) =>
                      handleItemChange(idx, "description", e.target.value)
                    }
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      handleItemChange(
                        idx,
                        "quantity",
                        parseFloat(e.target.value)
                      )
                    }
                    style={{ width: "80px" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      handleItemChange(
                        idx,
                        "unitPrice",
                        parseFloat(e.target.value)
                      )
                    }
                    style={{ width: "100px" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={item.totalPrice || ""}
                    onChange={(e) =>
                      handleItemChange(
                        idx,
                        "totalPrice",
                        parseFloat(e.target.value)
                      )
                    }
                    style={{ width: "100px" }}
                  />
                </td>
                <td>
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    style={styles.dangerBtn}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={styles.section}>
        <h4>Totals</h4>
        <div style={styles.formRow}>
          <label>Net Amount:</label>
          <input
            type="number"
            step="0.01"
            value={editedData.netAmount || ""}
            onChange={(e) =>
              handleChange("netAmount", parseFloat(e.target.value))
            }
            style={styles.input}
          />
        </div>

        <div style={styles.formRow}>
          <label>Tax Amount (IVA):</label>
          <input
            type="number"
            step="0.01"
            value={editedData.taxAmount || ""}
            onChange={(e) =>
              handleChange("taxAmount", parseFloat(e.target.value))
            }
            style={styles.input}
          />
        </div>

        <div style={styles.formRow}>
          <label>
            <strong>Total Amount:</strong>
          </label>
          <input
            type="number"
            step="0.01"
            value={editedData.totalAmount || ""}
            onChange={(e) =>
              handleChange("totalAmount", parseFloat(e.target.value))
            }
            style={{ ...styles.input, fontWeight: "bold" }}
          />
        </div>
      </div>

      {/* Raw OCR Text */}
      <div style={styles.section}>
        <button
          onClick={() => setShowRawText(!showRawText)}
          style={styles.secondaryBtn}
        >
          {showRawText ? "Hide Raw OCR Text" : "Show Raw OCR Text"}
        </button>

        {showRawText && (
          <textarea
            value={ocrText}
            readOnly
            style={{
              width: "100%",
              height: "200px",
              marginTop: "10px",
              padding: "10px",
              fontFamily: "monospace",
              fontSize: "12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        )}
      </div>

      {/* Export Button */}
      <div style={styles.section}>
        <button
          onClick={() => {
            // Return edited data to parent
            console.log("Edited data:", editedData);
            // Parent component should handle this
          }}
          style={styles.primaryBtn}
        >
          ✓ Use This Data to Create Purchase
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    marginBottom: "20px",
  },
  uploadSection: {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "8px",
    border: "2px dashed #007bff",
    textAlign: "center",
  },
  uploadArea: {
    padding: "20px",
    backgroundColor: "#f5f5f5",
    borderRadius: "4px",
    marginBottom: "10px",
  },
  uploadBtn: {
    padding: "12px 24px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  },
  hiddenInput: {
    display: "none",
  },
  fileName: {
    marginTop: "10px",
    color: "#666",
    fontSize: "14px",
  },
  primaryBtn: {
    padding: "12px 24px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  },
  secondaryBtn: {
    padding: "8px 16px",
    backgroundColor: "#6c757d",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  },
  dangerBtn: {
    padding: "4px 8px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
  },
  preview: {
    maxWidth: "300px",
    maxHeight: "400px",
    border: "1px solid #ddd",
    borderRadius: "4px",
  },
  previewSection: {
    marginTop: "15px",
    textAlign: "center",
  },
  error: {
    color: "white",
    backgroundColor: "#dc3545",
    padding: "12px",
    borderRadius: "4px",
    marginBottom: "10px",
  },
  warning: {
    color: "#856404",
    backgroundColor: "#fff3cd",
    padding: "12px",
    borderRadius: "4px",
    marginBottom: "15px",
  },
  hint: {
    color: "#666",
    fontSize: "14px",
    marginBottom: "15px",
  },
  reviewSection: {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "20px",
    borderLeft: "4px solid #28a745",
  },
  section: {
    marginBottom: "20px",
    paddingBottom: "20px",
    borderBottom: "1px solid #eee",
  },
  formRow: {
    marginBottom: "12px",
    display: "flex",
    flexDirection: "column",
  },
  input: {
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "14px",
    marginTop: "4px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px",
  },
};
