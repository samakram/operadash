import cron from "node-cron";
import { runDueReminders } from "@/services/reminder.service";
import { logger } from "@/utils/logger";

/** Hourly sweep for tuition/appointment reminders — see services/reminder.service.ts for the actual windows. */
export function startScheduledJobs(): void {
  cron.schedule("0 * * * *", () => {
    void runDueReminders().catch((err) => logger.error({ err }, "Scheduled reminder sweep failed"));
  });
}
