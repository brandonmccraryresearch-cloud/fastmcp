/**
 * Tests for Auth helpers.
 */
import { describe, it, expect } from "vitest";
import {
  requireToken,
  requireScopes,
  requireClaim,
  runAuthChecks,
  InMemoryAuthProvider,
} from "@/lib/fastmcp/server/auth";
import type { AuthContext, AccessToken } from "@/lib/fastmcp/types";
import { AuthorizationError } from "@/lib/fastmcp/exceptions";

function createAuthContext(
  token: AccessToken | null
): AuthContext {
  return {
    token,
    component: {
      name: "test-component",
    },
  };
}

describe("requireToken", () => {
  it("should pass when token is present", () => {
    const check = requireToken();
    const ctx = createAuthContext({
      token: "abc123",
      scopes: [],
    });

    expect(check(ctx)).toBe(true);
  });

  it("should throw when token is null", () => {
    const check = requireToken();
    const ctx = createAuthContext(null);

    expect(() => check(ctx)).toThrow(AuthorizationError);
  });
});

describe("requireScopes", () => {
  it("should pass when all scopes are present", () => {
    const check = requireScopes("read", "write");
    const ctx = createAuthContext({
      token: "abc",
      scopes: ["read", "write", "admin"],
    });

    expect(check(ctx)).toBe(true);
  });

  it("should throw when scopes are missing", () => {
    const check = requireScopes("read", "admin");
    const ctx = createAuthContext({
      token: "abc",
      scopes: ["read"],
    });

    expect(() => check(ctx)).toThrow(AuthorizationError);
  });
});

describe("requireClaim", () => {
  it("should pass when claim exists", () => {
    const check = requireClaim("role");
    const ctx = createAuthContext({
      token: "abc",
      claims: { role: "admin" },
    });

    expect(check(ctx)).toBe(true);
  });

  it("should pass when claim matches value", () => {
    const check = requireClaim("role", "admin");
    const ctx = createAuthContext({
      token: "abc",
      claims: { role: "admin" },
    });

    expect(check(ctx)).toBe(true);
  });

  it("should throw when claim does not match", () => {
    const check = requireClaim("role", "admin");
    const ctx = createAuthContext({
      token: "abc",
      claims: { role: "user" },
    });

    expect(() => check(ctx)).toThrow(AuthorizationError);
  });
});

describe("runAuthChecks", () => {
  it("should pass all checks", async () => {
    const ctx = createAuthContext({
      token: "abc",
      scopes: ["read"],
    });

    const result = await runAuthChecks(
      [requireToken(), requireScopes("read")],
      ctx
    );

    expect(result).toBe(true);
  });

  it("should fail if any check fails", async () => {
    const ctx = createAuthContext({
      token: "abc",
      scopes: [],
    });

    await expect(
      runAuthChecks(
        [requireToken(), requireScopes("admin")],
        ctx
      )
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("InMemoryAuthProvider", () => {
  it("should validate registered tokens", async () => {
    const provider = new InMemoryAuthProvider();
    provider.addToken("secret", {
      token: "secret",
      scopes: ["read"],
    });

    const result = await provider.validateToken("secret");

    expect(result).toEqual({
      token: "secret",
      scopes: ["read"],
    });
  });

  it("should return null for unknown tokens", async () => {
    const provider = new InMemoryAuthProvider();

    const result = await provider.validateToken("unknown");

    expect(result).toBeNull();
  });
});
