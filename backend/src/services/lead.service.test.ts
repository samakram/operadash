import { describe, expect, it } from "vitest";
import type { Lead } from "@prisma/client";
import { prismaMock } from "@/test/prismaMock";
import * as leadService from "@/services/lead.service";

const TENANT_ID = "tenant-1";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    tenantId: TENANT_ID,
    module: "hotel",
    title: "Corporate retreat",
    contactName: "Jordan Rivera",
    contactEmail: "jordan@example.com",
    contactPhone: "555-0100",
    estimatedValue: null,
    stage: "won",
    source: null,
    notes: null,
    assignedToUserId: null,
    position: 0,
    convertedRecordId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("lead.service — convertLead", () => {
  it("creates the matching hotel guest and stamps convertedRecordId", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead());
    prismaMock.hotelGuest.create.mockResolvedValue({ id: "guest-1" } as never);
    prismaMock.lead.update.mockImplementation(({ data }) => Promise.resolve({ ...makeLead(), ...data }) as never);

    const result = await leadService.convertLead(TENANT_ID, "lead-1");

    expect(prismaMock.hotelGuest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: TENANT_ID, firstName: "Jordan", lastName: "Rivera", email: "jordan@example.com" }),
    });
    expect(prismaMock.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { convertedRecordId: "guest-1" } });
    expect(result.convertedRecordId).toBe("guest-1");
  });

  it("rejects converting a lead that isn't in the Won stage", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead({ stage: "qualified" }));

    await expect(leadService.convertLead(TENANT_ID, "lead-1")).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.hotelGuest.create).not.toHaveBeenCalled();
  });

  it("rejects converting a lead that was already converted", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead({ convertedRecordId: "guest-existing" }));

    await expect(leadService.convertLead(TENANT_ID, "lead-1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("requires a dateOfBirth to convert a patient-module lead", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead({ module: "patient" }));

    await expect(leadService.convertLead(TENANT_ID, "lead-1")).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.patientPatient.create).not.toHaveBeenCalled();
  });

  it("creates the patient record when a dateOfBirth is supplied", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead({ module: "patient" }));
    prismaMock.patientPatient.create.mockResolvedValue({ id: "patient-1" } as never);
    prismaMock.lead.update.mockImplementation(({ data }) => Promise.resolve({ ...makeLead(), ...data }) as never);

    const result = await leadService.convertLead(TENANT_ID, "lead-1", { dateOfBirth: "1990-01-01" });

    expect(result.convertedRecordId).toBe("patient-1");
  });
});
