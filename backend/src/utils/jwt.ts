import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";

export interface AccessTokenPayload {
  userId: string;
  tenantId: string | null;
  role: Role;
  permissions: string[];
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

const ACCESS_SECRET = requireEnv("JWT_ACCESS_SECRET");
const REFRESH_SECRET = requireEnv("JWT_REFRESH_SECRET");
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ?? "24h") as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  super_admin: ["platform:*"],
  tenant_admin: ["tenant:*"],
  staff: ["tenant:read", "tenant:write:assigned"],
};

export function permissionsForRole(role: Role): string[] {
  return ROLE_PERMISSIONS[role];
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "permissions">): string {
  const fullPayload: AccessTokenPayload = { ...payload, permissions: permissionsForRole(payload.role) };
  return jwt.sign(fullPayload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
}
