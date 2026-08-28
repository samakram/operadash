import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAccessToken, type AccessTokenPayload } from "@/utils/jwt";
import { AppError } from "@/utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

const ACCESS_COOKIE = "operadash_access_token";
const REFRESH_COOKIE = "operadash_refresh_token";

export const COOKIE_NAMES = { ACCESS_COOKIE, REFRESH_COOKIE } as const;

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  if (!token) {
    next(AppError.unauthorized("Authentication required"));
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired session"));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(AppError.forbidden("You do not have permission to perform this action"));
      return;
    }
    next();
  };
}
