import { Router } from "express";
import { z } from "zod";
import * as patientService from "@/services/patient.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenantIsolation";
import { requireModule } from "@/middleware/moduleGuard";
import { requireFeature } from "@/middleware/featureGuard";
import { paginationSchema } from "@/utils/validators";
import { sendCsv } from "@/utils/csv";
import { recordAudit } from "@/utils/audit";

const router = Router();
router.use(authenticate, resolveTenant, requireModule("patient"));
// Staff can read/create/update within the module; deleting is admin-only.
router.delete("*", requireRole("tenant_admin", "super_admin"));
// Optional sub-features a tenant admin can turn off — see utils/featureCatalog.ts.
router.use("/vitals", requireFeature("patient", "vitals"));
router.use("/lab-results", requireFeature("patient", "lab-results"));
router.use("/insurance", requireFeature("patient", "insurance"));
router.use("/billing", requireFeature("patient", "billing"));

// ============================================================
// Shared zod helpers
// ============================================================

/** Treats "" (as sent by untouched optional text/date/select fields in EntityCrudPage) as absent. */
const emptyToUndefined = (value: unknown): unknown => (value === "" || value === null ? undefined : value);

const optionalString = (max?: number) =>
  z.preprocess(emptyToUndefined, max ? z.string().max(max).optional() : z.string().optional());
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional());
const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const optionalNumber = z.preprocess(emptyToUndefined, z.coerce.number().optional());
const uuid = z.string().uuid();

const appointmentStatusEnum = z.enum(["scheduled", "checked_in", "completed", "cancelled", "no_show"]);
const prescriptionFrequencyEnum = z.enum(["once_daily", "twice_daily", "three_times_daily", "as_needed"]);
const labStatusEnum = z.enum(["normal", "abnormal", "critical"]);
const claimStatusEnum = z.enum(["pending", "submitted", "approved", "denied"]);

function searchParam(req: import("express").Request): string | undefined {
  return typeof req.query.search === "string" ? req.query.search : undefined;
}

// ============================================================
// PATIENTS
// ============================================================

const patientSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: optionalEmail,
  phone: optionalString(20),
  dateOfBirth: z.coerce.date(),
  gender: optionalString(50),
  address: optionalString(),
  city: optionalString(255),
  country: optionalString(255),
  emergencyContactName: optionalString(255),
  emergencyContactPhone: optionalString(20),
  medicalHistorySummary: optionalString(),
  allergies: z.array(z.string()).default([]),
  chronicConditions: z.array(z.string()).default([]),
  bloodType: optionalString(10),
});
const patientUpdateSchema = patientSchema.partial();

