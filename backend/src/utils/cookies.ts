import type { Response } from "express";
import { COOKIE_NAMES } from "@/middleware/auth";

const isProd = process.env.NODE_ENV === "production";
// In production the API and app live on different domains by default, so the
// session cookie needs SameSite=None, which browsers only honor when Secure
// is also set. Locally, Vite proxies /api so the app is same-origin and plain
// Lax works without needing HTTPS in dev.
const isSecure = process.env.COOKIE_SECURE === "true" || isProd;
const cookieBase = {
  httpOnly: true,
  secure: isSecure,
  sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
  path: "/",
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken?: string): void {
  res.cookie(COOKIE_NAMES.ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: 24 * 60 * 60 * 1000 });
  if (refreshToken) {
    res.cookie(COOKIE_NAMES.REFRESH_COOKIE, refreshToken, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS_COOKIE, cookieBase);
  res.clearCookie(COOKIE_NAMES.REFRESH_COOKIE, cookieBase);
}
