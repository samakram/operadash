import bcrypt from "bcryptjs";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/utils/jwt";
import type { User } from "@prisma/client";

const BCRYPT_ROUNDS = 12;

export function sanitizeUser(user: User) {
  const { password: _password, ...safe } = user;
  return safe;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
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

  const accessToken = signAccessToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
  return { user: sanitizeUser(user), accessToken };
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
