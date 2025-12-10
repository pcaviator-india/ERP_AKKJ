const QZ_SOURCES = (preferredUrl) => [
  preferredUrl || "",
  // Try newer versions first
  `https://cdn.qz.io/qz-tray/3/qz-tray.js?${Date.now()}`,
  `https://cdn.qz.io/qz-tray/2.3/qz-tray.js?${Date.now()}`,
  `https://cdn.qz.io/qz-tray/2.2/qz-tray.js?${Date.now()}`,
  // Fallback CDN variants
  "https://unpkg.com/qz-tray@latest/qz-tray.js",
  "https://unpkg.com/qz-tray@2.3.0/qz-tray.js",
  "https://unpkg.com/qz-tray@2.2.5/qz-tray.js",
  // Local fallback
  `${window.location.origin}/qz-tray.js`,
].filter(Boolean);

let qzPromise = null;
let cachedQz = null;
let isInitialized = false;
let securityConfigured = false;

const loadScriptSequentially = (urls, validate) =>
  new Promise((resolve, reject) => {
    const tryNext = (idx) => {
      if (idx >= urls.length) {
        reject(new Error("All script sources failed to load"));
        return;
      }
      const script = document.createElement("script");
      script.src = urls[idx];
      script.onload = () => {
        try {
          const result = validate();
          if (result) {
            resolve(result);
            return;
          }
          script.remove();
          tryNext(idx + 1);
        } catch (err) {
          script.remove();
          tryNext(idx + 1);
        }
      };
      script.onerror = () => {
        script.remove();
        tryNext(idx + 1);
      };
      document.head.appendChild(script);
    };
    tryNext(0);
  });

export const loadQzTray = (preferredUrl) => {
  // Return cached qz if already loaded
  if (window.qz?.version) {
    cachedQz = window.qz;
    return Promise.resolve(window.qz);
  }
  if (cachedQz) return Promise.resolve(cachedQz);
  if (qzPromise) return qzPromise;
  
  const urls = QZ_SOURCES(preferredUrl);
  qzPromise = loadScriptSequentially(urls, () => window.qz && window.qz.version)
    .then(() => {
      cachedQz = window.qz;
      return window.qz;
    })
    .catch((err) => {
      qzPromise = null;
      throw err;
    });
  return qzPromise;
};

