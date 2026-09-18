import { prisma } from "@/database/db";
import { sendAppointmentReminderEmail, sendTuitionReminderEmail } from "@/services/email.service";
import { logger } from "@/utils/logger";

const TUITION_REMINDER_WINDOW_DAYS = 3;
const APPOINTMENT_REMINDER_WINDOW_HOURS = 24;

/**
 * Emails a reminder for every unpaid tuition record due within the next
 * TUITION_REMINDER_WINDOW_DAYS (or already overdue) that hasn't had one sent
 * yet, then flags it so re-running the job doesn't re-send. One row failing
 * to send (bad/missing parent email, transient SMTP error) doesn't stop the
 * rest of the batch.
 */
export async function sendTuitionReminders(): Promise<{ sent: number; skipped: number }> {
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + TUITION_REMINDER_WINDOW_DAYS);

  const records = await prisma.studentTuitionRecord.findMany({
    where: { status: { in: ["pending", "partial", "overdue"] }, reminderSent: false, dueDate: { lte: windowEnd } },
    include: { student: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const record of records) {
    if (!record.student.parentEmail) {
      skipped++;
      continue;
    }
    try {
      const amountDue = (Number(record.amountDue) - Number(record.amountPaid)).toFixed(2);
      await sendTuitionReminderEmail(
        record.student.parentEmail,
        `${record.student.firstName} ${record.student.lastName}`,
        amountDue,
        record.dueDate.toISOString().slice(0, 10),
      );
      await prisma.studentTuitionRecord.update({ where: { id: record.id }, data: { reminderSent: true, reminderSentAt: new Date() } });
      sent++;
    } catch (err) {
      logger.error({ err, tuitionRecordId: record.id }, "Failed to send tuition reminder email");
      skipped++;
    }
  }
  return { sent, skipped };
}

/** Emails a reminder for every scheduled appointment starting within APPOINTMENT_REMINDER_WINDOW_HOURS that hasn't had one sent yet. */
export async function sendAppointmentReminders(): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + APPOINTMENT_REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  const appointments = await prisma.patientAppointment.findMany({
    where: { status: "scheduled", reminderSent: false, appointmentDatetime: { gte: now, lte: windowEnd } },
    include: { patient: true, provider: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const appointment of appointments) {
    if (!appointment.patient.email) {
      skipped++;
      continue;
    }
    try {
      await sendAppointmentReminderEmail(
        appointment.patient.email,
        `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        `Dr. ${appointment.provider.lastName}`,
        appointment.appointmentDatetime.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }),
      );
      await prisma.patientAppointment.update({ where: { id: appointment.id }, data: { reminderSent: true, reminderSentAt: new Date() } });
      sent++;
    } catch (err) {
      logger.error({ err, appointmentId: appointment.id }, "Failed to send appointment reminder email");
      skipped++;
    }
  }
  return { sent, skipped };
}

export async function runDueReminders(): Promise<void> {
  const [tuition, appointments] = await Promise.all([sendTuitionReminders(), sendAppointmentReminders()]);
  logger.info({ tuition, appointments }, "Reminder sweep complete");
}
