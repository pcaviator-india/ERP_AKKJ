import axios from "axios";

const apiBase =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:4000";

const api = axios.create({
  baseURL: apiBase,
});

let getRefreshToken = null;
let onAuthSuccess = null;
let onAuthFailure = null;
let isRefreshing = false;
let refreshPromise = null;

// Seed auth header from existing token (avoids first-load race)
const savedToken = (() => {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("akkj_jwt");
})();
if (savedToken) {
  api.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
}

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function setAuthHandlers({ getRefreshToken: getter, onAuthSuccess: successCb, onAuthFailure: failureCb }) {
  getRefreshToken = getter;
  onAuthSuccess = successCb;
  onAuthFailure = failureCb;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;
    if (status === 401 && !originalRequest._retry && getRefreshToken) {
      originalRequest._retry = true;
      try {
        if (!isRefreshing) {
          isRefreshing = true;
          const refreshToken = getRefreshToken();
          if (!refreshToken) throw new Error("No refresh token");
          refreshPromise = api.post("/api/auth/refresh", { refreshToken });
        }
        const { data } = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;
        if (data?.token && onAuthSuccess) {
          onAuthSuccess(data.token, data.refreshToken);
        }
        setAuthToken(data?.token);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        refreshPromise = null;
        if (onAuthFailure) onAuthFailure();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