router.get("/patients", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listPatients(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/patients/:id/chart", async (req, res, next) => {
  try {
    res.json(await patientService.getPatientChart(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get("/patients/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportPatients(req.tenantId!, searchParam(req));
    sendCsv(res, "patients.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/patients", async (req, res, next) => {
  try {
    const input = patientSchema.parse(req.body);
    const patient = await patientService.createPatient(req.tenantId!, input);
    await recordAudit(req, "create", "PatientPatient", patient.id, { after: input });
    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

router.patch("/patients/:id", async (req, res, next) => {
  try {
    const input = patientUpdateSchema.parse(req.body);
    const patient = await patientService.updatePatient(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientPatient", req.params.id, { changes: input });
    res.json(patient);
  } catch (err) {
    next(err);
  }
});

router.delete("/patients/:id", async (req, res, next) => {
  try {
    await patientService.deletePatient(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientPatient", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PROVIDERS
// ============================================================

const providerSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: optionalEmail,
  phone: optionalString(20),
  specialization: optionalString(255),
  licenseNumber: optionalString(100),
  bio: optionalString(),
});
const providerUpdateSchema = providerSchema.partial();

router.get("/providers", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listProviders(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/providers/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportProviders(req.tenantId!, searchParam(req));
    sendCsv(res, "providers.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/providers", async (req, res, next) => {
  try {
    const input = providerSchema.parse(req.body);
    const provider = await patientService.createProvider(req.tenantId!, input);
    await recordAudit(req, "create", "PatientProvider", provider.id, { after: input });
    res.status(201).json(provider);
  } catch (err) {
    next(err);
  }
});

router.patch("/providers/:id", async (req, res, next) => {
  try {
    const input = providerUpdateSchema.parse(req.body);
    const provider = await patientService.updateProvider(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientProvider", req.params.id, { changes: input });
    res.json(provider);
  } catch (err) {
    next(err);
  }
});

router.delete("/providers/:id", async (req, res, next) => {
  try {
    await patientService.deleteProvider(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientProvider", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// APPOINTMENTS
// ============================================================

const appointmentSchema = z.object({
  patientId: uuid,
  providerId: uuid,
  appointmentDatetime: z.coerce.date(),
  durationMinutes: optionalNumber.pipe(z.number().int().min(5).max(600).optional()),
  reasonForVisit: optionalString(255),
  status: z.preprocess(emptyToUndefined, appointmentStatusEnum.optional()),
  notes: optionalString(),
});
const appointmentUpdateSchema = appointmentSchema.partial();

router.get("/appointments", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listAppointments(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/appointments/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportAppointments(req.tenantId!, searchParam(req));
    sendCsv(res, "appointments.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/appointments", async (req, res, next) => {
  try {
    const input = appointmentSchema.parse(req.body);
    const appointment = await patientService.createAppointment(req.tenantId!, input);
    await recordAudit(req, "create", "PatientAppointment", appointment.id, { after: input });
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
});

router.patch("/appointments/:id", async (req, res, next) => {
  try {
    const input = appointmentUpdateSchema.parse(req.body);
    const appointment = await patientService.updateAppointment(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientAppointment", req.params.id, { changes: input });
    res.json(appointment);
  } catch (err) {
    next(err);
  }
});

router.delete("/appointments/:id", async (req, res, next) => {
  try {
    await patientService.deleteAppointment(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientAppointment", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// MEDICAL RECORDS
// ============================================================

const medicalRecordSchema = z.object({
  patientId: uuid,
  visitDate: z.coerce.date(),
  chiefComplaint: optionalString(),
  examinationFindings: optionalString(),
  diagnosis: optionalString(),
  treatmentPlan: optionalString(),
  providerId: uuid,
  followUpDate: optionalDate,
  notes: optionalString(),
});
const medicalRecordUpdateSchema = medicalRecordSchema.partial();

router.get("/medical-records", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listMedicalRecords(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/medical-records/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportMedicalRecords(req.tenantId!, searchParam(req));
    sendCsv(res, "medical-records.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/medical-records", async (req, res, next) => {
  try {
    const input = medicalRecordSchema.parse(req.body);
    const record = await patientService.createMedicalRecord(req.tenantId!, input);
    await recordAudit(req, "create", "PatientMedicalRecord", record.id, { after: input });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.patch("/medical-records/:id", async (req, res, next) => {
  try {
    const input = medicalRecordUpdateSchema.parse(req.body);
    const record = await patientService.updateMedicalRecord(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientMedicalRecord", req.params.id, { changes: input });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.delete("/medical-records/:id", async (req, res, next) => {
  try {
    await patientService.deleteMedicalRecord(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientMedicalRecord", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PRESCRIPTIONS
// ============================================================

const prescriptionSchema = z.object({
  patientId: uuid,
  medicationName: z.string().min(1).max(255),
  dosage: z.string().min(1).max(100),
  frequency: prescriptionFrequencyEnum,
  startDate: z.coerce.date(),
  endDate: optionalDate,
  refillsRemaining: optionalNumber.pipe(z.number().int().min(0).optional()),
  specialInstructions: optionalString(),
  prescribingProviderId: uuid,
});
const prescriptionUpdateSchema = prescriptionSchema.partial();

router.get("/prescriptions", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listPrescriptions(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/prescriptions/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportPrescriptions(req.tenantId!, searchParam(req));
    sendCsv(res, "prescriptions.csv", rows);
  } catch (err) {
    next(err);
  }
});

// Allergy conflicts surface as a clear 409 (see patient.service.ts); duplicate-therapy is a
// non-blocking `warnings` array on the 201 response, which the CRM tabs intentionally don't
// surface today (see PatientCRM.tsx notes) but is available for any client that wants it.
router.post("/prescriptions", async (req, res, next) => {
  try {
    const input = prescriptionSchema.parse(req.body);
    const prescription = await patientService.createPrescription(req.tenantId!, input);
    await recordAudit(req, "create", "PatientPrescription", prescription.id, { after: input, warnings: prescription.warnings });
    res.status(201).json(prescription);
  } catch (err) {
    next(err);
  }
});

router.patch("/prescriptions/:id", async (req, res, next) => {
  try {
    const input = prescriptionUpdateSchema.parse(req.body);
    const prescription = await patientService.updatePrescription(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientPrescription", req.params.id, { changes: input });
    res.json(prescription);
  } catch (err) {
    next(err);
  }
});

router.delete("/prescriptions/:id", async (req, res, next) => {
  try {
    await patientService.deletePrescription(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientPrescription", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// VITAL SIGNS
// ============================================================

const vitalSignSchema = z.object({
  patientId: uuid,
  visitDate: z.coerce.date(),
  bloodPressure: optionalString(20),
  heartRate: optionalNumber.pipe(z.number().int().min(0).max(400).optional()),
  temperature: optionalNumber.pipe(z.number().min(0).max(120).optional()),
  weight: optionalNumber.pipe(z.number().min(0).max(1000).optional()),
  height: optionalNumber.pipe(z.number().min(0).max(300).optional()),
  bmi: optionalNumber.pipe(z.number().min(0).max(200).optional()),
  notes: optionalString(),
});
const vitalSignUpdateSchema = vitalSignSchema.partial();

router.get("/vitals", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listVitalSigns(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/vitals/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportVitalSigns(req.tenantId!, searchParam(req));
    sendCsv(res, "vitals.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/vitals", async (req, res, next) => {
  try {
    const input = vitalSignSchema.parse(req.body);
    const vital = await patientService.createVitalSign(req.tenantId!, input);
    await recordAudit(req, "create", "PatientVitalSign", vital.id, { after: input });
    res.status(201).json(vital);
  } catch (err) {
    next(err);
  }
});

router.patch("/vitals/:id", async (req, res, next) => {
  try {
    const input = vitalSignUpdateSchema.parse(req.body);
    const vital = await patientService.updateVitalSign(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientVitalSign", req.params.id, { changes: input });
    res.json(vital);
  } catch (err) {
    next(err);
  }
});

router.delete("/vitals/:id", async (req, res, next) => {
  try {
    await patientService.deleteVitalSign(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientVitalSign", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// LAB RESULTS
// ============================================================

const labResultSchema = z.object({
  patientId: uuid,
  testName: z.string().min(1).max(255),
  testDate: z.coerce.date(),
  resultValue: optionalString(255),
  referenceRange: optionalString(255),
  unit: optionalString(100),
  status: z.preprocess(emptyToUndefined, labStatusEnum.optional()),
  notes: optionalString(),
});
const labResultUpdateSchema = labResultSchema.partial();

router.get("/lab-results", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listLabResults(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/lab-results/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportLabResults(req.tenantId!, searchParam(req));
    sendCsv(res, "lab-results.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/lab-results", async (req, res, next) => {
  try {
    const input = labResultSchema.parse(req.body);
    const result = await patientService.createLabResult(req.tenantId!, input);
    await recordAudit(req, "create", "PatientLabResult", result.id, { after: input });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch("/lab-results/:id", async (req, res, next) => {
  try {
    const input = labResultUpdateSchema.parse(req.body);
    const result = await patientService.updateLabResult(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientLabResult", req.params.id, { changes: input });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/lab-results/:id", async (req, res, next) => {
  try {
    await patientService.deleteLabResult(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientLabResult", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// INSURANCE
// ============================================================

const insuranceSchema = z.object({
  patientId: uuid,
  providerName: optionalString(255),
  policyNumber: optionalString(255),
  groupNumber: optionalString(255),
  effectiveDate: optionalDate,
  expirationDate: optionalDate,
});
const insuranceUpdateSchema = insuranceSchema.partial();

router.get("/insurance", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listInsurance(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/insurance/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportInsurance(req.tenantId!, searchParam(req));
    sendCsv(res, "insurance.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/insurance", async (req, res, next) => {
  try {
    const input = insuranceSchema.parse(req.body);
    const record = await patientService.createInsurance(req.tenantId!, input);
    await recordAudit(req, "create", "PatientInsurance", record.id, { after: input });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.patch("/insurance/:id", async (req, res, next) => {
  try {
    const input = insuranceUpdateSchema.parse(req.body);
    const record = await patientService.updateInsurance(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientInsurance", req.params.id, { changes: input });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.delete("/insurance/:id", async (req, res, next) => {
  try {
    await patientService.deleteInsurance(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientInsurance", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// BILLING
// ============================================================

const billingSchema = z.object({
  patientId: uuid,
  appointmentId: z.preprocess(emptyToUndefined, uuid.optional()),
  amountCharged: z.coerce.number().min(0),
  insuranceClaimStatus: z.preprocess(emptyToUndefined, claimStatusEnum.optional()),
  patientResponsibility: optionalNumber.pipe(z.number().min(0).optional()),
  paidDate: optionalDate,
  paymentMethod: optionalString(100),
});
const billingUpdateSchema = billingSchema.partial();

router.get("/billing", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    res.json(await patientService.listBilling(req.tenantId!, query));
  } catch (err) {
    next(err);
  }
});

router.get("/billing/export", async (req, res, next) => {
  try {
    const rows = await patientService.exportBilling(req.tenantId!, searchParam(req));
    sendCsv(res, "billing.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/billing", async (req, res, next) => {
  try {
    const input = billingSchema.parse(req.body);
    const record = await patientService.createBilling(req.tenantId!, input);
    await recordAudit(req, "create", "PatientBilling", record.id, { after: input });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.patch("/billing/:id", async (req, res, next) => {
  try {
    const input = billingUpdateSchema.parse(req.body);
    const record = await patientService.updateBilling(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "PatientBilling", req.params.id, { changes: input });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.delete("/billing/:id", async (req, res, next) => {
  try {
    await patientService.deleteBilling(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "PatientBilling", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// DASHBOARD
// ============================================================

router.get("/dashboard", async (req, res, next) => {
  try {
    res.json(await patientService.getDashboard(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

export default router;
