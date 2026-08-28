import type { NextFunction, Request, Response } from "express";
import type { ModuleName } from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";

/** Ensures the resolved tenant actually has this module enabled on their plan. */
export function requireModule(moduleName: ModuleName) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenantId) {
        throw AppError.forbidden("No tenant resolved for this request");
      }
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { enabledModules: true, active: true },
      });
      if (!tenant) {
        throw AppError.notFound("Tenant not found");
      }
      if (!tenant.active) {
        throw AppError.forbidden("This tenant account is disabled");
      }
      if (!tenant.enabledModules.includes(moduleName)) {
        throw AppError.forbidden(`The ${moduleName} module is not enabled for this tenant`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
