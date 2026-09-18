import Stripe from "stripe";
import type { PlanTier } from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";

export const PLAN_PRICES_USD: Record<PlanTier, number> = {
  free: 0,
  starter: 29,
  pro: 99,
  enterprise: 299,
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw AppError.internal("Stripe is not configured on this server");
  }
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export async function createCheckoutSession(tenantId: string, plan: PlanTier, successUrl: string, cancelUrl: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw AppError.notFound("Tenant not found");
  }

  const stripe = getStripe();

  let customerId = tenant.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ name: tenant.name, metadata: { tenantId } });
    customerId = customer.id;
    await prisma.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: PLAN_PRICES_USD[plan] * 100,
          recurring: { interval: "month" },
          product_data: { name: `OperaDash ${plan} plan` },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId, plan },
  });

  return { url: session.url };
}

export async function handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw AppError.internal("Stripe webhook secret is not configured");
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const tenantId = session.metadata?.tenantId;
    const plan = session.metadata?.plan as PlanTier | undefined;
    if (tenantId && plan) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { plan, monthlyRevenue: PLAN_PRICES_USD[plan] },
      });
      await recordBillingEvent(tenantId, "plan_change", `Upgraded to the ${plan} plan via Stripe checkout`, PLAN_PRICES_USD[plan], plan);
    }
  }
}

/** A row in the tenant's billing timeline — see prisma schema BillingEvent for why this is a flat log rather than a Stripe-mirrored invoice model. */
export async function recordBillingEvent(
  tenantId: string,
  type: string,
  description: string,
  amount?: number,
  plan?: PlanTier,
): Promise<void> {
  await prisma.billingEvent.create({ data: { tenantId, type, description, amount, plan } });
}

export async function listBillingEvents(tenantId: string) {
  return prisma.billingEvent.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
}
