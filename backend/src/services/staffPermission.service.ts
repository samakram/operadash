import type { ModuleName } from "@prisma/client";
import { prisma } from "@/database/db";
import { FEATURE_CATALOG } from "@/utils/featureCatalog";

/**
 * Per-staff-member override on top of FeatureFlag. FeatureFlag turns a
 * sub-feature on/off for the whole tenant; this lets a tenant admin
 * additionally hide a feature that's tenant-wide enabled from one specific
 * staff account (e.g. a front-desk hire who shouldn't see Billing). Row
 * absence means allowed, matching FeatureFlag's own convention, so granting
 * this system doesn't silently lock out every existing staff account.
 */
export async function isStaffFeatureAllowed(userId: string, moduleName: ModuleName, featureName: string): Promise<boolean> {
  const row = await prisma.staffPermission.findUnique({
    where: { userId_moduleName_featureName: { userId, moduleName, featureName } },
  });
  return row?.allowed ?? true;
}

export interface StaffPermissionRow {
  module: ModuleName;
  key: string;
  label: string;
  allowed: boolean;
}

/** The full feature catalog for every module, merged with this user's overrides — for the admin UI. */
export async function listPermissionsForUser(userId: string): Promise<StaffPermissionRow[]> {
  const overrides = await prisma.staffPermission.findMany({ where: { userId } });
  const overrideMap = new Map(overrides.map((o) => [`${o.moduleName}:${o.featureName}`, o.allowed]));

  const rows: StaffPermissionRow[] = [];
  for (const [module, features] of Object.entries(FEATURE_CATALOG) as [ModuleName, { key: string; label: string }[]][]) {
    for (const feature of features) {
      rows.push({
        module,
        key: feature.key,
        label: feature.label,
        allowed: overrideMap.get(`${module}:${feature.key}`) ?? true,
      });
    }
  }
  return rows;
}

export async function setStaffPermission(userId: string, moduleName: ModuleName, featureName: string, allowed: boolean): Promise<void> {
  if (allowed) {
    // Back to the default — drop the override instead of storing a no-op row.
    await prisma.staffPermission.deleteMany({ where: { userId, moduleName, featureName } });
    return;
  }
  await prisma.staffPermission.upsert({
    where: { userId_moduleName_featureName: { userId, moduleName, featureName } },
    create: { userId, moduleName, featureName, allowed: false },
    update: { allowed: false },
  });
}
