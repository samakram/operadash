import type {
  AppointmentStatus,
  ClaimStatus,
  LabStatus,
  Prisma,
  PrescriptionFrequency,
} from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";
import { buildPaginatedResult, type PaginationQuery } from "@/utils/validators";

// ============================================================
// Shared helpers
// ============================================================

function resolveSort<TOrderBy extends object>(query: PaginationQuery, allowed: readonly string[], fallback: string): TOrderBy {
  const field = query.sortBy && allowed.includes(query.sortBy) ? query.sortBy : fallback;
  return { [field]: query.sortDir } as TOrderBy;
}

function pageWindow(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

const EXPORT_ROW_LIMIT = 5000;

function isDecimalLike(value: object): value is { toNumber: () => number } {
  return typeof (value as { toNumber?: unknown }).toNumber === "function";
}

/** Flattens a Prisma row (Decimals, Dates, arrays, nested relations) into CSV-safe primitives. */
function serializeForCsv(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      out[key] = "";
    } else if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      out[key] = value.join(", ");
    } else if (typeof value === "object") {
      if (isDecimalLike(value)) {
        out[key] = value.toNumber();
      } else {
        const obj = value as Record<string, unknown>;
        if ("firstName" in obj || "lastName" in obj) {
          out[key] = `${(obj.firstName as string) ?? ""} ${(obj.lastName as string) ?? ""}`.trim();
        } else {
          out[key] = JSON.stringify(obj);
        }
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function assertPatientExists(tenantId: string, patientId: string): Promise<void> {
  const patient = await prisma.patientPatient.findFirst({ where: { id: patientId, tenantId }, select: { id: true } });
  if (!patient) throw AppError.badRequest("Referenced patient does not exist for this tenant");
}

async function assertProviderExists(tenantId: string, providerId: string): Promise<void> {
  const provider = await prisma.patientProvider.findFirst({ where: { id: providerId, tenantId }, select: { id: true } });
  if (!provider) throw AppError.badRequest("Referenced provider does not exist for this tenant");
}

// ============================================================
// PATIENTS
// ============================================================

export interface PatientInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth: Date;
  gender?: string;
  address?: string;
  city?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalHistorySummary?: string;
  allergies?: string[];
  chronicConditions?: string[];
  bloodType?: string;
}

const PATIENT_SORT_FIELDS = ["firstName", "lastName", "dateOfBirth", "city", "createdAt"] as const;

function buildPatientWhere(tenantId: string, search?: string): Prisma.PatientPatientWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listPatients(tenantId: string, query: PaginationQuery) {
  const where = buildPatientWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientPatientOrderByWithRelationInput>(query, PATIENT_SORT_FIELDS, "createdAt");
  const [data, total] = await Promise.all([
    prisma.patientPatient.findMany({ where, orderBy, ...pageWindow(query) }),
    prisma.patientPatient.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportPatients(tenantId: string, search?: string) {
  const rows = await prisma.patientPatient.findMany({
    where: buildPatientWhere(tenantId, search),
    orderBy: { createdAt: "desc" },
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

export async function createPatient(tenantId: string, input: PatientInput) {
  return prisma.patientPatient.create({ data: { tenantId, ...input } });
}

export async function updatePatient(tenantId: string, id: string, input: Partial<PatientInput>) {
  const existing = await prisma.patientPatient.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Patient not found");
  return prisma.patientPatient.update({ where: { id }, data: input });
}

export async function deletePatient(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientPatient.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Patient not found");
  await prisma.patientPatient.delete({ where: { id } });
}

// ============================================================
// PROVIDERS
// ============================================================

export interface ProviderInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialization?: string;
  licenseNumber?: string;
  bio?: string;
}

const PROVIDER_SORT_FIELDS = ["firstName", "lastName", "specialization", "createdAt"] as const;

function buildProviderWhere(tenantId: string, search?: string): Prisma.PatientProviderWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { specialization: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listProviders(tenantId: string, query: PaginationQuery) {
  const where = buildProviderWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientProviderOrderByWithRelationInput>(query, PROVIDER_SORT_FIELDS, "createdAt");
  const [data, total] = await Promise.all([
    prisma.patientProvider.findMany({ where, orderBy, ...pageWindow(query) }),
    prisma.patientProvider.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportProviders(tenantId: string, search?: string) {
  const rows = await prisma.patientProvider.findMany({
    where: buildProviderWhere(tenantId, search),
    orderBy: { createdAt: "desc" },
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

export async function createProvider(tenantId: string, input: ProviderInput) {
  return prisma.patientProvider.create({ data: { tenantId, ...input } });
}

export async function updateProvider(tenantId: string, id: string, input: Partial<ProviderInput>) {
  const existing = await prisma.patientProvider.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Provider not found");
  return prisma.patientProvider.update({ where: { id }, data: input });
}

export async function deleteProvider(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientProvider.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Provider not found");
  await prisma.patientProvider.delete({ where: { id } });
}

// ============================================================
// APPOINTMENTS
// ============================================================

export interface AppointmentInput {
  patientId: string;
  providerId: string;
  appointmentDatetime: Date;
  durationMinutes?: number;
  reasonForVisit?: string;
  status?: AppointmentStatus;
  notes?: string;
}

const APPOINTMENT_SORT_FIELDS = ["appointmentDatetime", "status", "createdAt"] as const;
const APPOINTMENT_INCLUDE = { patient: true, provider: true } as const;

function buildAppointmentWhere(tenantId: string, search?: string): Prisma.PatientAppointmentWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { reasonForVisit: { contains: search, mode: "insensitive" } },
            { notes: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
            { provider: { firstName: { contains: search, mode: "insensitive" } } },
            { provider: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

/** Real double-booking prevention: rejects a slot that overlaps any non-cancelled appointment for the same provider. */
async function assertNoAppointmentOverlap(
  tenantId: string,
  providerId: string,
  start: Date,
  durationMinutes: number,
  excludeId?: string,
): Promise<void> {
  const end = start.getTime() + durationMinutes * 60_000;
  const candidates = await prisma.patientAppointment.findMany({
    where: {
      tenantId,
      providerId,
      status: { not: "cancelled" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { appointmentDatetime: true, durationMinutes: true },
  });

  const conflict = candidates.some((appt) => {
    const apptStart = appt.appointmentDatetime.getTime();
    const apptEnd = apptStart + appt.durationMinutes * 60_000;
    return apptStart < end && apptEnd > start.getTime();
  });

  if (conflict) {
    throw AppError.conflict("This provider already has an appointment that overlaps with the requested time slot");
  }
}

export async function listAppointments(tenantId: string, query: PaginationQuery) {
  const where = buildAppointmentWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientAppointmentOrderByWithRelationInput>(query, APPOINTMENT_SORT_FIELDS, "appointmentDatetime");
  const [data, total] = await Promise.all([
    prisma.patientAppointment.findMany({ where, orderBy, include: APPOINTMENT_INCLUDE, ...pageWindow(query) }),
    prisma.patientAppointment.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportAppointments(tenantId: string, search?: string) {
  const rows = await prisma.patientAppointment.findMany({
    where: buildAppointmentWhere(tenantId, search),
    orderBy: { appointmentDatetime: "desc" },
    include: APPOINTMENT_INCLUDE,
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

export async function createAppointment(tenantId: string, input: AppointmentInput) {
  await Promise.all([assertPatientExists(tenantId, input.patientId), assertProviderExists(tenantId, input.providerId)]);
  await assertNoAppointmentOverlap(tenantId, input.providerId, input.appointmentDatetime, input.durationMinutes ?? 30);
  return prisma.patientAppointment.create({ data: { tenantId, ...input }, include: APPOINTMENT_INCLUDE });
}

export async function updateAppointment(tenantId: string, id: string, input: Partial<AppointmentInput>) {
  const existing = await prisma.patientAppointment.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Appointment not found");

  if (input.patientId) await assertPatientExists(tenantId, input.patientId);
  if (input.providerId) await assertProviderExists(tenantId, input.providerId);

  const providerId = input.providerId ?? existing.providerId;
  const appointmentDatetime = input.appointmentDatetime ?? existing.appointmentDatetime;
  const durationMinutes = input.durationMinutes ?? existing.durationMinutes;

  if (input.providerId || input.appointmentDatetime || input.durationMinutes !== undefined) {
    await assertNoAppointmentOverlap(tenantId, providerId, appointmentDatetime, durationMinutes, id);
  }

  return prisma.patientAppointment.update({ where: { id }, data: input, include: APPOINTMENT_INCLUDE });
}

export async function deleteAppointment(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientAppointment.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Appointment not found");
  await prisma.patientAppointment.delete({ where: { id } });
}

// ============================================================
// MEDICAL RECORDS
// ============================================================

export interface MedicalRecordInput {
  patientId: string;
  visitDate: Date;
  chiefComplaint?: string;
  examinationFindings?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  providerId: string;
  followUpDate?: Date;
  notes?: string;
}

const MEDICAL_RECORD_SORT_FIELDS = ["visitDate", "followUpDate", "createdAt"] as const;
const MEDICAL_RECORD_INCLUDE = { patient: true, provider: true } as const;
const MEDICAL_RECORD_LOCK_WINDOW_MS = 24 * 60 * 60 * 1000;

function buildMedicalRecordWhere(tenantId: string, search?: string): Prisma.PatientMedicalRecordWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { chiefComplaint: { contains: search, mode: "insensitive" } },
            { diagnosis: { contains: search, mode: "insensitive" } },
            { treatmentPlan: { contains: search, mode: "insensitive" } },
            { notes: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listMedicalRecords(tenantId: string, query: PaginationQuery) {
  const where = buildMedicalRecordWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientMedicalRecordOrderByWithRelationInput>(query, MEDICAL_RECORD_SORT_FIELDS, "visitDate");
  const [data, total] = await Promise.all([
    prisma.patientMedicalRecord.findMany({ where, orderBy, include: MEDICAL_RECORD_INCLUDE, ...pageWindow(query) }),
    prisma.patientMedicalRecord.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportMedicalRecords(tenantId: string, search?: string) {
  const rows = await prisma.patientMedicalRecord.findMany({
    where: buildMedicalRecordWhere(tenantId, search),
    orderBy: { visitDate: "desc" },
    include: MEDICAL_RECORD_INCLUDE,
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

export async function createMedicalRecord(tenantId: string, input: MedicalRecordInput) {
  await Promise.all([assertPatientExists(tenantId, input.patientId), assertProviderExists(tenantId, input.providerId)]);
  return prisma.patientMedicalRecord.create({ data: { tenantId, ...input }, include: MEDICAL_RECORD_INCLUDE });
}

export async function updateMedicalRecord(tenantId: string, id: string, input: Partial<MedicalRecordInput>) {
  const existing = await prisma.patientMedicalRecord.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Medical record not found");

  if (Date.now() - existing.createdAt.getTime() > MEDICAL_RECORD_LOCK_WINDOW_MS) {
    throw AppError.forbidden("This medical record was created more than 24 hours ago and is locked for audit integrity");
  }

  if (input.patientId) await assertPatientExists(tenantId, input.patientId);
  if (input.providerId) await assertProviderExists(tenantId, input.providerId);

  return prisma.patientMedicalRecord.update({ where: { id }, data: input, include: MEDICAL_RECORD_INCLUDE });
}

export async function deleteMedicalRecord(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientMedicalRecord.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Medical record not found");
  await prisma.patientMedicalRecord.delete({ where: { id } });
}

// ============================================================
// PRESCRIPTIONS
// ============================================================

export interface PrescriptionInput {
  patientId: string;
  medicationName: string;
  dosage: string;
  frequency: PrescriptionFrequency;
  startDate: Date;
  endDate?: Date;
  refillsRemaining?: number;
  specialInstructions?: string;
  prescribingProviderId: string;
}

const PRESCRIPTION_SORT_FIELDS = ["medicationName", "startDate", "createdAt"] as const;
const PRESCRIPTION_INCLUDE = { patient: true, prescribingProvider: true } as const;

function buildPrescriptionWhere(tenantId: string, search?: string): Prisma.PatientPrescriptionWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { medicationName: { contains: search, mode: "insensitive" } },
            { dosage: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listPrescriptions(tenantId: string, query: PaginationQuery) {
  const where = buildPrescriptionWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientPrescriptionOrderByWithRelationInput>(query, PRESCRIPTION_SORT_FIELDS, "createdAt");
  const [data, total] = await Promise.all([
    prisma.patientPrescription.findMany({ where, orderBy, include: PRESCRIPTION_INCLUDE, ...pageWindow(query) }),
    prisma.patientPrescription.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportPrescriptions(tenantId: string, search?: string) {
  const rows = await prisma.patientPrescription.findMany({
    where: buildPrescriptionWhere(tenantId, search),
    orderBy: { createdAt: "desc" },
    include: PRESCRIPTION_INCLUDE,
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

/**
 * Creates a prescription after a real (if simple) allergy check: any patient allergy that
 * appears as a substring of the medication name (case-insensitive) blocks the prescription
 * outright with a 409. A soft duplicate-therapy check (another active prescription for the
 * same medication) is surfaced as non-blocking `warnings` on the response instead.
 */
export async function createPrescription(tenantId: string, input: PrescriptionInput) {
  const patient = await prisma.patientPatient.findFirst({ where: { id: input.patientId, tenantId } });
  if (!patient) throw AppError.badRequest("Referenced patient does not exist for this tenant");
  await assertProviderExists(tenantId, input.prescribingProviderId);

  const medicationLower = input.medicationName.toLowerCase();
  const conflictingAllergies = patient.allergies.filter((allergy) => medicationLower.includes(allergy.toLowerCase()));
  if (conflictingAllergies.length > 0) {
    throw AppError.conflict(
      `Cannot prescribe ${input.medicationName}: patient has a documented allergy to ${conflictingAllergies.join(", ")}`,
      { conflictingAllergies },
    );
  }

  const now = new Date();
  const existingActive = await prisma.patientPrescription.findFirst({
    where: {
      tenantId,
      patientId: input.patientId,
      medicationName: { equals: input.medicationName, mode: "insensitive" },
      OR: [{ endDate: null }, { endDate: { gt: now } }],
    },
    select: { id: true },
  });

  const warnings: string[] = [];
  if (existingActive) {
    warnings.push(`Patient already has an active prescription for ${input.medicationName} (duplicate therapy warning)`);
  }

  const prescription = await prisma.patientPrescription.create({
    data: { tenantId, ...input },
    include: PRESCRIPTION_INCLUDE,
  });

  return { ...prescription, warnings };
}

export async function updatePrescription(tenantId: string, id: string, input: Partial<PrescriptionInput>) {
  const existing = await prisma.patientPrescription.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Prescription not found");

  if (input.patientId) await assertPatientExists(tenantId, input.patientId);
  if (input.prescribingProviderId) await assertProviderExists(tenantId, input.prescribingProviderId);

  if (input.medicationName) {
    const patient = await prisma.patientPatient.findFirst({ where: { id: input.patientId ?? existing.patientId, tenantId } });
    if (patient) {
      const medicationLower = input.medicationName.toLowerCase();
      const conflictingAllergies = patient.allergies.filter((allergy) => medicationLower.includes(allergy.toLowerCase()));
      if (conflictingAllergies.length > 0) {
        throw AppError.conflict(
          `Cannot update prescription to ${input.medicationName}: patient has a documented allergy to ${conflictingAllergies.join(", ")}`,
          { conflictingAllergies },
        );
      }
    }
  }

  return prisma.patientPrescription.update({ where: { id }, data: input, include: PRESCRIPTION_INCLUDE });
}

export async function deletePrescription(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientPrescription.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Prescription not found");
  await prisma.patientPrescription.delete({ where: { id } });
}

// ============================================================
// VITAL SIGNS
// ============================================================

export interface VitalSignInput {
  patientId: string;
  visitDate: Date;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  notes?: string;
}

const VITAL_SIGN_SORT_FIELDS = ["visitDate", "createdAt"] as const;

function buildVitalSignWhere(tenantId: string, search?: string): Prisma.PatientVitalSignWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { notes: { contains: search, mode: "insensitive" } },
            { bloodPressure: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

/** bmi = weight(kg) / (height(cm)/100)^2, rounded to 1 decimal. */
function computeBmi(weight?: number, height?: number): number | undefined {
  if (weight === undefined || height === undefined || height <= 0) return undefined;
  const meters = height / 100;
  return Math.round((weight / (meters * meters)) * 10) / 10;
}

export async function listVitalSigns(tenantId: string, query: PaginationQuery) {
  const where = buildVitalSignWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientVitalSignOrderByWithRelationInput>(query, VITAL_SIGN_SORT_FIELDS, "visitDate");
  const [data, total] = await Promise.all([
    prisma.patientVitalSign.findMany({ where, orderBy, include: { patient: true }, ...pageWindow(query) }),
    prisma.patientVitalSign.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportVitalSigns(tenantId: string, search?: string) {
  const rows = await prisma.patientVitalSign.findMany({
    where: buildVitalSignWhere(tenantId, search),
    orderBy: { visitDate: "desc" },
    include: { patient: true },
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

export async function createVitalSign(tenantId: string, input: VitalSignInput) {
  await assertPatientExists(tenantId, input.patientId);
  const bmi = input.bmi ?? computeBmi(input.weight, input.height);
  return prisma.patientVitalSign.create({ data: { tenantId, ...input, bmi } });
}

export async function updateVitalSign(tenantId: string, id: string, input: Partial<VitalSignInput>) {
  const existing = await prisma.patientVitalSign.findFirst({ where: { id, tenantId } });
  if (!existing) throw AppError.notFound("Vital sign record not found");

  if (input.patientId) await assertPatientExists(tenantId, input.patientId);

  let bmi = input.bmi;
  if (bmi === undefined) {
    const weight = input.weight ?? (existing.weight ? existing.weight.toNumber() : undefined);
    const height = input.height ?? (existing.height ? existing.height.toNumber() : undefined);
    bmi = computeBmi(weight, height);
  }

  return prisma.patientVitalSign.update({
    where: { id },
    data: { ...input, ...(bmi !== undefined ? { bmi } : {}) },
  });
}

export async function deleteVitalSign(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientVitalSign.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Vital sign record not found");
  await prisma.patientVitalSign.delete({ where: { id } });
}

// ============================================================
// LAB RESULTS
// ============================================================

export interface LabResultInput {
  patientId: string;
  testName: string;
  testDate: Date;
  resultValue?: string;
  referenceRange?: string;
  unit?: string;
  status?: LabStatus;
  notes?: string;
}

const LAB_RESULT_SORT_FIELDS = ["testDate", "status", "createdAt"] as const;

function buildLabResultWhere(tenantId: string, search?: string): Prisma.PatientLabResultWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { testName: { contains: search, mode: "insensitive" } },
            { resultValue: { contains: search, mode: "insensitive" } },
            { notes: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listLabResults(tenantId: string, query: PaginationQuery) {
  const where = buildLabResultWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientLabResultOrderByWithRelationInput>(query, LAB_RESULT_SORT_FIELDS, "testDate");
  const [data, total] = await Promise.all([
    prisma.patientLabResult.findMany({ where, orderBy, include: { patient: true }, ...pageWindow(query) }),
    prisma.patientLabResult.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportLabResults(tenantId: string, search?: string) {
  const rows = await prisma.patientLabResult.findMany({
    where: buildLabResultWhere(tenantId, search),
    orderBy: { testDate: "desc" },
    include: { patient: true },
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

export async function createLabResult(tenantId: string, input: LabResultInput) {
  await assertPatientExists(tenantId, input.patientId);
  return prisma.patientLabResult.create({ data: { tenantId, ...input } });
}

export async function updateLabResult(tenantId: string, id: string, input: Partial<LabResultInput>) {
  const existing = await prisma.patientLabResult.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Lab result not found");
  if (input.patientId) await assertPatientExists(tenantId, input.patientId);
  return prisma.patientLabResult.update({ where: { id }, data: input });
}

export async function deleteLabResult(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientLabResult.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Lab result not found");
  await prisma.patientLabResult.delete({ where: { id } });
}

// ============================================================
// INSURANCE
// ============================================================

export interface InsuranceInput {
  patientId: string;
  providerName?: string;
  policyNumber?: string;
  groupNumber?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
}

const INSURANCE_SORT_FIELDS = ["providerName", "effectiveDate", "expirationDate", "createdAt"] as const;

function buildInsuranceWhere(tenantId: string, search?: string): Prisma.PatientInsuranceWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { providerName: { contains: search, mode: "insensitive" } },
            { policyNumber: { contains: search, mode: "insensitive" } },
            { groupNumber: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listInsurance(tenantId: string, query: PaginationQuery) {
  const where = buildInsuranceWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientInsuranceOrderByWithRelationInput>(query, INSURANCE_SORT_FIELDS, "createdAt");
  const [data, total] = await Promise.all([
    prisma.patientInsurance.findMany({ where, orderBy, include: { patient: true }, ...pageWindow(query) }),
    prisma.patientInsurance.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportInsurance(tenantId: string, search?: string) {
  const rows = await prisma.patientInsurance.findMany({
    where: buildInsuranceWhere(tenantId, search),
    orderBy: { createdAt: "desc" },
    include: { patient: true },
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

export async function createInsurance(tenantId: string, input: InsuranceInput) {
  await assertPatientExists(tenantId, input.patientId);
  return prisma.patientInsurance.create({ data: { tenantId, ...input } });
}

export async function updateInsurance(tenantId: string, id: string, input: Partial<InsuranceInput>) {
  const existing = await prisma.patientInsurance.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Insurance record not found");
  if (input.patientId) await assertPatientExists(tenantId, input.patientId);
  return prisma.patientInsurance.update({ where: { id }, data: input });
}

export async function deleteInsurance(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientInsurance.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Insurance record not found");
  await prisma.patientInsurance.delete({ where: { id } });
}

// ============================================================
// BILLING
// ============================================================

export interface BillingInput {
  patientId: string;
  appointmentId?: string;
  amountCharged: number;
  insuranceClaimStatus?: ClaimStatus;
  patientResponsibility?: number;
  paidDate?: Date;
  paymentMethod?: string;
}

const BILLING_SORT_FIELDS = ["amountCharged", "insuranceClaimStatus", "paidDate", "createdAt"] as const;

function buildBillingWhere(tenantId: string, search?: string): Prisma.PatientBillingWhereInput {
  return {
    tenantId,
    ...(search
      ? {
          OR: [
            { paymentMethod: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

async function assertAppointmentExists(tenantId: string, appointmentId: string): Promise<void> {
  const appointment = await prisma.patientAppointment.findFirst({ where: { id: appointmentId, tenantId }, select: { id: true } });
  if (!appointment) throw AppError.badRequest("Referenced appointment does not exist for this tenant");
}

export async function listBilling(tenantId: string, query: PaginationQuery) {
  const where = buildBillingWhere(tenantId, query.search);
  const orderBy = resolveSort<Prisma.PatientBillingOrderByWithRelationInput>(query, BILLING_SORT_FIELDS, "createdAt");
  const [data, total] = await Promise.all([
    prisma.patientBilling.findMany({ where, orderBy, include: { patient: true, appointment: true }, ...pageWindow(query) }),
    prisma.patientBilling.count({ where }),
  ]);
  return buildPaginatedResult(data, total, query);
}

export async function exportBilling(tenantId: string, search?: string) {
  const rows = await prisma.patientBilling.findMany({
    where: buildBillingWhere(tenantId, search),
    orderBy: { createdAt: "desc" },
    include: { patient: true, appointment: true },
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map((row) => serializeForCsv(row));
}

export async function createBilling(tenantId: string, input: BillingInput) {
  await assertPatientExists(tenantId, input.patientId);
  if (input.appointmentId) await assertAppointmentExists(tenantId, input.appointmentId);
  return prisma.patientBilling.create({ data: { tenantId, ...input }, include: { patient: true, appointment: true } });
}

export async function updateBilling(tenantId: string, id: string, input: Partial<BillingInput>) {
  const existing = await prisma.patientBilling.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Billing record not found");
  if (input.patientId) await assertPatientExists(tenantId, input.patientId);
  if (input.appointmentId) await assertAppointmentExists(tenantId, input.appointmentId);
  return prisma.patientBilling.update({ where: { id }, data: input, include: { patient: true, appointment: true } });
}

export async function deleteBilling(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.patientBilling.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw AppError.notFound("Billing record not found");
  await prisma.patientBilling.delete({ where: { id } });
}

// ============================================================
// DASHBOARD
// ============================================================

export async function getDashboard(tenantId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalPatients, appointmentsToday, resultsNeedingReview, refillsDue, upcomingAppointments, recentVisits] = await Promise.all([
    prisma.patientPatient.count({ where: { tenantId } }),
    prisma.patientAppointment.count({ where: { tenantId, appointmentDatetime: { gte: todayStart, lt: todayEnd } } }),
    prisma.patientLabResult.count({
      where: { tenantId, testDate: { gte: sevenDaysAgo }, status: { in: ["abnormal", "critical"] } },
    }),
    prisma.patientPrescription.count({
      where: { tenantId, refillsRemaining: { lte: 1 }, OR: [{ endDate: null }, { endDate: { gt: now } }] },
    }),
    prisma.patientAppointment.findMany({
      where: { tenantId, status: "scheduled", appointmentDatetime: { gte: now } },
      orderBy: { appointmentDatetime: "asc" },
      take: 5,
      include: APPOINTMENT_INCLUDE,
    }),
    prisma.patientMedicalRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: MEDICAL_RECORD_INCLUDE,
    }),
  ]);

  return {
    totalPatients,
    appointmentsToday,
    resultsNeedingReview,
    refillsDue,
    upcomingAppointments,
    recentVisits,
  };
}
