import type { Prisma } from "@prisma/client";
import { prisma } from "@/database/db";
import type { Request } from "express";

export async function recordAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string | null,
  changes?: Record<string, unknown>,
): Promise<void> {
  if (!req.tenantId || !req.auth) return;

  await prisma.auditLog.create({
    data: {
      tenantId: req.tenantId,
      userId: req.auth.userId,
      action,
      entityType,
      entityId,
      changes: changes as Prisma.InputJsonValue | undefined,
      ipAddress: req.ip,
    },
  });
}
