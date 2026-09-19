import type { NextFunction, Request, Response } from "express";
import type { ModuleName } from "@prisma/client";
import { isFeatureEnabled } from "@/services/featureFlag.service";
import { isStaffFeatureAllowed } from "@/services/staffPermission.service";
import { AppError } from "@/utils/errors";

/** Gates an optional module sub-feature a tenant admin has turned off — see utils/featureCatalog.ts. */
export function requireFeature(moduleName: ModuleName, featureName: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenantId) {
        throw AppError.forbidden("No tenant resolved for this request");
      }
      const enabled = await isFeatureEnabled(req.tenantId, moduleName, featureName);
      if (!enabled) {
        throw AppError.forbidden(`This feature is turned off for your account`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Gates a sub-feature for one specific staff member, on top of the
 * tenant-wide requireFeature check — see services/staffPermission.service.ts.
 * tenant_admin and super_admin are never restricted by this: it's a tool
 * admins use to scope staff, not something that can lock an admin out.
 */
export function requireStaffFeature(moduleName: ModuleName, featureName: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        throw AppError.unauthorized();
      }
      if (req.auth.role !== "staff") {
        next();
        return;
      }
      const allowed = await isStaffFeatureAllowed(req.auth.userId, moduleName, featureName);
      if (!allowed) {
        throw AppError.forbidden("You do not have permission to access this feature");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
