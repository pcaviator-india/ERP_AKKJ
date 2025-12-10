import { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "../i18n/en";
import es from "../i18n/es";

const LanguageContext = createContext();

const dictionaries = {
  en,
  es,
};

const getNested = (obj, path) =>
  path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "en");

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  const t = (key, vars = {}) => {
    const dict = dictionaries[lang] || dictionaries.en;
    const fallbackDict = dictionaries.en;
    const value = getNested(dict, key) ?? getNested(fallbackDict, key) ?? key;
    if (typeof value === "string") {
      return value.replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");
    }
    return value || key;
  };

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
