import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { setAuthHandlers, setAuthToken } from "../api/http";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("akkj_jwt"));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem("akkj_refresh"));
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      localStorage.setItem("akkj_jwt", token);
      if (refreshToken) {
        localStorage.setItem("akkj_refresh", refreshToken);
      } else {
        localStorage.removeItem("akkj_refresh");
      }
      loadProfile();
    } else {
      setAuthToken(null);
      localStorage.removeItem("akkj_jwt");
      localStorage.removeItem("akkj_refresh");
      setRefreshToken(null);
      setUser(null);
      setCompany(null);
      setPermissions([]);
      setLoading(false);
    }
  }, [token, refreshToken]);

  const loadProfile = async () => {
    try {
      const { data } = await api.get("/api/auth/me");
      setUser(data);
      setPermissions(Array.isArray(data?.Permissions) ? data.Permissions : []);
      if (data.CompanyID) {
        try {
          const companyRes = await api.get(`/api/companies/${data.CompanyID}`);
          setCompany(companyRes.data);
        } catch (companyErr) {
          console.warn("Unable to load company info", companyErr);
          setCompany({ CompanyID: data.CompanyID, CompanyName: "" });
        }
      } else {
        setCompany(null);
      }
    } catch (error) {
      console.error("Failed to load profile", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    const { data } = await api.post("/api/auth/login", credentials);
    setToken(data.token);
    setRefreshToken(data.refreshToken || null);
  };

  const register = async (payload) => {
    const { data } = await api.post("/api/onboarding/register", payload);
    setToken(data.token);
    setRefreshToken(data.refreshToken || null);
      setUser({
        ...data.admin,
        CompanyID: data.company.CompanyID,
      });
      setCompany(data.company);
      setPermissions(Array.isArray(data?.Permissions) ? data.Permissions : []);
    return data;
  };

  const logout = () => {
    setToken(null);
    setRefreshToken(null);
    setPermissions([]);
  };

  // Register refresh handlers after logout is defined
  useEffect(() => {
    setAuthHandlers({
      getRefreshToken: () => refreshToken,
      onAuthSuccess: (newToken, newRefresh) => {
        setToken(newToken);
        if (newRefresh) setRefreshToken(newRefresh);
      },
      onAuthFailure: () => logout(),
    });
  }, [refreshToken, logout]);

  const value = useMemo(
    () => ({
      token,
      user,
      company,
      loading,
      permissions,
      login,
      register,
      logout,
      refreshProfile: loadProfile,
    }),
    [token, user, company, loading, permissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
