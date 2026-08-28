import type { NextFunction, Request, Response } from "express";
import { AppError } from "@/utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

/**
 * Resolves the tenant a request operates on and pins it to req.tenantId.
 *
 * - tenant_admin / staff are hard-scoped to the tenant baked into their JWT.
 * - super_admin has no tenant of their own and must explicitly target one
 *   via ?tenantId=... (e.g. for support/debugging); this keeps "act as any
 *   tenant" an explicit, auditable choice rather than an implicit default.
 *
 * Every module service call receives req.tenantId and filters every query
 * by it, so a row belonging to another tenant is never reachable even if
 * an id is guessed or leaked.
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(AppError.unauthorized());
    return;
  }

  if (req.auth.role === "super_admin") {
    const queryTenantId = req.query.tenantId;
    if (typeof queryTenantId !== "string" || queryTenantId.length === 0) {
      next(AppError.badRequest("super_admin requests to tenant-scoped routes require a ?tenantId= query param"));
      return;
    }
    req.tenantId = queryTenantId;
    next();
    return;
  }

  if (!req.auth.tenantId) {
    next(AppError.forbidden("Account is not associated with a tenant"));
    return;
  }

  req.tenantId = req.auth.tenantId;
  next();
}
