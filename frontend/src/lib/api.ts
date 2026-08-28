import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

// In local dev, Vite proxies /api to the backend (see vite.config.ts) so a
// relative path works same-origin. In production the app (Vercel) and API
// (Railway) are different origins, so VITE_API_URL must point at the deployed
// backend's absolute URL, e.g. https://operadash-api.up.railway.app/api.
const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api` : "/api";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api.post("/auth/refresh").then(
      () => undefined,
      (err) => {
        throw err;
      },
    );
  }
  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retried && !original.url?.includes("/auth/")) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        window.dispatchEvent(new CustomEvent("operadash:session-expired"));
      }
    }

    return Promise.reject(error);
  },
);

export interface ApiErrorPayload {
  error: { code: string; message: string; details?: unknown };
}

export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorPayload | undefined;
    if (data?.error?.message) return data.error.message;
  }
  return fallback;
}
