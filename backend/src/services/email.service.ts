import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/utils/logger";

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null | undefined;

/**
 * Lazily builds the SMTP transport from env vars. Returns null (rather than
 * throwing) when SMTP isn't configured, so the app stays usable without an
 * email provider — callers fall back to logging the message instead of
 * sending it, which is exactly what you want in local/dev and in this build
 * (no SMTP credentials exist anywhere in this deployment yet).
 */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

async function sendEmail(message: EmailMessage): Promise<void> {
  const client = getTransporter();

  if (!client) {
    logger.warn(
      { to: message.to, subject: message.subject },
      "SMTP is not configured (SMTP_HOST unset) — logging email instead of sending it. See backend/.env.example.",
    );
    logger.info({ body: message.text }, "Email content (not sent)");
    return;
  }

  await client.sendMail({
    from: process.env.SMTP_FROM ?? "OperaDash <no-reply@operadash.com>",
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

export async function sendWelcomeEmail(to: string, firstName: string, tenantName: string, tempPassword: string): Promise<void> {
  const subject = `Welcome to ${tenantName} on OperaDash`;
  const text = `Hi ${firstName},\n\nYour OperaDash account for ${tenantName} is ready.\n\nEmail: ${to}\nTemporary password: ${tempPassword}\n\nSign in and change your password as soon as possible.`;
  const html = `<p>Hi ${firstName},</p><p>Your OperaDash account for <strong>${tenantName}</strong> is ready.</p><p>Email: ${to}<br/>Temporary password: <code>${tempPassword}</code></p><p>Sign in and change your password as soon as possible.</p>`;
  await sendEmail({ to, subject, html, text });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = "Reset your OperaDash password";
  const text = `We received a request to reset your OperaDash password. This link expires in 1 hour and can only be used once:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  const html = `<p>We received a request to reset your OperaDash password. This link expires in 1 hour and can only be used once:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`;
  await sendEmail({ to, subject, html, text });
}
