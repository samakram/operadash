import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { PasswordResetToken, User } from "@prisma/client";
import { prismaMock } from "@/test/prismaMock";
import * as authService from "@/services/auth.service";
import * as emailService from "@/services/email.service";
import { AppError } from "@/utils/errors";

vi.mock("@/services/email.service", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "admin@operadash.com",
    password: "$2a$04$abcdefghijklmnopqrstuuVXaLU5J2ozf.5m1r0qgJb0K9xkuFqO", // bcrypt("correct-password", 4 rounds)
    tenantId: null,
    role: "tenant_admin",
    firstName: "Ada",
    lastName: "Admin",
    avatarUrl: null,
    active: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}

describe("auth.service", () => {
  beforeEach(() => {
    vi.mocked(emailService.sendPasswordResetEmail).mockClear();
  });

  describe("sanitizeUser", () => {
    it("strips the password field and keeps everything else", () => {
      const user = makeUser();
      const safe = authService.sanitizeUser(user);

      expect(safe).not.toHaveProperty("password");
      expect(safe.email).toBe(user.email);
      expect(safe.id).toBe(user.id);
    });
  });

  describe("login", () => {
    it("rejects an unknown email without leaking that the account doesn't exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(authService.login("nobody@example.com", "whatever")).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid email or password",
      });
    });

    it("rejects a wrong password with the identical error as an unknown email", async () => {
      const user = makeUser();
      const realHash = await bcrypt.hash("correct-password", 4);
      prismaMock.user.findUnique.mockResolvedValue({ ...user, password: realHash });

      await expect(authService.login(user.email, "wrong-password")).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid email or password",
      });
    });

    it("runs bcrypt.compare on both the unknown-email and wrong-password paths (timing-safety regression test)", async () => {
      const compareSpy = vi.spyOn(bcrypt, "compare");

      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      await authService.login("nobody@example.com", "whatever").catch(() => undefined);
      expect(compareSpy).toHaveBeenCalledTimes(1);

      const user = makeUser();
      prismaMock.user.findUnique.mockResolvedValueOnce(user);
      await authService.login(user.email, "wrong-password").catch(() => undefined);
      expect(compareSpy).toHaveBeenCalledTimes(2);

      compareSpy.mockRestore();
    });

    it("rejects a disabled account even with the correct password", async () => {
      const realHash = await bcrypt.hash("correct-password", 4);
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ password: realHash, active: false }));

      await expect(authService.login("admin@operadash.com", "correct-password")).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("succeeds with the correct password and returns tokens plus a sanitized user", async () => {
      const realHash = await bcrypt.hash("correct-password", 4);
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ password: realHash }));

      const result = await authService.login("admin@operadash.com", "correct-password");

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user).not.toHaveProperty("password");
      expect(result.user.email).toBe("admin@operadash.com");
    });

    it("rejects a locked account even with the correct password, without running bcrypt", async () => {
      const compareSpy = vi.spyOn(bcrypt, "compare");
      const realHash = await bcrypt.hash("correct-password", 4);
      prismaMock.user.findUnique.mockResolvedValue(
        makeUser({ password: realHash, lockedUntil: new Date(Date.now() + 60_000) }),
      );

      await expect(authService.login("admin@operadash.com", "correct-password")).rejects.toMatchObject({ statusCode: 401 });
      expect(compareSpy).not.toHaveBeenCalled();
      compareSpy.mockRestore();
    });

    it("locks the account once failed attempts reach the threshold", async () => {
      const realHash = await bcrypt.hash("correct-password", 4);
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ password: realHash, failedLoginAttempts: 4 }));

      await expect(authService.login("admin@operadash.com", "wrong-password")).rejects.toMatchObject({ statusCode: 401 });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginAttempts: 0, lockedUntil: expect.any(Date) },
      });
    });

    it("resets failedLoginAttempts on a successful login", async () => {
      const realHash = await bcrypt.hash("correct-password", 4);
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ password: realHash, failedLoginAttempts: 2 }));

      await authService.login("admin@operadash.com", "correct-password");

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });
  });

  describe("changePassword", () => {
    it("rejects when the current password is wrong", async () => {
      const realHash = await bcrypt.hash("correct-password", 4);
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ password: realHash }));

      await expect(authService.changePassword("user-1", "wrong-password", "new-password-123")).rejects.toBeInstanceOf(AppError);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("hashes and persists the new password when the current one is correct", async () => {
      const realHash = await bcrypt.hash("correct-password", 4);
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ password: realHash }));
      prismaMock.user.update.mockResolvedValue(makeUser());

      await authService.changePassword("user-1", "correct-password", "brand-new-password-123");

      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: "user-1" });
      expect(updateCall.data).toHaveProperty("password");
      expect(updateCall.data.password).not.toBe("brand-new-password-123");
    });
  });

  describe("requestPasswordReset", () => {
    const buildResetUrl = (token: string) => `https://app.example.com/reset-password?token=${token}`;

    it("does nothing (no token created, no email sent) for an unknown email", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await authService.requestPasswordReset("nobody@example.com", buildResetUrl);

      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("does nothing for a disabled account", async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ active: false }));

      await authService.requestPasswordReset("admin@operadash.com", buildResetUrl);

      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it("creates a hashed token (never the raw token) and emails a link containing the raw token", async () => {
      const user = makeUser();
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.passwordResetToken.create.mockResolvedValue({} as PasswordResetToken);

      await authService.requestPasswordReset(user.email, buildResetUrl);

      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const createCall = prismaMock.passwordResetToken.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe(user.id);
      expect(createCall.data.tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex digest

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [, resetUrl] = vi.mocked(emailService.sendPasswordResetEmail).mock.calls[0];
      const rawToken = new URL(resetUrl).searchParams.get("token")!;
      expect(rawToken).not.toBe(createCall.data.tokenHash);
      expect(crypto.createHash("sha256").update(rawToken).digest("hex")).toBe(createCall.data.tokenHash);
    });
  });

  describe("resetPassword", () => {
    function makeResetToken(overrides: Partial<PasswordResetToken> = {}): PasswordResetToken {
      return {
        id: "token-1",
        userId: "user-1",
        tokenHash: crypto.createHash("sha256").update("valid-raw-token").digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        ...overrides,
      };
    }

    it("rejects a token that doesn't exist", async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(authService.resetPassword("bogus-token", "new-password-123")).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects an expired token", async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(makeResetToken({ expiresAt: new Date(Date.now() - 1000) }));

      await expect(authService.resetPassword("valid-raw-token", "new-password-123")).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects an already-used token", async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(makeResetToken({ usedAt: new Date() }));

      await expect(authService.resetPassword("valid-raw-token", "new-password-123")).rejects.toMatchObject({ statusCode: 400 });
    });

    it("updates the password and invalidates outstanding tokens for a valid token", async () => {
      const token = makeResetToken();
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(token);
      prismaMock.user.update.mockResolvedValue(makeUser());
      prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.$transaction.mockImplementation((ops: unknown) => Promise.all(ops as Promise<unknown>[]));

      await authService.resetPassword("valid-raw-token", "brand-new-password-123");

      expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: token.userId }, data: { password: expect.any(String) } });
      expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: token.userId, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });
  });
});
