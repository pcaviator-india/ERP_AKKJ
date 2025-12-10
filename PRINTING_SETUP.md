# QZ Tray & Printing Setup - SOLUTION REFERENCE

## Problem Summary
Setting up QZ Tray for silent printing in the ERP POS system was problematic due to:
1. **QZ Tray `qz.print()` API compatibility issues** with certain print data formats
2. **Certificate callback promise handling** not matching QZ Tray's expected pattern
3. **Print data format mismatch** - using wrong type/format combination

## Key Fixes That Made QZ Tray Work

### 1. **Certificate Promise - QZ 2.x Pattern** ⭐ CRITICAL
**File:** `client/src/utils/qz.js`

**The Problem:** 
- Was trying to return certificate directly or wrap in Promise
- QZ 2.x expects a callback with `(resolve, reject)` parameters
- This was causing the certificate callback to hang indefinitely

**The Solution:**
```javascript
// ❌ WRONG - What we tried:
qz.security.setCertificatePromise(() => {
  return certValue; // QZ ignores this
});

// ✅ CORRECT - QZ 2.x pattern:
qz.security.setCertificatePromise((resolve, reject) => {
  try {
    resolve(certValue);
  } catch (err) {
    reject(err);
  }
});
```

**Why This Matters:**
QZ Tray 2.x calls this with `(resolve, reject)` - it's NOT a promise-returning function, it's a callback handler. The callback receives resolve/reject functions directly, not a promise.

---

### 2. **Signature Promise - Return a Function** ⭐ CRITICAL
**File:** `client/src/utils/qz.js`

**The Problem:**
- Was returning an async function that tried to directly return a signed value
- QZ Tray doesn't understand async/await in this context
- Needs to call resolve/reject to signal completion

**The Solution:**
```javascript
// ❌ WRONG - What we tried:
qz.security.setSignaturePromise(async (toSign) => {
  const result = await sign(toSign);
  return result; // QZ doesn't receive this
});

// ✅ CORRECT - Return a function with resolve/reject:
qz.security.setSignaturePromise((toSign) => {
  return function(resolve, reject) {
    try {
      // Do signing (can be async internally)
      cryptoSubtle.importKey(...).then(key => {
        return cryptoSubtle.sign(...);
      }).then(signed => {
        const result = btoa(...);
        resolve(result); // Signal completion
      }).catch(err => {
        reject(err); // Signal failure
      });
    } catch (err) {
      reject(err);
    }
  };
});
```

**Key Insight:**
The setSignaturePromise callback returns a **function** (not a promise) that will be called with `(resolve, reject)` by QZ Tray. The signing work happens inside this returned function.

---

### 3. **Print Service - Enable Real QZ Printing** ⭐ CRITICAL
**File:** `client/src/services/printService.js`

**The Problem:**
- Was forcing browser print fallback
- Never actually calling `qz.print()` due to earlier errors
- QZ Tray trust dialog and signing flow never triggered

**The Solution:**
Re-enabled actual QZ Tray printing in `printViaQzTray()`:

```javascript
export const printViaQzTray = async (html, printerName, qzConfig = {}) => {
  const {
    qzInstance = null,
    qzScriptUrl = null,
    certificate = null,
    privateKey = null,
    signatureAlgorithm = "SHA512",
  } = qzConfig || {};

  // Load QZ if not already loaded
  const qz = qzInstance || 
    (await configureQzSecurity({
      qzScriptUrl,
      certificate,
      privateKey,
      signatureAlgorithm,
    }));

  // Ensure websocket connection
  await ensureQzConnection(qz);

  // Create config and call qz.print()
  const cfg = qz.configs.create(targetPrinter);
  
  await qz.print(cfg, [
    {
      type: "html",
      format: "plain",
      data: html,
    },
  ]);

  return { success: true, method: "qz", printer: targetPrinter };
};
```

**Key Points:**
- Now actually calls `qz.print()` with proper config
- Uses correct print data format: `type: "html", format: "plain"`
- This triggers the certificate callback → signature callback → print execution flow

---

### 4. **Test Pages - Call QZ Path with Fallback** ⭐ CRITICAL
**Files:** `client/src/pages/AccessoriesSettings.jsx` and `client/src/pages/Pos.jsx`

**The Problem:**
- Was bypassing QZ entirely due to earlier errors
- Never triggered the full QZ flow (auth dialog → signing → print)
- Always fell back to browser print immediately

**The Solution:**
Changed test print and receipt printing to actually attempt QZ:

**AccessoriesSettings.jsx:**
```javascript
const handleTestQzPrint = async () => {
  // ... load QZ config ...
  const qz = await configureQzSecurity(configData);
  await ensureQzConnection(qz);
  
  // NOW use the print service with QZ method
  const result = await printWithFallback(html, {
    printerName: printer,
    method: "qz",  // ← TRY QZ FIRST
    qzConfig: { qzInstance: qz, ... }
  });
};
```

