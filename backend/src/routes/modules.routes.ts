import { Router } from "express";
import { z } from "zod";
import * as moduleService from "@/services/module.service";
import { authenticate, requireRole } from "@/middleware/auth";

const router = Router();
router.use(authenticate, requireRole("super_admin"));

const moduleEnum = z.enum(["hotel", "student", "patient", "restaurant"]);

router.get("/", async (_req, res, next) => {
  try {
    res.json(await moduleService.listModulesWithUsage());
  } catch (err) {
    next(err);
  }
});

router.get("/:name", async (req, res, next) => {
  try {
    const name = moduleEnum.parse(req.params.name);
    res.json(await moduleService.getModuleByName(name));
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({ version: z.string().optional(), description: z.string().optional() });

router.patch("/:name", async (req, res, next) => {
  try {
    const name = moduleEnum.parse(req.params.name);
    const input = updateSchema.parse(req.body);
    res.json(await moduleService.updateModule(name, input));
  } catch (err) {
    next(err);
  }
});

export default router;
