import type { LeadStage, ModuleName, Prisma } from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";

export interface LeadInput {
  module: ModuleName;
  title: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  estimatedValue?: number;
  stage?: LeadStage;
  source?: string;
  notes?: string;
  assignedToUserId?: string;
}

export interface LeadUpdateInput extends Partial<LeadInput> {
  position?: number;
}

/** All leads for a tenant, optionally scoped to one module — grouped by stage for the board. */
export async function listLeadsBoard(tenantId: string, module?: ModuleName) {
  const where: Prisma.LeadWhereInput = module ? { tenantId, module } : { tenantId };
  const leads = await prisma.lead.findMany({ where, orderBy: [{ stage: "asc" }, { position: "asc" }, { createdAt: "asc" }] });

  const stages: LeadStage[] = ["new", "contacted", "qualified", "won", "lost"];
  const board: Record<LeadStage, typeof leads> = { new: [], contacted: [], qualified: [], won: [], lost: [] };
  for (const lead of leads) board[lead.stage].push(lead);

  return { stages, board, total: leads.length };
}

export async function listLeadsForExport(tenantId: string, module?: ModuleName): Promise<Record<string, unknown>[]> {
  const where: Prisma.LeadWhereInput = module ? { tenantId, module } : { tenantId };
  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });
  return leads.map((lead) => ({ ...lead, estimatedValue: lead.estimatedValue?.toString() ?? "" }));
}

export async function createLead(tenantId: string, input: LeadInput) {
  const maxPosition = await prisma.lead.aggregate({
    where: { tenantId, stage: input.stage ?? "new" },
    _max: { position: true },
  });

  return prisma.lead.create({
    data: {
      tenantId,
      ...input,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });
}

async function assertLeadInTenant(tenantId: string, id: string) {
  const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!lead) throw AppError.notFound("Lead not found");
  return lead;
}

export async function updateLead(tenantId: string, id: string, input: LeadUpdateInput) {
  await assertLeadInTenant(tenantId, id);
  return prisma.lead.update({ where: { id }, data: input });
}

export async function deleteLead(tenantId: string, id: string): Promise<void> {
  await assertLeadInTenant(tenantId, id);
  await prisma.lead.delete({ where: { id } });
}

// ============================================================
// LEAD CONVERSION — turns a "Won" lead into the real guest/student/patient/
// customer record it represents, so the two stop living side by side
// unlinked. Only allowed once per lead (guarded by convertedRecordId).
// ============================================================

function splitName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return { firstName: "Unknown", lastName: "Lead" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "—" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export interface ConvertLeadOptions {
  /** Required when converting a patient-module lead — Lead has no date-of-birth field to draw from. */
  dateOfBirth?: string;
}

export async function convertLead(tenantId: string, id: string, options: ConvertLeadOptions = {}) {
  const lead = await assertLeadInTenant(tenantId, id);
  if (lead.convertedRecordId) {
    throw AppError.conflict("This lead has already been converted");
  }
  if (lead.stage !== "won") {
    throw AppError.badRequest("Only a lead in the Won stage can be converted");
  }

  const { firstName, lastName } = splitName(lead.contactName);
  let recordId: string;

  switch (lead.module) {
    case "hotel": {
      const guest = await prisma.hotelGuest.create({
        data: { tenantId, firstName, lastName, email: lead.contactEmail, phone: lead.contactPhone, notes: lead.notes },
      });
      recordId = guest.id;
      break;
    }
    case "student": {
      const student = await prisma.studentStudent.create({
        data: { tenantId, firstName, lastName, email: lead.contactEmail, phone: lead.contactPhone, enrollmentDate: new Date(), status: "active" },
      });
      recordId = student.id;
      break;
    }
    case "patient": {
      if (!options.dateOfBirth) {
        throw AppError.badRequest("dateOfBirth is required to convert a patient lead");
      }
      const patient = await prisma.patientPatient.create({
        data: { tenantId, firstName, lastName, email: lead.contactEmail, phone: lead.contactPhone, dateOfBirth: new Date(options.dateOfBirth) },
      });
      recordId = patient.id;
      break;
    }
    case "restaurant": {
      const customer = await prisma.restaurantCustomer.create({
        data: { tenantId, name: lead.contactName?.trim() || lead.title, email: lead.contactEmail, phone: lead.contactPhone },
      });
      recordId = customer.id;
      break;
    }
  }

  return prisma.lead.update({ where: { id }, data: { convertedRecordId: recordId } });
}

// ============================================================
// PIPELINE STAGE LABELS — lets a tenant rename "New/Contacted/Qualified/..."
// per module without touching the underlying LeadStage enum.
// ============================================================

const DEFAULT_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};
const ALL_STAGES: LeadStage[] = ["new", "contacted", "qualified", "won", "lost"];

export async function getStageLabels(tenantId: string, module: ModuleName): Promise<{ stage: LeadStage; label: string }[]> {
  const overrides = await prisma.pipelineStageLabel.findMany({ where: { tenantId, module } });
  const overrideMap = new Map(overrides.map((o) => [o.stage, o.label]));
  return ALL_STAGES.map((stage) => ({ stage, label: overrideMap.get(stage) ?? DEFAULT_STAGE_LABELS[stage] }));
}

export async function setStageLabel(tenantId: string, module: ModuleName, stage: LeadStage, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed || trimmed === DEFAULT_STAGE_LABELS[stage]) {
    // Blank or back to the default — drop the override instead of storing a no-op row.
    await prisma.pipelineStageLabel.deleteMany({ where: { tenantId, module, stage } });
    return;
  }
  await prisma.pipelineStageLabel.upsert({
    where: { tenantId_module_stage: { tenantId, module, stage } },
    create: { tenantId, module, stage, label: trimmed },
    update: { label: trimmed },
  });
}
