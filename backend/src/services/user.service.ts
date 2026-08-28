import type { Role } from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";
import { hashPassword, sanitizeUser } from "@/services/auth.service";
import { generateTempPassword } from "@/services/tenant.service";
import { sendWelcomeEmail } from "@/services/email.service";
import { logger } from "@/utils/logger";
import { buildPaginatedResult, type PaginationQuery } from "@/utils/validators";

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  tenantId: string | null;
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw AppError.conflict("A user with this email already exists");
  }

  const tempPassword = generateTempPassword();
  const password = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      password,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      tenantId: input.tenantId,
    },
  });

  try {
    const tenantName = user.tenantId
      ? ((await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }))?.name ?? "OperaDash")
      : "OperaDash";
    await sendWelcomeEmail(user.email, input.firstName, tenantName, tempPassword);
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send user welcome email");
  }

  return { user: sanitizeUser(user), tempPassword };
}

export async function listUsersForTenant(tenantId: string, query: PaginationQuery) {
  const where = {
    tenantId,
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" as const } },
            { firstName: { contains: query.search, mode: "insensitive" as const } },
            { lastName: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return buildPaginatedResult(data.map(sanitizeUser), total, query);
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  active?: boolean;
}

export async function updateUser(userId: string, tenantId: string | null, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (tenantId !== null && user.tenantId !== tenantId)) {
    throw AppError.notFound("User not found");
  }
  const updated = await prisma.user.update({ where: { id: userId }, data: input });
  return sanitizeUser(updated);
}

export async function deleteUser(userId: string, tenantId: string | null): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (tenantId !== null && user.tenantId !== tenantId)) {
    throw AppError.notFound("User not found");
  }
  await prisma.user.delete({ where: { id: userId } });
}
