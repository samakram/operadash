import { PrismaClient } from "@prisma/client";
import { logger } from "@/utils/logger";

declare global {
  // eslint-disable-next-line no-var
  var __operadashPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__operadashPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__operadashPrisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info("Database connected");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
