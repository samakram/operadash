import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "@/utils/logger";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";

import authRoutes from "@/routes/auth.routes";
import tenantsRoutes from "@/routes/tenants.routes";
import modulesRoutes from "@/routes/modules.routes";
import usersRoutes from "@/routes/users.routes";
import hotelRoutes from "@/routes/hotel.routes";
import studentRoutes from "@/routes/student.routes";
import patientRoutes from "@/routes/patient.routes";
import restaurantRoutes from "@/routes/restaurant.routes";
import billingRoutes from "@/routes/billing.routes";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  // Stripe webhooks need the raw body for signature verification.
  app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/tenants", tenantsRoutes);
  app.use("/api/modules", modulesRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/hotel", hotelRoutes);
  app.use("/api/student", studentRoutes);
  app.use("/api/patient", patientRoutes);
  app.use("/api/restaurant", restaurantRoutes);
  app.use("/api/billing", billingRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
