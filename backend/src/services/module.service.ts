import type { ModuleName } from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";

export async function listModulesWithUsage() {
  const [modules, tenants] = await Promise.all([
    prisma.module.findMany({ orderBy: { name: "asc" } }),
    prisma.tenant.findMany({ select: { enabledModules: true } }),
  ]);

  const usage: Record<string, number> = {};
  for (const tenant of tenants) {
    for (const name of tenant.enabledModules) {
      usage[name] = (usage[name] ?? 0) + 1;
    }
  }

  return modules.map((module) => ({ ...module, tenantsUsing: usage[module.name] ?? 0 }));
}

export async function getModuleByName(name: ModuleName) {
  const module = await prisma.module.findUnique({ where: { name } });
  if (!module) {
    throw AppError.notFound("Module not found");
  }
  return module;
}

export interface UpdateModuleInput {
  version?: string;
  description?: string;
}

export async function updateModule(name: ModuleName, input: UpdateModuleInput) {
  await getModuleByName(name);
  return prisma.module.update({ where: { name }, data: input });
}
