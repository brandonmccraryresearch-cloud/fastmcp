/**
 * JWT Auth Provider — Validates JWT tokens.
 *
 * A lightweight JWT verifier that validates token structure, expiration,
 * and optionally audience/issuer claims. Uses native crypto (no external
 * JWT library) for HMAC-based signatures.
 *
 * For production use with RSA/ECDSA keys, consider integrating `jose`.
 *
 * Mirrors Python's `server/auth/providers/jwt.py`
 */

import type { AuthProvider } from "./index";
import type { AccessToken } from "../../types";

export interface JWTAuthProviderOptions {
  /** HMAC secret for HS256 verification (base64url-encoded or raw) */
  secret: string;
  /** Expected issuer claim */
  issuer?: string;
  /** Expected audience claim */
  audience?: string;
  /** Clock skew tolerance in seconds (default: 30) */
  clockSkewSeconds?: number;
  /** Scope claim key (default: "scope") */
  scopeClaim?: string;
}

/**
 * Base64url decode a string.
 */
function base64urlDecode(input: string): string {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

/**
 * Base64url encode a Uint8Array.
 */
function base64urlEncode(data: Uint8Array): string {
  const binary = Array.from(data, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Parse JWT payload without verification (for claim extraction).
 */
function parseJWTPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = base64urlDecode(parts[1]);
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export class JWTAuthProvider implements AuthProvider {
  readonly name = "jwt";
  private secret: string;
  private issuer?: string;
  private audience?: string;
  private clockSkewSeconds: number;
  private scopeClaim: string;

  constructor(options: JWTAuthProviderOptions) {
    this.secret = options.secret;
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.clockSkewSeconds = options.clockSkewSeconds ?? 30;
    this.scopeClaim = options.scopeClaim ?? "scope";
  }

  async validateToken(token: string): Promise<AccessToken | null> {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature (HS256)
    const isValid = await this.verifyHS256(
      `${headerB64}.${payloadB64}`,
      signatureB64
    );
    if (!isValid) return null;

    // Parse payload
    const payload = parseJWTPayload(token);
    if (!payload) return null;

    // Check header algorithm
    try {
      const header = JSON.parse(base64urlDecode(headerB64)) as Record<string, unknown>;
      if (header.alg !== "HS256") return null;
    } catch {
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number") {
      if (now > payload.exp + this.clockSkewSeconds) {
        return null; // Expired
      }
    }

    // Check not-before
    if (typeof payload.nbf === "number") {
      if (now < payload.nbf - this.clockSkewSeconds) {
        return null; // Not yet valid
      }
    }

    // Check issuer
    if (this.issuer && payload.iss !== this.issuer) {
      return null;
    }

    // Check audience
    if (this.audience) {
      const aud = payload.aud;
      if (typeof aud === "string") {
        if (aud !== this.audience) return null;
      } else if (Array.isArray(aud)) {
        if (!aud.includes(this.audience)) return null;
      } else {
        return null;
      }
    }

    // Extract scopes
    const scopeValue = payload[this.scopeClaim];
    let scopes: string[] = [];
    if (typeof scopeValue === "string") {
      scopes = scopeValue.split(" ").filter(Boolean);
    } else if (Array.isArray(scopeValue)) {
      scopes = scopeValue.filter(
        (s): s is string => typeof s === "string"
      );
    }

    return {
      token,
      scopes,
      claims: payload,
      expiresAt: typeof payload.exp === "number"
        ? new Date(payload.exp * 1000)
        : undefined,
    };
  }

  private async verifyHS256(
    data: string,
    signatureB64: string
  ): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(this.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signed = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(data)
      );

      const expectedSig = base64urlEncode(new Uint8Array(signed));
      return expectedSig === signatureB64;
    } catch {
      return false;
    }
  }
}

/**
 * Create a signed HS256 JWT token (for testing).
 */
export async function createHS256Token(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };

  const headerB64 = base64urlEncode(
    encoder.encode(JSON.stringify(header))
  );
  const payloadB64 = base64urlEncode(
    encoder.encode(JSON.stringify(payload))
  );

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${headerB64}.${payloadB64}`)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signed));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Static Token Verifier — Validates a fixed bearer token.
 *
 * Simple provider for API key-style auth. No JWT parsing needed.
 */
export class StaticTokenProvider implements AuthProvider {
  readonly name = "static-token";
  private validToken: string;
  private scopes: string[];

  constructor(token: string, scopes: string[] = []) {
    this.validToken = token;
    this.scopes = scopes;
  }

  async validateToken(token: string): Promise<AccessToken | null> {
    if (token !== this.validToken) return null;
    return {
      token,
      scopes: this.scopes,
      claims: {},
    };
  }
}
