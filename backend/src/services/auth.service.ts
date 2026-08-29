import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";
import { signAccessToken, signRefreshToken, verifyRefreshToken, type AccessTokenPayload } from "@/utils/jwt";
import { sendPasswordResetEmail } from "@/services/email.service";
import { logger } from "@/utils/logger";
import type { User } from "@prisma/client";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const BCRYPT_ROUNDS = 12;

// A precomputed hash of a random, never-used password. When the looked-up
// user doesn't exist, we still run bcrypt.compare against this so login
// takes the same amount of time either way — otherwise the "user not
// found" path returns near-instantly while "wrong password" takes ~bcrypt's
// full compare time, letting an attacker enumerate valid emails by timing.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8lo6bnvUpBaG.G/JJaB0hVKvhZi.Wq";

export function sanitizeUser(user: User) {
  const { password: _password, ...safe } = user;
  return safe;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  const matches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !user.active || !matches) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const accessToken = signAccessToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, tokenVersion: 0 });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.active) {
    throw AppError.unauthorized("Account is no longer active");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    impersonatedBy: payload.impersonatedBy,
  });
  return { user: sanitizeUser(user), accessToken };
}

/** Lets a super_admin sign in as a tenant's admin without knowing their password — e.g. to debug or demo their view. */
export async function impersonateTenant(superAdminId: string, tenantId: string) {
  const target = await prisma.user.findFirst({
    where: { tenantId, role: "tenant_admin", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!target) {
    throw AppError.notFound("This tenant has no active admin to sign in as");
  }

  const accessToken = signAccessToken({
    userId: target.id,
    tenantId: target.tenantId,
    role: target.role,
    impersonatedBy: superAdminId,
  });
  const refreshToken = signRefreshToken({ userId: target.id, tokenVersion: 0, impersonatedBy: superAdminId });

  return { user: sanitizeUser(target), accessToken, refreshToken };
}

/** Ends an impersonation session and restores the original super_admin's own session. */
export async function returnToAdmin(auth: AccessTokenPayload) {
  if (!auth.impersonatedBy) {
    throw AppError.badRequest("Not currently impersonating a tenant");
  }

  const superAdmin = await prisma.user.findUnique({ where: { id: auth.impersonatedBy } });
  if (!superAdmin || !superAdmin.active || superAdmin.role !== "super_admin") {
    throw AppError.unauthorized("The original admin account is no longer available");
  }

  const accessToken = signAccessToken({ userId: superAdmin.id, tenantId: superAdmin.tenantId, role: superAdmin.role });
  const refreshToken = signRefreshToken({ userId: superAdmin.id, tokenVersion: 0 });

  return { user: sanitizeUser(superAdmin), accessToken, refreshToken };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.notFound("User not found");
  }
  return sanitizeUser(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw AppError.notFound("User not found");
  }

  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) {
    throw AppError.badRequest("Current password is incorrect");
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
}

/**
 * Always resolves, whether or not the email belongs to an account — the
 * caller (the route) returns the same generic "check your inbox" response
 * either way, so there's no status-code side-channel here the way there
 * was for login. We don't bother with a login-style constant-time dummy
 * hash for the (much smaller and already rate-limited) timing side-channel
 * this leaves, since there's no cheap equivalent of "always bcrypt.compare"
 * for an index lookup — the tradeoff isn't worth the complexity here.
 */
export async function requestPasswordReset(email: string, buildResetUrl: (token: string) => string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) return;

  const rawToken = crypto.randomBytes(32).toString("base64url");

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  try {
    await sendPasswordResetEmail(user.email, buildResetUrl(rawToken));
  } catch (err) {
    // Don't fail the request over an email-delivery problem — the user
    // already got a generic "check your inbox" response either way, and
    // failing loudly here would leak "this email exists" via a 500.
    logger.error({ err, userId: user.id }, "Failed to send password reset email");
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw AppError.badRequest("This reset link is invalid or has expired");
  }

  const hashed = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashed } }),
    // Marking every outstanding token used (not just this one) means an
    // older, previously-leaked reset link for the same account stops
    // working the moment any one of them is redeemed.
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
}
