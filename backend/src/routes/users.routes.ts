import { Router } from "express";
import { z } from "zod";
import * as userService from "@/services/user.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { paginationSchema } from "@/utils/validators";
import { AppError } from "@/utils/errors";

const router = Router();
router.use(authenticate);

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["tenant_admin", "staff", "super_admin"]).default("staff"),
  tenantId: z.string().uuid().optional(),
});

router.post("/", requireRole("super_admin", "tenant_admin"), async (req, res, next) => {
  try {
    const input = createUserSchema.parse(req.body);

    let tenantId: string | null;
    let role = input.role;
    if (req.auth!.role === "tenant_admin") {
      // Tenant admins may only create staff scoped to their own tenant.
      tenantId = req.auth!.tenantId!;
      role = "staff";
    } else {
      if (role !== "super_admin" && !input.tenantId) {
        throw AppError.badRequest("tenantId is required when creating a tenant_admin or staff user");
      }
      tenantId = role === "super_admin" ? null : input.tenantId!;
    }

    const result = await userService.createUser({ ...input, role, tenantId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/", requireRole("super_admin", "tenant_admin"), async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const tenantId = req.auth!.role === "tenant_admin" ? req.auth!.tenantId! : (req.query.tenantId as string);
    if (!tenantId) {
      throw AppError.badRequest("tenantId query param is required");
    }
    res.json(await userService.listUsersForTenant(tenantId, query));
  } catch (err) {
    next(err);
  }
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  avatarUrl: z.string().optional(),
  active: z.boolean().optional(),
});

router.patch("/:id", requireRole("super_admin", "tenant_admin"), async (req, res, next) => {
  try {
    const input = updateUserSchema.parse(req.body);
    const scopeTenantId = req.auth!.role === "tenant_admin" ? req.auth!.tenantId! : null;
    res.json(await userService.updateUser(req.params.id, scopeTenantId, input));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("super_admin", "tenant_admin"), async (req, res, next) => {
  try {
    const scopeTenantId = req.auth!.role === "tenant_admin" ? req.auth!.tenantId! : null;
    await userService.deleteUser(req.params.id, scopeTenantId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
