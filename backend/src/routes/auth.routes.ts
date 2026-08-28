import { Router } from "express";
import { z } from "zod";
import * as authService from "@/services/auth.service";
import { authenticate, COOKIE_NAMES } from "@/middleware/auth";
import { AppError } from "@/utils/errors";

const router = Router();

const isProd = process.env.NODE_ENV === "production";
// In production the API (Railway) and app (Vercel) live on different domains,
// so the session cookie is cross-site: it needs SameSite=None, which browsers
// only honor when Secure is also set. Locally, Vite proxies /api so the app is
// same-origin and plain Lax works without needing HTTPS in dev.
const isSecure = process.env.COOKIE_SECURE === "true" || isProd;
const cookieBase = {
  httpOnly: true,
  secure: isSecure,
  sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
  path: "/",
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    res.cookie(COOKIE_NAMES.ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: 24 * 60 * 60 * 1000 });
    res.cookie(COOKIE_NAMES.REFRESH_COOKIE, refreshToken, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAMES.ACCESS_COOKIE, cookieBase);
  res.clearCookie(COOKIE_NAMES.REFRESH_COOKIE, cookieBase);
  res.status(204).send();
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw AppError.unauthorized("No refresh token provided");
    }
    const { user, accessToken } = await authService.refreshAccessToken(refreshToken);
    res.cookie(COOKIE_NAMES.ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.auth!.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.auth!.userId, currentPassword, newPassword);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
