const fs = require("fs/promises");
const path = require("path");

const CONFIG_DIR = path.join(__dirname, "..", "..", "config");
const CONFIG_PATH = path.join(CONFIG_DIR, "ui-preferences.json");

const defaultReceipts = {
  defaultSize: "80mm",
  sizes: {
    "57mm": {
      showLogo: true,
      showTax: true,
      showDiscount: true,
      footerText: "Gracias por su compra",
      fontScale: 1,
      lineSpacing: "normal",
    },
    "80mm": {
      showLogo: true,
      showTax: true,
      showDiscount: true,
      footerText: "Gracias por su compra",
      fontScale: 1,
      lineSpacing: "normal",
    },
    letter: {
      showLogo: true,
      showTax: true,
      showDiscount: true,
      footerText: "Gracias por su compra",
      fontScale: 1,
      lineSpacing: "normal",
    },
  },
};

const envQzCert =
  process.env.QZ_CERTIFICATE ||
  process.env.QZ_CERT ||
  process.env.QZ_CERT_PEM ||
  "";
const envQzKey =
  process.env.QZ_PRIVATE_KEY ||
  process.env.QZ_KEY ||
  process.env.QZ_KEY_PEM ||
  "";
const envQzScriptUrl = process.env.QZ_SCRIPT_URL || "";
const envQzAlgo =
  process.env.QZ_SIGNATURE_ALGO || process.env.QZ_ALGORITHM || "";

const defaultAccessories = {
  agentUrl: "http://localhost:8182",
  token: "",
  defaultPrinters: {
    "57mm": "",
    "80mm": "",
    letter: "",
  },
  qzEnabled: false,
  qzScriptUrl: envQzScriptUrl || "/qz-tray.js",
  qzCertificate: envQzCert,
  qzPrivateKey: envQzKey,
  qzSignatureAlgorithm: envQzAlgo || "SHA512",
};

const isPlainObject = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);

const deepMerge = (target, updates) => {
  const result = { ...target };
  Object.entries(updates).forEach(([key, value]) => {
    if (isPlainObject(value)) {
      const existing = isPlainObject(result[key]) ? result[key] : {};
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  });
  return result;
};

const ensureStoreDir = async () => {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
};

const readStore = async () => {
  const empty = { version: 1, updatedAt: null, items: {} };
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    if (!raw || !raw.trim()) {
      return empty;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return empty;
    }
    return {
      version: parsed.version || 1,
      updatedAt: parsed.updatedAt || null,
      items: parsed.items || {},
    };
  } catch (err) {
    if (err.code === "ENOENT") {
      return empty;
    }
    // On malformed JSON, reset to empty to avoid wedging the app
    if (err instanceof SyntaxError) {
      await writeStore(empty);
      return empty;
    }
    throw err;
  }
};

const writeStore = async (store) => {
  await ensureStoreDir();
  const payload = JSON.stringify(store, null, 2);
  await fs.writeFile(CONFIG_PATH, payload, "utf8");
};

const buildScopeKey = (companyId, userId) => {
  const companyKey =
    companyId === 0 || companyId ? String(companyId) : "global";
  const userKey = userId === 0 || userId ? String(userId) : "anonymous";
  return `${companyKey}:${userKey}`;
};

// Merge company-level config first, then user-level overrides
const mergeScopedConfig = (companyConfig, userConfig) =>
  deepMerge(
    { receipts: defaultReceipts, accessories: defaultAccessories },
    deepMerge(companyConfig, userConfig)
  );

async function getConfig(companyId, userId) {
  const store = await readStore();
  const companyKey = buildScopeKey(companyId, null);
  const userKey = buildScopeKey(companyId, userId);
  const companyConfig = store.items[companyKey] || {};
  const userConfig = store.items[userKey] || {};
  const merged = mergeScopedConfig(companyConfig, userConfig);
  // persist defaults back so subsequent reads are hydrated for both scopes
  const nextStore = { ...store };
  let changed = false;
  if (JSON.stringify(companyConfig) !== JSON.stringify(nextStore.items[companyKey])) {
    nextStore.items[companyKey] = companyConfig;
    changed = true;
  }
  if (JSON.stringify(userConfig) !== JSON.stringify(nextStore.items[userKey])) {
    nextStore.items[userKey] = userConfig;
    changed = true;
  }
  if (changed) {
    await writeStore(nextStore);
  }
  return merged;
}

async function updateConfig(companyId, userId, updates) {
  if (!isPlainObject(updates)) {
    throw new Error("Updates payload must be an object");
  }
  // set defaults for receipts if provided partially
  const withDefaults = { ...updates };
  if (updates && updates.receipts) {
    withDefaults.receipts = deepMerge(defaultReceipts, updates.receipts);
  }
  if (updates && updates.accessories) {
    withDefaults.accessories = deepMerge(
      defaultAccessories,
      updates.accessories
    );
  }
  const store = await readStore();
  const companyKey = buildScopeKey(companyId, null);
  const userKey = buildScopeKey(companyId, userId);

  const currentCompany = store.items[companyKey] || {};
  const currentUser = store.items[userKey] || {};

  // Always write user-scoped preferences
  const nextUser = deepMerge(currentUser, withDefaults);
  store.items[userKey] = nextUser;

  // Persist tax defaults at the company scope so they stick across logins/users
  if (withDefaults.tax) {
    const nextCompany = deepMerge(currentCompany, { tax: withDefaults.tax });
    store.items[companyKey] = nextCompany;
  }

  store.version = (store.version || 1) + 1;
  store.updatedAt = new Date().toISOString();
  await writeStore(store);

  // Return merged view (company + user) with defaults
  return mergeScopedConfig(store.items[companyKey] || {}, store.items[userKey] || {});
}

module.exports = {
  getConfig,
  updateConfig,
  CONFIG_PATH,
};
