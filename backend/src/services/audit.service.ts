import { prisma } from "@/database/db";
import { buildPaginatedResult, paginationToPrisma, type PaginationQuery } from "@/utils/validators";

export interface AuditLogQuery extends PaginationQuery {
  action?: string;
  entityType?: string;
}

export async function listAuditLogs(tenantId: string, query: AuditLogQuery) {
  const where = {
    tenantId,
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.search
      ? {
          OR: [
            { entityType: { contains: query.search, mode: "insensitive" as const } },
            { action: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total, users] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { timestamp: "desc" }, ...paginationToPrisma(query) }),
    prisma.auditLog.count({ where }),
    // Includes super_admins too (tenantId: null) — some rows for this tenant were
    // written by a super_admin acting on it (e.g. impersonation), not one of its own users.
    prisma.user.findMany({ where: { OR: [{ tenantId }, { role: "super_admin" }] }, select: { id: true, firstName: true, lastName: true, email: true } }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const enriched = data.map((row) => ({ ...row, user: userMap.get(row.userId) ?? null }));

  return buildPaginatedResult(enriched, total, query);
}

/** Distinct action/entityType values seen for this tenant — powers the filter dropdowns. */
export async function listAuditLogFacets(tenantId: string) {
  const [actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({ where: { tenantId }, select: { action: true }, distinct: ["action"] }),
    prisma.auditLog.findMany({ where: { tenantId }, select: { entityType: true }, distinct: ["entityType"] }),
  ]);
  return { actions: actions.map((a) => a.action), entityTypes: entityTypes.map((e) => e.entityType) };
}
