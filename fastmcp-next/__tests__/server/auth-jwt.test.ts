import { describe, it, expect } from "vitest";
import {
  JWTAuthProvider,
  createHS256Token,
  StaticTokenProvider,
} from "@/lib/fastmcp/server/auth/jwt";

describe("JWTAuthProvider", () => {
  const secret = "test-secret-key-for-hmac-256";

  it("should validate a valid HS256 token", async () => {
    const provider = new JWTAuthProvider({ secret });
    const now = Math.floor(Date.now() / 1000);

    const token = await createHS256Token(
      {
        sub: "user-123",
        exp: now + 3600,
        scope: "read write",
      },
      secret
    );

    const result = await provider.validateToken(token);
    expect(result).not.toBeNull();
    expect(result?.claims?.sub).toBe("user-123");
    expect(result?.scopes).toEqual(["read", "write"]);
  });

  it("should reject expired tokens", async () => {
    const provider = new JWTAuthProvider({
      secret,
      clockSkewSeconds: 0,
    });

    const token = await createHS256Token(
      {
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) - 100,
      },
      secret
    );

    const result = await provider.validateToken(token);
    expect(result).toBeNull();
  });

  it("should reject tokens with wrong secret", async () => {
    const provider = new JWTAuthProvider({ secret });
    const token = await createHS256Token(
      { sub: "user-123" },
      "wrong-secret"
    );

    const result = await provider.validateToken(token);
    expect(result).toBeNull();
  });

  it("should validate issuer claim", async () => {
    const provider = new JWTAuthProvider({
      secret,
      issuer: "my-app",
    });

    const goodToken = await createHS256Token(
      { sub: "user-123", iss: "my-app" },
      secret
    );
    const badToken = await createHS256Token(
      { sub: "user-123", iss: "other-app" },
      secret
    );

    expect(await provider.validateToken(goodToken)).not.toBeNull();
    expect(await provider.validateToken(badToken)).toBeNull();
  });

  it("should validate audience claim", async () => {
    const provider = new JWTAuthProvider({
      secret,
      audience: "my-api",
    });

    const goodToken = await createHS256Token(
      { sub: "user-123", aud: "my-api" },
      secret
    );
    const badToken = await createHS256Token(
      { sub: "user-123", aud: "other-api" },
      secret
    );

    expect(await provider.validateToken(goodToken)).not.toBeNull();
    expect(await provider.validateToken(badToken)).toBeNull();
  });

  it("should handle array audience claim", async () => {
    const provider = new JWTAuthProvider({
      secret,
      audience: "my-api",
    });

    const token = await createHS256Token(
      { sub: "user-123", aud: ["my-api", "other-api"] },
      secret
    );

    expect(await provider.validateToken(token)).not.toBeNull();
  });

  it("should extract scopes from custom claim", async () => {
    const provider = new JWTAuthProvider({
      secret,
      scopeClaim: "permissions",
    });

    const token = await createHS256Token(
      { sub: "user-123", permissions: "admin super" },
      secret
    );

    const result = await provider.validateToken(token);
    expect(result?.scopes).toEqual(["admin", "super"]);
  });

  it("should handle array scope values", async () => {
    const provider = new JWTAuthProvider({ secret });

    const token = await createHS256Token(
      { sub: "user-123", scope: ["read", "write"] },
      secret
    );

    const result = await provider.validateToken(token);
    expect(result?.scopes).toEqual(["read", "write"]);
  });

  it("should reject malformed tokens", async () => {
    const provider = new JWTAuthProvider({ secret });

    expect(await provider.validateToken("not-a-jwt")).toBeNull();
    expect(await provider.validateToken("a.b")).toBeNull();
    expect(await provider.validateToken("")).toBeNull();
  });

  it("should set expiresAt from exp claim", async () => {
    const provider = new JWTAuthProvider({ secret });
    const exp = Math.floor(Date.now() / 1000) + 3600;

    const token = await createHS256Token(
      { sub: "user-123", exp },
      secret
    );

    const result = await provider.validateToken(token);
    expect(result?.expiresAt).toBeInstanceOf(Date);
    expect(result?.expiresAt?.getTime()).toBe(exp * 1000);
  });
});

describe("StaticTokenProvider", () => {
  it("should validate correct token", async () => {
    const provider = new StaticTokenProvider("my-api-key", [
      "read",
      "write",
    ]);

    const result = await provider.validateToken("my-api-key");
    expect(result).not.toBeNull();
    expect(result?.scopes).toEqual(["read", "write"]);
  });

  it("should reject incorrect token", async () => {
    const provider = new StaticTokenProvider("my-api-key");

    const result = await provider.validateToken("wrong-key");
    expect(result).toBeNull();
  });
});
