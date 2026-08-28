import { Router } from "express";
import { z } from "zod";
import * as billingService from "@/services/billing.service";
import { authenticate, requireRole } from "@/middleware/auth";
import { AppError } from "@/utils/errors";

const router = Router();

const checkoutSchema = z.object({
  plan: z.enum(["free", "starter", "pro", "enterprise"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.post("/checkout-session", authenticate, requireRole("tenant_admin"), async (req, res, next) => {
  try {
    const { plan, successUrl, cancelUrl } = checkoutSchema.parse(req.body);
    if (!req.auth?.tenantId) {
      throw AppError.forbidden("Account is not associated with a tenant");
    }
    const result = await billingService.createCheckoutSession(req.auth.tenantId, plan, successUrl, cancelUrl);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Mounted with express.raw() in app.ts so Stripe's signature check sees the exact bytes.
router.post("/webhook", async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      throw AppError.badRequest("Missing Stripe signature header");
    }
    await billingService.handleWebhookEvent(req.body as Buffer, signature);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
