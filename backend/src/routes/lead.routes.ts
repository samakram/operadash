import { Router } from "express";
import { z } from "zod";
import * as leadService from "@/services/lead.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenantIsolation";
import { sendCsv } from "@/utils/csv";
import { recordAudit } from "@/utils/audit";

const router = Router();
router.use(authenticate, resolveTenant);
// Staff can read/create/update leads; deleting is admin-only (matches every module's convention).
router.delete("*", requireRole("tenant_admin", "super_admin"));

const moduleEnum = z.enum(["hotel", "student", "patient", "restaurant"]);
const stageEnum = z.enum(["new", "contacted", "qualified", "won", "lost"]);

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === "" ? undefined : v), schema.optional());
}

const leadCreateSchema = z.object({
  module: moduleEnum,
  title: z.string().min(1).max(255),
  contactName: emptyToUndefined(z.string()),
  contactEmail: emptyToUndefined(z.string().email()),
  contactPhone: emptyToUndefined(z.string()),
  estimatedValue: emptyToUndefined(z.coerce.number().nonnegative()),
  stage: emptyToUndefined(stageEnum),
  source: emptyToUndefined(z.string()),
  notes: emptyToUndefined(z.string()),
  assignedToUserId: emptyToUndefined(z.string().uuid()),
});

const leadUpdateSchema = leadCreateSchema.partial().extend({
  position: emptyToUndefined(z.coerce.number().int()),
});

router.get("/stage-labels", async (req, res, next) => {
  try {
    const module = moduleEnum.parse(req.query.module);
    res.json(await leadService.getStageLabels(req.tenantId!, module));
  } catch (err) {
    next(err);
  }
});

const stageLabelSchema = z.object({ module: moduleEnum, stage: stageEnum, label: z.string().max(100) });

router.patch("/stage-labels", requireRole("tenant_admin", "super_admin"), async (req, res, next) => {
  try {
    const { module, stage, label } = stageLabelSchema.parse(req.body);
    await leadService.setStageLabel(req.tenantId!, module, stage, label);
    res.json(await leadService.getStageLabels(req.tenantId!, module));
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const module = req.query.module ? moduleEnum.parse(req.query.module) : undefined;
    res.json(await leadService.listLeadsBoard(req.tenantId!, module));
  } catch (err) {
    next(err);
  }
});

router.get("/export", async (req, res, next) => {
  try {
    const module = req.query.module ? moduleEnum.parse(req.query.module) : undefined;
    const rows = await leadService.listLeadsForExport(req.tenantId!, module);
    sendCsv(res, "leads.csv", rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const input = leadCreateSchema.parse(req.body);
    const lead = await leadService.createLead(req.tenantId!, input);
    await recordAudit(req, "create", "lead", lead.id, input);
    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const input = leadUpdateSchema.parse(req.body);
    const lead = await leadService.updateLead(req.tenantId!, req.params.id, input);
    await recordAudit(req, "update", "lead", req.params.id, input);
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await leadService.deleteLead(req.tenantId!, req.params.id);
    await recordAudit(req, "delete", "lead", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
