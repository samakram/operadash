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