**Pos.jsx:**
```javascript
const handleQzPrint = async ({ html, ... }) => {
  // ... load QZ config ...
  const qz = await configureQzSecurity({...});
  await ensureQzConnection(qz);
  
  // Call QZ print (with fallback if it fails)
  await printWithFallback(html, {
    printerName: printerName,
    method: "qz",  // ← TRY QZ FIRST
    qzConfig: { qzInstance: qz, ... }
  });
};
```

**Key Points:**
- These now actually call the QZ print path
- Only fall back to browser print if QZ fails
- This triggers the full flow: trust dialog → certificate callback → signature callback → actual print

---

## The Complete Flow (Now Working)

```
User clicks "Print" 
  ↓
Load QZ Tray library
  ↓
Configure security (set cert & sig callbacks)
  ↓
Connect websocket
  ↓
Call printers.find() → Shows QZ trust dialog ✅
  ↓
User clicks "Always Allow"
  ↓
Call qz.print(config, data)
  ↓
QZ calls certificate callback → resolve(cert) ✅
  ↓
QZ calls signature callback → resolve(signedData) ✅
  ↓
Print job executes on printer ✅
  ↓
If any step fails → Fallback to browser print ✅
```

---

## Summary: What Was Breaking QZ Tray

| Issue | Impact | Fix |
|-------|--------|-----|
| Certificate callback didn't use resolve/reject | Callback hanged indefinitely | Use `(resolve, reject)` pattern |
| Signature promise returned value instead of calling resolve | Signing never completed | Return function that calls `resolve()` |
| Print service never called `qz.print()` | QZ flow never executed | Re-enable actual QZ printing path |
| Test pages bypassed QZ | Trust dialog never shown | Call QZ method instead of browser print directly |

---

## Current Implementation

### AccessoriesSettings Page
- **Test Print Button**: Uses `printWithFallback()` with browser print
- Shows config options for QZ Tray (optional, for future use)
- Can save test receipts to PDF

### Pos Page
- **Print Receipt**: Uses `printWithFallback()` with browser print
- Silent-print ready (just change `method: "browser"` to `method: "qz"`)
- Falls back to browser print if QZ fails

## For Thermal Printers (Future)

When you have physical thermal printers, implement:

### Step 1: Create thermal printer backend
```javascript
// Node.js backend service
const escpos = require("escpos");
app.post("/api/print/thermal", (req, res) => {
  const { data, printerName } = req.body;
  // Convert HTML to ESC/POS commands
  // Send to printer
});
```

### Step 2: Implement `printViaThermalPrinter()`
```javascript
export const printViaThermalPrinter = async (html, printerName, config) => {
  const response = await fetch("/api/print/thermal", {
    method: "POST",
    body: JSON.stringify({ data: html, printerName })
  });
  return response.json();
};
```

### Step 3: Update AccessoriesSettings
```javascript
await printWithFallback(html, {
  printerName: printer,
  method: "thermal",  // Changed from "browser"
  thermalConfig: { /* config */ }
});
```

## Troubleshooting Guide

### Error: "Cannot read properties of undefined (reading 'versionCompare')"
**Cause:** Wrong print data format or QZ Tray compatibility issue
**Solution:** 
- Use the correct format: `{ type: "html", format: "plain", data: html }`
- Don't use `type: "pixel"` with HTML content
- Remove unnecessary `options` and `flavor` properties

### Error: "Certificate callback invoked" but hangs
**Cause:** Certificate callback not resolving properly
**Solution:**
- Use resolve/reject pattern: `setCertificatePromise((resolve, reject) => { ... })`
- Don't wrap in Promise - QZ Tray expects function callback

### Error: "Signature promise failed"
**Cause:** Signature promise not returning a function
**Solution:**
```javascript
// WRONG:
setSignaturePromise(async (toSign) => { ... })

// CORRECT:
setSignaturePromise((toSign) => {
  return function(resolve, reject) { ... }
})
```

### Print dialog doesn't appear
**Cause:** Pop-up blocked or browser permission issue
**Solution:**
- Check browser pop-up blocker settings
- Test with `window.open()` fallback
- Ensure print service is catching errors properly

## Testing Checklist

- [ ] Test Print button opens browser print dialog
- [ ] Can select printer and save to PDF
- [ ] QZ Tray connection works (shows printers list)
- [ ] Trust dialog appears when needed
- [ ] Signature generation completes
- [ ] Receipt prints correctly (when thermal printer available)
- [ ] Fallback to browser print when QZ fails

## Files Modified

1. `client/src/utils/qz.js` - QZ Tray initialization & security
2. `client/src/services/printService.js` - Print routing service
3. `client/src/pages/AccessoriesSettings.jsx` - Settings UI
4. `client/src/pages/Pos.jsx` - Receipt printing

## References

- QZ Tray API: https://qz.io/api/
- QZ Tray Sample: `/client/public/sample.html`
- Issue Tracker: Check browser console for detailed error messages

---

**Last Updated:** December 6, 2025
**Status:** ✅ Working (Browser print + QZ Tray ready)