export const configureQzSecurity = async ({
  qzScriptUrl,
  certificate,
  privateKey,
  signatureAlgorithm = "SHA512",
}) => {
  // Always get the cached qz instance from window
  const qz = window.qz || (await loadQzTray(qzScriptUrl));
  
  if (!qz) throw new Error("QZ Tray failed to load - check if qz-tray.js is available");
  if (!qz.security) throw new Error("QZ security API not available");
  if (!qz.websocket) throw new Error("QZ websocket API not available");
  if (!qz.printers) throw new Error("QZ printers API not available");
  if (!qz.configs) throw new Error("QZ configs API not available");
  if (!qz.print) throw new Error("QZ print API not available");
  
  const cert = (certificate || "").trim();
  const key = (privateKey || "").trim();
  
  // If no cert/key provided, skip security setup (unsigned mode triggers trust prompts)
  if (!cert || !key) {
    console.log("No certificate/key provided, using unsigned mode");
    return qz;
  }

  // Only configure security ONCE - don't reconfigure
  if (!securityConfigured) {
    console.log("Configuring QZ security (first time only)...");
    try {
      console.log("Setting certificate...");
      console.log("Certificate length:", cert.length);
      
      const certValue = cert;
      const keyValue = key;
      
      // Set certificate promise - QZ 2.x expects resolve/reject callback
      console.log("Setting certificate promise...");
      qz.security.setCertificatePromise((resolve, reject) => {
        try {
          console.log("Certificate callback invoked");
          resolve(certValue);
        } catch (err) {
          reject(err);
        }
      });
      
      console.log("Setting signature algorithm to:", signatureAlgorithm);
      qz.security.setSignatureAlgorithm(signatureAlgorithm);
      
      console.log("Setting signature promise...");
      qz.security.setSignaturePromise((toSign) => {
        // IMPORTANT: Return a FUNCTION that takes (resolve, reject)
        // This is the correct QZ Tray pattern!
        return function(resolve, reject) {
          try {
            console.log("Signature requested, data length:", toSign?.length);
            const pemToArrayBuffer = (pem) => {
              const base64 = pem
                .replace(/-----(BEGIN|END) (CERTIFICATE|PRIVATE KEY)-----/g, "")
                .replace(/\s+/g, "");
              const raw = window.atob(base64);
              const buffer = new ArrayBuffer(raw.length);
              const view = new Uint8Array(buffer);
              for (let i = 0; i < raw.length; i += 1) {
                view[i] = raw.charCodeAt(i);
              }
              return buffer;
            };
            
            const subtle = window.crypto?.subtle;
            if (!subtle) {
              reject(new Error("WebCrypto is not available for signing."));
              return;
            }
            
            const algo =
              signatureAlgorithm === "SHA1"
                ? "SHA-1"
                : signatureAlgorithm === "SHA256"
                ? "SHA-256"
                : "SHA-512";
            
            const keyData = pemToArrayBuffer(keyValue);
            subtle.importKey(
              "pkcs8",
              keyData,
              {
                name: "RSASSA-PKCS1-v1_5",
                hash: { name: algo },
              },
              false,
              ["sign"]
            ).then((cryptoKey) => {
              return subtle.sign(
                { name: "RSASSA-PKCS1-v1_5" },
                cryptoKey,
                new TextEncoder().encode(toSign)
              );
            }).then((signed) => {
              const result = btoa(String.fromCharCode(...new Uint8Array(signed)));
              console.log("Signature encoded, result length:", result.length);
              resolve(result);
            }).catch((err) => {
              console.error("Signature error:", err);
              reject(new Error(`Failed to sign data: ${err.message}`));
            });
          } catch (err) {
            console.error("Signature error:", err);
            reject(new Error(`Failed to sign data: ${err.message}`));
          }
        };
      });
      securityConfigured = true;
      console.log("QZ security configured successfully");
    } catch (err) {
      console.error("Security setup error:", err);
      throw new Error(`Failed to configure QZ security: ${err.message}`);
    }
  } else {
    console.log("QZ security already configured, reusing...");
  }
  
  return qz;
};

export const ensureQzConnection = async (qz) => {
  if (!qz) throw new Error("QZ not available");
  if (!qz.websocket) throw new Error("QZ websocket API not available");
  if (!qz.printers) throw new Error("QZ printers API not available");
  
  // If already initialized, don't reinitialize
  if (isInitialized && qz.websocket.isActive()) {
    console.log("QZ already initialized, reusing connection");
    return qz;
  }
  
  // Connect if not active
  if (!qz.websocket.isActive()) {
    try {
      console.log("Connecting to QZ Tray...");
      await qz.websocket.connect();
      console.log("Connected to QZ Tray");
    } catch (err) {
      throw new Error(`Failed to connect to QZ Tray: ${err.message}`);
    }
  }
  
  // Only trigger trust prompt on first initialization
  if (!isInitialized) {
    console.log("Initializing QZ Tray authorization (anonymous call)...");
    console.log("⚠️ QZ Tray should now show a TRUST DIALOG - please click 'Always Allow'");
    
    // Single call to printers.find() - this is ANONYMOUS (no cert)
    // It will trigger QZ's trust dialog
    try {
      console.log("Calling printers.find() to trigger trust dialog...");
      const printers = await qz.printers.find();
      console.log("✅ User approved! Found printers:", printers);
      isInitialized = true;
    } catch (err) {
      console.error("printers.find() failed:", err?.message);
      throw new Error(
        "QZ authorization required. A trust dialog should have appeared in QZ Tray. Accept it and try again."
      );
    }
  }
  
  return qz;
};
