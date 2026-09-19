import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "@/utils/logger";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { apiRateLimit } from "@/middleware/rateLimit";

import authRoutes from "@/routes/auth.routes";
import tenantsRoutes from "@/routes/tenants.routes";
import modulesRoutes from "@/routes/modules.routes";
import usersRoutes from "@/routes/users.routes";
import hotelRoutes from "@/routes/hotel.routes";
import studentRoutes from "@/routes/student.routes";
import patientRoutes from "@/routes/patient.routes";
import restaurantRoutes from "@/routes/restaurant.routes";
import billingRoutes from "@/routes/billing.routes";
import leadRoutes from "@/routes/lead.routes";
import supportRoutes from "@/routes/support.routes";
import auditRoutes from "@/routes/audit.routes";

export function createApp(): Express {
  const app = express();

  // Railway (and most PaaS hosts) sit behind a reverse proxy: without this,
  // req.ip resolves to the proxy's address for every request, which breaks
  // both per-client rate limiting and the client IP recorded in audit logs.
  // "1" trusts exactly one hop (the platform's own edge proxy), not an
  // attacker-supplied X-Forwarded-For chain.
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  // CORS_ORIGIN may be a single origin or a comma-separated list (e.g. the
  // deployed frontend plus a developer's local Vite server) — cors() needs
  // an array (or a matching function) to reflect one of several origins
  // back correctly instead of always echoing just the first one.
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  // Stripe webhooks need the raw body for signature verification.
  app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api", apiRateLimit);

  app.use("/api/auth", authRoutes);
  app.use("/api/tenants", tenantsRoutes);
  app.use("/api/modules", modulesRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/hotel", hotelRoutes);
  app.use("/api/student", studentRoutes);
  app.use("/api/patient", patientRoutes);
  app.use("/api/restaurant", restaurantRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/leads", leadRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/audit-logs", auditRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
