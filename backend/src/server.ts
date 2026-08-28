import "dotenv/config";
import http from "node:http";
import { createApp } from "@/app";
import { initSocket } from "@/socket";
import { connectDatabase, disconnectDatabase } from "@/database/db";
import { logger } from "@/utils/logger";

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  const port = Number(process.env.PORT ?? 4000);
  httpServer.listen(port, () => {
    logger.info(`OperaDash API listening on port ${port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    httpServer.close(() => {
      logger.info("HTTP server closed");
    });
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
