/**
 * Auth - Authentication and authorization helpers.
 *
 * Provides built-in auth check functions and the AuthProvider interface.
 * Mirrors Python's auth module from server/auth/
 */

import type { AuthCheck, AuthContext, AccessToken } from "../../types";
import { AuthorizationError } from "../../exceptions";

// ---------- Built-in Auth Checks ----------

/**
 * Require that the request has a valid token (any token).
 */
export function requireToken(): AuthCheck {
  return (context: AuthContext): boolean => {
    if (!context.token) {
      throw new AuthorizationError("Authentication required");
    }
    return true;
  };
}

/**
 * Alias for requireToken.
 */
export function requireAuthenticated(): AuthCheck {
  return requireToken();
}

/**
 * Require that the token has all specified scopes.
 */
export function requireScopes(...scopes: string[]): AuthCheck {
  return (context: AuthContext): boolean => {
    if (!context.token) {
      throw new AuthorizationError("Authentication required");
    }
    const tokenScopes = context.token.scopes ?? [];
    const missing = scopes.filter((s) => !tokenScopes.includes(s));
    if (missing.length > 0) {
      throw new AuthorizationError(
        `Missing required scopes: ${missing.join(", ")}`
      );
    }
    return true;
  };
}

/**
 * Require that the token has a specific claim with a specific value.
 */
export function requireClaim(
  claim: string,
  value?: unknown
): AuthCheck {
  return (context: AuthContext): boolean => {
    if (!context.token) {
      throw new AuthorizationError("Authentication required");
    }
    const claims = context.token.claims ?? {};
    if (!(claim in claims)) {
      throw new AuthorizationError(
        `Missing required claim: ${claim}`
      );
    }
    if (value !== undefined && claims[claim] !== value) {
      throw new AuthorizationError(
        `Claim '${claim}' does not match expected value`
      );
    }
    return true;
  };
}

// ---------- Auth Check Runner ----------

/**
 * Run one or more auth checks against a context.
 * All checks must pass for authorization to succeed.
 */
export async function runAuthChecks(
  checks: AuthCheck | AuthCheck[],
  context: AuthContext
): Promise<boolean> {
  const checkList = Array.isArray(checks) ? checks : [checks];
  for (const check of checkList) {
    const result = await check(context);
    if (!result) {
      throw new AuthorizationError("Authorization check failed");
    }
  }
  return true;
}

// ---------- Auth Provider Interface ----------

/**
 * Interface for authentication providers.
 * Implementations validate tokens and extract access information.
 */
export interface AuthProvider {
  /** Provider name */
  readonly name: string;
  /** Validate a token and return access info */
  validateToken(token: string): Promise<AccessToken | null>;
}

// ---------- In-Memory Auth Provider ----------

/**
 * Simple in-memory auth provider for testing.
 */
export class InMemoryAuthProvider implements AuthProvider {
  readonly name = "in-memory";
  private tokens = new Map<string, AccessToken>();

  /**
   * Register a token.
   */
  addToken(rawToken: string, accessToken: AccessToken): void {
    this.tokens.set(rawToken, accessToken);
  }

  async validateToken(token: string): Promise<AccessToken | null> {
    return this.tokens.get(token) ?? null;
  }
}
