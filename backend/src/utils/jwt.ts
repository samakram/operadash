import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";

export interface AccessTokenPayload {
  userId: string;
  tenantId: string | null;
  role: Role;
  permissions: string[];
  /** Set when a super_admin is impersonating this user — the super admin's own userId. */
  impersonatedBy?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  impersonatedBy?: string;
}

const ACCESS_SECRET = requireSecret("JWT_ACCESS_SECRET");
const REFRESH_SECRET = requireSecret("JWT_REFRESH_SECRET");
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ?? "24h") as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];

if (ACCESS_SECRET === REFRESH_SECRET) {
  // Reusing one secret means a stolen/leaked refresh token's signature is
  // also valid for signing access tokens (and vice versa) if the payload
  // shapes ever overlap — keep the two trust boundaries independent.
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values");
}

/** Requires the env var to be set AND long enough to resist brute-forcing the HMAC key. */
function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters — generate one with \`openssl rand -base64 32\``);
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
