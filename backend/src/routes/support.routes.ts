import { Router } from "express";
import { z } from "zod";
import * as supportService from "@/services/support.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { AppError } from "@/utils/errors";

const router = Router();
router.use(authenticate);

/** super_admin sees across all tenants unless they scope to one; everyone else is pinned to their own. */
function scopeTenantId(req: import("express").Request): string | null {
  if (req.auth!.role === "super_admin") {
    const q = req.query.tenantId;
    return typeof q === "string" && q.length > 0 ? q : null;
  }
  if (!req.auth!.tenantId) {
    throw AppError.forbidden("Account is not associated with a tenant");
  }
  return req.auth!.tenantId;
}

const statusEnum = z.enum(["open", "resolved"]);

const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  message: z.string().min(1),
});

router.post("/tickets", requireRole("tenant_admin", "staff"), async (req, res, next) => {
  try {
    const { subject, message } = createTicketSchema.parse(req.body);
    const ticket = await supportService.createTicket(req.auth!.tenantId!, req.auth!.userId, req.auth!.role, subject, message);
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

router.get("/tickets", async (req, res, next) => {
  try {
    const status = req.query.status ? statusEnum.parse(req.query.status) : undefined;
    res.json(await supportService.listTickets(scopeTenantId(req), status));
  } catch (err) {
    next(err);
  }
});

router.get("/tickets/:id", async (req, res, next) => {
  try {
    res.json(await supportService.getTicket(req.params.id, scopeTenantId(req)));
  } catch (err) {
    next(err);
  }
});

const addMessageSchema = z.object({ body: z.string().min(1) });

router.post("/tickets/:id/messages", async (req, res, next) => {
  try {
    const { body } = addMessageSchema.parse(req.body);
    const message = await supportService.addMessage(req.params.id, scopeTenantId(req), req.auth!.userId, req.auth!.role, body);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

const updateStatusSchema = z.object({ status: statusEnum });

router.patch("/tickets/:id", async (req, res, next) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    res.json(await supportService.setTicketStatus(req.params.id, scopeTenantId(req), status));
  } catch (err) {
    next(err);
  }
});

export default router;
