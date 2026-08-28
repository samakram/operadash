import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prismaMock } from "@/test/prismaMock";
import * as authService from "@/services/auth.service";
import { AppError } from "@/utils/errors";

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
    ...overrides,
  };
}

describe("auth.service", () => {
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
});
