import * as Sentry from "@sentry/node";

let enabled = false;

/**
 * Optional, like the SMTP/Stripe setup elsewhere — no SENTRY_DSN means this
 * is a no-op and unhandled errors are still only visible in Render's logs
 * (today's actual state), rather than the app refusing to start.
 */
export function initMonitoring(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "development", tracesSampleRate: 0.1 });
  enabled = true;
}

export function captureException(err: unknown): void {
  if (enabled) Sentry.captureException(err);
}
