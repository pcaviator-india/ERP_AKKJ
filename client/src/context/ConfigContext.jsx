import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/http";
import { useAuth } from "./AuthContext";

const ConfigContext = createContext();

const isPlainObject = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);

const deepMerge = (target, updates) => {
  const result = { ...target };
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (isPlainObject(value)) {
      const existing = isPlainObject(result[key]) ? result[key] : {};
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  });
  return result;
};

export function ConfigProvider({ children }) {
  const { token } = useAuth();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/config");
      setConfig(data || {});
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        // No config access; keep defaults without noisy log
        setConfig({});
      } else {
        console.warn("Failed to load config", err);
        setConfig({});
      }
    } finally {
      setReady(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setConfig({});
      setReady(true);
      setLoading(false);
      return;
    }
    loadConfig();
  }, [token]);

  const saveConfig = async (updates) => {
    if (!isPlainObject(updates)) return;
    setConfig((prev) => deepMerge(prev, updates));
    try {
      const { data } = await api.patch("/api/config", { updates });
      setConfig(data || {});
    } catch (err) {
      console.warn("Failed to persist config", err);
      if (err.response?.status === 401) {
        setConfig((prev) => prev || {});
      }
    }
  };

  const value = useMemo(
    () => ({
      config,
      loading,
      ready,
      refresh: loadConfig,
      updateConfig: saveConfig,
    }),
    [config, loading, ready]
  );

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return ctx;
}
