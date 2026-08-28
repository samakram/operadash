import { describe, expect, it } from "vitest";
import { permissionsForRole, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "@/utils/jwt";

describe("jwt", () => {
  it("round-trips an access token with the payload intact", () => {
    const token = signAccessToken({ userId: "user-1", tenantId: "tenant-1", role: "tenant_admin" });
    const payload = verifyAccessToken(token);

    expect(payload.userId).toBe("user-1");
    expect(payload.tenantId).toBe("tenant-1");
    expect(payload.role).toBe("tenant_admin");
    expect(payload.permissions).toEqual(permissionsForRole("tenant_admin"));
  });

  it("supports a null tenantId for super_admin", () => {
    const token = signAccessToken({ userId: "user-2", tenantId: null, role: "super_admin" });
    const payload = verifyAccessToken(token);

    expect(payload.tenantId).toBeNull();
    expect(payload.permissions).toEqual(["platform:*"]);
  });

  it("round-trips a refresh token", () => {
    const token = signRefreshToken({ userId: "user-3", tokenVersion: 0 });
    const payload = verifyRefreshToken(token);

    expect(payload.userId).toBe("user-3");
    expect(payload.tokenVersion).toBe(0);
  });

  it("rejects a garbage token", () => {
    expect(() => verifyAccessToken("not-a-real-token")).toThrow();
  });

  it("rejects an access token when verified as a refresh token and vice versa", () => {
    // Access/refresh use different secrets (enforced at module load — see
    // the ACCESS_SECRET !== REFRESH_SECRET check in jwt.ts), so a token
    // signed for one purpose must fail signature verification for the other.
    const accessToken = signAccessToken({ userId: "user-4", tenantId: null, role: "staff" });
    const refreshToken = signRefreshToken({ userId: "user-4", tokenVersion: 0 });

    expect(() => verifyRefreshToken(accessToken)).toThrow();
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });

  it("assigns distinct, non-overlapping default permission sets per role", () => {
    expect(permissionsForRole("super_admin")).toEqual(["platform:*"]);
    expect(permissionsForRole("tenant_admin")).toEqual(["tenant:*"]);
    expect(permissionsForRole("staff")).toEqual(["tenant:read", "tenant:write:assigned"]);
  });
});
