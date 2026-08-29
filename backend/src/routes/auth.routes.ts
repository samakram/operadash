import { Router } from "express";
import { z } from "zod";
import * as authService from "@/services/auth.service";
import { authenticate, COOKIE_NAMES } from "@/middleware/auth";
import { authRateLimit } from "@/middleware/rateLimit";
import { AppError } from "@/utils/errors";
import { setAuthCookies, clearAuthCookies } from "@/utils/cookies";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    setAuthCookies(res, accessToken, refreshToken);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.status(204).send();
});

router.post("/refresh", authRateLimit, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw AppError.unauthorized("No refresh token provided");
    }
    const { user, accessToken } = await authService.refreshAccessToken(refreshToken);
    setAuthCookies(res, accessToken);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/return-to-admin", authenticate, async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.returnToAdmin(req.auth!);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.auth!.userId);
    res.json({ user, impersonating: Boolean(req.auth!.impersonatedBy) });
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/change-password", authenticate, authRateLimit, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.auth!.userId, currentPassword, newPassword);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const forgotPasswordSchema = z.object({ email: z.string().email() });

router.post("/forgot-password", authRateLimit, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const frontendOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
    await authService.requestPasswordReset(email, (token) => `${frontendOrigin}/reset-password?token=${token}`);
    // Identical response whether or not the account exists — the account's
    // existence must never be inferable from this endpoint's response.
    res.status(202).json({ message: "If that email has an account, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/reset-password", authRateLimit, async (req, res, next) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, newPassword);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
