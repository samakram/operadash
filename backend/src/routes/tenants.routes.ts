import { Router } from "express";
import { z } from "zod";
import * as tenantService from "@/services/tenant.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { paginationSchema } from "@/utils/validators";
import { AppError } from "@/utils/errors";

const router = Router();
router.use(authenticate);

const moduleEnum = z.enum(["hotel", "student", "patient", "restaurant"]);
const planEnum = z.enum(["free", "starter", "pro", "enterprise"]);

const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  subdomain: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/, "Subdomain may only contain lowercase letters, numbers, and hyphens"),
  domain: z.string().optional(),
  plan: planEnum.default("starter"),
  enabledModules: z.array(moduleEnum).default([]),
  adminEmail: z.string().email(),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
});

router.post("/", requireRole("super_admin"), async (req, res, next) => {
  try {
    const input = createTenantSchema.parse(req.body);
    const result = await tenantService.createTenant(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/", requireRole("super_admin"), async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const result = await tenantService.listTenants(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/platform", requireRole("super_admin"), async (_req, res, next) => {
  try {
    res.json(await tenantService.getPlatformAnalytics());
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireRole("tenant_admin", "staff"), async (req, res, next) => {
  try {
    if (!req.auth?.tenantId) {
      throw AppError.forbidden("Account is not associated with a tenant");
    }
    res.json(await tenantService.getTenantById(req.auth.tenantId));
  } catch (err) {
    next(err);
  }
});

function assertCanAccessTenant(req: import("express").Request, tenantId: string): void {
  if (req.auth?.role === "super_admin") return;
  if (req.auth?.tenantId === tenantId) return;
  throw AppError.forbidden("You cannot access another tenant's data");
}

router.get("/:id", async (req, res, next) => {
  try {
    assertCanAccessTenant(req, req.params.id);
    res.json(await tenantService.getTenantById(req.params.id));
  } catch (err) {
    next(err);
  }
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().nullable().optional(),
  plan: planEnum.optional(),
  logoUrl: z.string().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

router.patch("/:id", requireRole("super_admin"), async (req, res, next) => {
  try {
    const input = updateTenantSchema.parse(req.body);
    res.json(await tenantService.updateTenant(req.params.id, input));
  } catch (err) {
    next(err);
  }
});

const modulesSchema = z.object({ modules: z.array(moduleEnum) });

router.patch("/:id/modules", requireRole("super_admin"), async (req, res, next) => {
  try {
    const { modules } = modulesSchema.parse(req.body);
    res.json(await tenantService.setTenantModules(req.params.id, modules));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("super_admin"), async (req, res, next) => {
  try {
    await tenantService.deleteTenant(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
