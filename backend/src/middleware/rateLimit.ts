import rateLimit from "express-rate-limit";

/**
 * Brute-force protection on credential-checking endpoints. Keyed on IP by
 * default (express-rate-limit's standard keyGenerator) — that's coarse
 * behind a shared corporate NAT, but the alternative (keying on the
 * attempted email) lets an attacker lock out a known victim's account by
 * spamming failed logins for it, which is worse. Successful logins don't
 * count against the limit, so a legitimate user who mistypes a few times
 * isn't meaningfully affected.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again in a few minutes." } },
});

/** Coarser, defense-in-depth limiter applied to the whole API. */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many requests. Slow down and try again shortly." } },
});
