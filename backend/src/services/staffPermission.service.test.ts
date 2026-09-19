import { describe, expect, it } from "vitest";
import type { StaffPermission } from "@prisma/client";
import { prismaMock } from "@/test/prismaMock";
import * as staffPermissionService from "@/services/staffPermission.service";

const USER_ID = "user-1";

function makeRow(overrides: Partial<StaffPermission> = {}): StaffPermission {
  return {
    id: "perm-1",
    userId: USER_ID,
    moduleName: "hotel",
    featureName: "invoices",
    allowed: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("staffPermission.service", () => {
  it("defaults to allowed when no override row exists", async () => {
    prismaMock.staffPermission.findUnique.mockResolvedValue(null);
    await expect(staffPermissionService.isStaffFeatureAllowed(USER_ID, "hotel", "invoices")).resolves.toBe(true);
  });

  it("respects an explicit denial override", async () => {
    prismaMock.staffPermission.findUnique.mockResolvedValue(makeRow({ allowed: false }));
    await expect(staffPermissionService.isStaffFeatureAllowed(USER_ID, "hotel", "invoices")).resolves.toBe(false);
  });

  it("setStaffPermission(allowed: true) deletes the override instead of storing a no-op row", async () => {
    await staffPermissionService.setStaffPermission(USER_ID, "hotel", "invoices", true);
    expect(prismaMock.staffPermission.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, moduleName: "hotel", featureName: "invoices" },
    });
    expect(prismaMock.staffPermission.upsert).not.toHaveBeenCalled();
  });

  it("setStaffPermission(allowed: false) upserts a denial row", async () => {
    await staffPermissionService.setStaffPermission(USER_ID, "hotel", "invoices", false);
    expect(prismaMock.staffPermission.upsert).toHaveBeenCalledWith({
      where: { userId_moduleName_featureName: { userId: USER_ID, moduleName: "hotel", featureName: "invoices" } },
      create: { userId: USER_ID, moduleName: "hotel", featureName: "invoices", allowed: false },
      update: { allowed: false },
    });
  });
});
