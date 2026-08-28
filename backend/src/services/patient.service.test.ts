import { describe, expect, it } from "vitest";
import type { PatientPatient, PatientProvider } from "@prisma/client";
import { prismaMock } from "@/test/prismaMock";
import * as patientService from "@/services/patient.service";

const TENANT_ID = "tenant-1";

function makePatient(overrides: Partial<PatientPatient> = {}): PatientPatient {
  return {
    id: "patient-1",
    tenantId: TENANT_ID,
    firstName: "Jamie",
    lastName: "Rivera",
    email: null,
    phone: null,
    dateOfBirth: new Date("1990-01-01"),
    gender: null,
    address: null,
    city: null,
    country: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    medicalHistorySummary: null,
    allergies: [],
    chronicConditions: [],
    bloodType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProvider(overrides: Partial<PatientProvider> = {}): PatientProvider {
  return {
    id: "provider-1",
    tenantId: TENANT_ID,
    firstName: "Dana",
    lastName: "Lee",
    email: null,
    phone: null,
    specialization: null,
    licenseNumber: null,
    bio: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("patient.service — createVitalSign BMI calculation", () => {
  it("computes BMI from weight (kg) and height (cm) when not explicitly given", async () => {
    prismaMock.patientPatient.findFirst.mockResolvedValue(makePatient());
    prismaMock.patientVitalSign.create.mockImplementation(({ data }) => Promise.resolve(data) as never);

    const result = await patientService.createVitalSign(TENANT_ID, {
      patientId: "patient-1",
      visitDate: new Date("2026-01-01"),
      weight: 70,
      height: 175,
    });

    // 70 / (1.75^2) = 22.857... -> rounded to 1 decimal
    expect(result.bmi).toBe(22.9);
  });

  it("leaves BMI undefined when only one of weight/height is provided", async () => {
    prismaMock.patientPatient.findFirst.mockResolvedValue(makePatient());
    prismaMock.patientVitalSign.create.mockImplementation(({ data }) => Promise.resolve(data) as never);

    const result = await patientService.createVitalSign(TENANT_ID, {
      patientId: "patient-1",
      visitDate: new Date("2026-01-01"),
      weight: 70,
    });

    expect(result.bmi).toBeUndefined();
  });

  it("doesn't overwrite an explicitly-provided BMI", async () => {
    prismaMock.patientPatient.findFirst.mockResolvedValue(makePatient());
    prismaMock.patientVitalSign.create.mockImplementation(({ data }) => Promise.resolve(data) as never);

    const result = await patientService.createVitalSign(TENANT_ID, {
      patientId: "patient-1",
      visitDate: new Date("2026-01-01"),
      weight: 70,
      height: 175,
      bmi: 99, // caller override, however implausible
    });

    expect(result.bmi).toBe(99);
  });
});

describe("patient.service — createPrescription allergy/duplicate checks", () => {
  it("hard-blocks a prescription that matches a documented allergy (case-insensitive)", async () => {
    prismaMock.patientPatient.findFirst.mockResolvedValue(makePatient({ allergies: ["Penicillin"] }));
    prismaMock.patientProvider.findFirst.mockResolvedValue(makeProvider());

    await expect(
      patientService.createPrescription(TENANT_ID, {
        patientId: "patient-1",
        medicationName: "penicillin V potassium",
        dosage: "500mg",
        frequency: "twice_daily",
        startDate: new Date("2026-01-01"),
        prescribingProviderId: "provider-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.patientPrescription.create).not.toHaveBeenCalled();
  });

  it("allows a non-conflicting prescription and flags an existing active prescription as a duplicate-therapy warning", async () => {
    prismaMock.patientPatient.findFirst.mockResolvedValue(makePatient({ allergies: ["Penicillin"] }));
    prismaMock.patientProvider.findFirst.mockResolvedValue(makeProvider());
    prismaMock.patientPrescription.findFirst.mockResolvedValue({ id: "existing-rx" } as never);
    prismaMock.patientPrescription.create.mockResolvedValue({ id: "new-rx" } as never);

    const result = await patientService.createPrescription(TENANT_ID, {
      patientId: "patient-1",
      medicationName: "Amoxicillin",
      dosage: "250mg",
      frequency: "once_daily",
      startDate: new Date("2026-01-01"),
      prescribingProviderId: "provider-1",
    });

    expect(result.warnings).toEqual([expect.stringContaining("duplicate therapy")]);
  });

  it("returns no warnings when there's no allergy conflict and no existing active prescription", async () => {
    prismaMock.patientPatient.findFirst.mockResolvedValue(makePatient({ allergies: [] }));
    prismaMock.patientProvider.findFirst.mockResolvedValue(makeProvider());
    prismaMock.patientPrescription.findFirst.mockResolvedValue(null);
    prismaMock.patientPrescription.create.mockResolvedValue({ id: "new-rx" } as never);

    const result = await patientService.createPrescription(TENANT_ID, {
      patientId: "patient-1",
      medicationName: "Ibuprofen",
      dosage: "200mg",
      frequency: "as_needed",
      startDate: new Date("2026-01-01"),
      prescribingProviderId: "provider-1",
    });

    expect(result.warnings).toEqual([]);
  });
});
