import { Router } from "express";
import * as auditService from "@/services/audit.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { resolveTenant } from "@/middleware/tenantIsolation";
import { paginationSchema } from "@/utils/validators";

const router = Router();
router.use(authenticate, resolveTenant, requireRole("tenant_admin", "super_admin"));

router.get("/", async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    res.json(await auditService.listAuditLogs(req.tenantId!, { ...query, action, entityType }));
  } catch (err) {
    next(err);
  }
});

router.get("/facets", async (req, res, next) => {
  try {
    res.json(await auditService.listAuditLogFacets(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

export default router;
