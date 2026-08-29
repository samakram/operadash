import type { NextFunction, Request, Response } from "express";
import type { ModuleName } from "@prisma/client";
import { isFeatureEnabled } from "@/services/featureFlag.service";
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
