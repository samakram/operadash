import type { ModuleName } from "@prisma/client";
import { prisma } from "@/database/db";
import { FEATURE_CATALOG } from "@/utils/featureCatalog";

export interface FeatureFlagView {
  moduleName: ModuleName;
  featureName: string;
  label: string;
  enabled: boolean;
}

/** A row's absence means enabled — flags exist to turn things off, not to opt in. */
export async function listFeatureFlags(tenantId: string): Promise<FeatureFlagView[]> {
  const overrides = await prisma.featureFlag.findMany({ where: { tenantId } });
  const overrideMap = new Map(overrides.map((o) => [`${o.moduleName}:${o.featureName}`, o.enabled]));

  const result: FeatureFlagView[] = [];
  for (const [moduleName, features] of Object.entries(FEATURE_CATALOG) as [ModuleName, typeof FEATURE_CATALOG.hotel][]) {
    for (const feature of features) {
      const override = overrideMap.get(`${moduleName}:${feature.key}`);
      result.push({ moduleName, featureName: feature.key, label: feature.label, enabled: override ?? true });
    }
  }
  return result;
}

export async function setFeatureFlag(tenantId: string, moduleName: ModuleName, featureName: string, enabled: boolean): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { tenantId_moduleName_featureName: { tenantId, moduleName, featureName } },
    create: { tenantId, moduleName, featureName, enabled },
    update: { enabled },
  });
}

/** Used by requireFeature() — a single flag lookup, defaulting to enabled when no override row exists. */
export async function isFeatureEnabled(tenantId: string, moduleName: ModuleName, featureName: string): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({
    where: { tenantId_moduleName_featureName: { tenantId, moduleName, featureName } },
  });
  return row?.enabled ?? true;
}
