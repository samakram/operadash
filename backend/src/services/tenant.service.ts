import crypto from "node:crypto";
import type { ModuleName, PlanTier, Prisma } from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";
import { hashPassword, sanitizeUser } from "@/services/auth.service";
import { buildPaginatedResult, type PaginationQuery } from "@/utils/validators";

export interface CreateTenantInput {
  name: string;
  subdomain: string;
  domain?: string;
  plan: PlanTier;
  enabledModules: ModuleName[];
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
}

export function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function createTenant(input: CreateTenantInput) {
  const existing = await prisma.tenant.findUnique({ where: { subdomain: input.subdomain } });
  if (existing) {
    throw AppError.conflict("A tenant with this subdomain already exists");
  }

  const tempPassword = generateTempPassword();
  const hashedPassword = await hashPassword(tempPassword);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        subdomain: input.subdomain,
        domain: input.domain,
        plan: input.plan,
        enabledModules: input.enabledModules,
      },
    });

    const admin = await tx.user.create({
      data: {
        email: input.adminEmail.toLowerCase(),
        password: hashedPassword,
        tenantId: tenant.id,
        role: "tenant_admin",
        firstName: input.adminFirstName,
        lastName: input.adminLastName,
      },
    });

    return { tenant, admin };
  });

  return { tenant: result.tenant, admin: sanitizeUser(result.admin), tempPassword };
}

export async function listTenants(query: PaginationQuery) {
  const where: Prisma.TenantWhereInput = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { subdomain: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.tenant.count({ where }),
  ]);

  return buildPaginatedResult(data, total, query);
}

export async function getTenantById(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { users: { orderBy: { createdAt: "asc" } } },
  });
  if (!tenant) {
    throw AppError.notFound("Tenant not found");
  }
  const { users, ...rest } = tenant;
  return { ...rest, users: users.map(sanitizeUser) };
}

export interface UpdateTenantInput {
  name?: string;
  domain?: string | null;
  plan?: PlanTier;
  logoUrl?: string | null;
  settings?: Record<string, unknown>;
  active?: boolean;
}

export async function updateTenant(tenantId: string, input: UpdateTenantInput) {
  await ensureTenantExists(tenantId);
  return prisma.tenant.update({
    where: { id: tenantId },
    data: input as Prisma.TenantUpdateInput,
  });
}

export async function setTenantModules(tenantId: string, modules: ModuleName[]) {
  await ensureTenantExists(tenantId);
  return prisma.tenant.update({ where: { id: tenantId }, data: { enabledModules: modules } });
}

async function ensureTenantExists(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) {
    throw AppError.notFound("Tenant not found");
  }
}

/**
 * Hard-deletes a tenant and every row it owns. Module tables are not
 * DB-level foreign-keyed to tenants (see schema notes), so children are
 * removed explicitly in dependency order before the tenant row itself
 * (whose deletion cascades to `users` via the declared FK).
 */
export async function deleteTenant(tenantId: string): Promise<void> {
  await ensureTenantExists(tenantId);

  await prisma.$transaction([
    prisma.hotelInvoice.deleteMany({ where: { tenantId } }),
    prisma.hotelMaintenanceRequest.deleteMany({ where: { tenantId } }),
    prisma.hotelStaffAssignment.deleteMany({ where: { tenantId } }),
    prisma.hotelReservation.deleteMany({ where: { tenantId } }),
    prisma.hotelRoom.deleteMany({ where: { tenantId } }),
    prisma.hotelGuest.deleteMany({ where: { tenantId } }),

    prisma.studentTuitionRecord.deleteMany({ where: { tenantId } }),
    prisma.studentGrade.deleteMany({ where: { tenantId } }),
    prisma.studentAttendance.deleteMany({ where: { tenantId } }),
    prisma.studentEnrollment.deleteMany({ where: { tenantId } }),
    prisma.studentAnnouncement.deleteMany({ where: { tenantId } }),
    prisma.studentClass.deleteMany({ where: { tenantId } }),
    prisma.studentStudent.deleteMany({ where: { tenantId } }),
    prisma.studentInstructor.deleteMany({ where: { tenantId } }),

    prisma.patientBilling.deleteMany({ where: { tenantId } }),
    prisma.patientLabResult.deleteMany({ where: { tenantId } }),
    prisma.patientVitalSign.deleteMany({ where: { tenantId } }),
    prisma.patientPrescription.deleteMany({ where: { tenantId } }),
    prisma.patientMedicalRecord.deleteMany({ where: { tenantId } }),
    prisma.patientAppointment.deleteMany({ where: { tenantId } }),
    prisma.patientInsurance.deleteMany({ where: { tenantId } }),
    prisma.patientPatient.deleteMany({ where: { tenantId } }),
    prisma.patientProvider.deleteMany({ where: { tenantId } }),

    prisma.restaurantInventoryLog.deleteMany({ where: { tenantId } }),
    prisma.restaurantOrderItem.deleteMany({ where: { tenantId } }),
    prisma.restaurantOrder.deleteMany({ where: { tenantId } }),
    prisma.restaurantReservation.deleteMany({ where: { tenantId } }),
    prisma.restaurantMenuItem.deleteMany({ where: { tenantId } }),
    prisma.restaurantInventory.deleteMany({ where: { tenantId } }),
    prisma.restaurantTable.deleteMany({ where: { tenantId } }),
    prisma.restaurantCustomer.deleteMany({ where: { tenantId } }),
    prisma.restaurantStaffShift.deleteMany({ where: { tenantId } }),

    prisma.featureFlag.deleteMany({ where: { tenantId } }),
    prisma.auditLog.deleteMany({ where: { tenantId } }),

    prisma.tenant.delete({ where: { id: tenantId } }),
  ]);
}

interface GrowthPoint {
  date: string;
  count: number;
}

/** Cumulative count of rows created on/before each day, for the last N days — real data, not synthetic. */
async function cumulativeGrowth(table: "tenants" | "users", days: number): Promise<GrowthPoint[]> {
  const rows = await prisma.$queryRawUnsafe<{ day: Date; count: bigint }[]>(
    `
    with days as (
      select generate_series(current_date - $1::int, current_date, interval '1 day')::date as day
    )
    select
      days.day,
      (select count(*) from ${table} t where t.created_at::date <= days.day) as count
    from days
    order by days.day asc
    `,
    days,
  );

  return rows.map((row) => ({ date: row.day.toISOString().slice(0, 10), count: Number(row.count) }));
}

export async function getPlatformAnalytics() {
  const [tenantCount, activeTenantCount, userCount, tenants] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { active: true } }),
    prisma.user.count(),
    prisma.tenant.findMany({ select: { monthlyRevenue: true, enabledModules: true, createdAt: true, active: true } }),
  ]);

  const totalRevenue = tenants.reduce((sum, t) => sum + Number(t.monthlyRevenue), 0);

  const moduleUsage: Record<string, number> = {};
  for (const tenant of tenants) {
    for (const moduleName of tenant.enabledModules) {
      moduleUsage[moduleName] = (moduleUsage[moduleName] ?? 0) + 1;
    }
  }

  const [tenantGrowth, userGrowth] = await Promise.all([cumulativeGrowth("tenants", 30), cumulativeGrowth("users", 30)]);

  return {
    totalRevenue,
    activeTenants: activeTenantCount,
    totalTenants: tenantCount,
    totalUsers: userCount,
    moduleUsage,
    inactiveTenants: tenantCount - activeTenantCount,
    tenantGrowth,
    userGrowth,
  };
}
