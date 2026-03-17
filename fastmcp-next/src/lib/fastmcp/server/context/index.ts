/**
 * Context - Per-request context for MCP operations.
 *
 * Provides access to auth, logging, state, and server capabilities
 * within tool/resource/prompt handlers.
 *
 * Mirrors Python's Context from server/context.py
 */

import type { AccessToken } from "../../types";
import { Logger } from "../../utilities";

// ---------- State Store ----------

export interface StateValue {
  key: string;
  value: unknown;
  updatedAt: Date;
}

export interface AsyncKeyValue {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
}

/**
 * In-memory implementation of AsyncKeyValue store.
 */
export class InMemoryKeyValue implements AsyncKeyValue {
  private store = new Map<string, unknown>();

  async get(key: string): Promise<unknown | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}

// ---------- Log Callback ----------

export type LogCallback = (
  level: "debug" | "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
) => void | Promise<void>;

// ---------- Context ----------

/**
 * Per-request context providing access to server capabilities.
 *
 * Injected into tool/resource/prompt handlers that accept a `context` parameter.
 */
export class Context {
  readonly requestId: string;
  readonly token: AccessToken | null;
  readonly logger: Logger;
  private stateStore: AsyncKeyValue;
  private logCallback?: LogCallback;

  constructor(options: {
    requestId: string;
    token?: AccessToken | null;
    stateStore?: AsyncKeyValue;
    logCallback?: LogCallback;
    logger?: Logger;
  }) {
    this.requestId = options.requestId;
    this.token = options.token ?? null;
    this.stateStore = options.stateStore ?? new InMemoryKeyValue();
    this.logCallback = options.logCallback;
    this.logger = options.logger ?? new Logger("Context");
  }

  // ---------- State Management ----------

  async setState(key: string, value: unknown): Promise<StateValue> {
    await this.stateStore.set(key, value);
    return {
      key,
      value,
      updatedAt: new Date(),
    };
  }

  async getState(key: string): Promise<StateValue | null> {
    const value = await this.stateStore.get(key);
    if (value === undefined) return null;
    return {
      key,
      value,
      updatedAt: new Date(),
    };
  }

  async clearState(key: string): Promise<boolean> {
    return this.stateStore.delete(key);
  }

  // ---------- Logging ----------

  async log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    this.logger[level](message, data);
    if (this.logCallback) {
      await this.logCallback(level, message, data);
    }
  }

  // ---------- Auth Helpers ----------

  get isAuthenticated(): boolean {
    return this.token !== null;
  }

  hasScope(scope: string): boolean {
    return this.token?.scopes?.includes(scope) ?? false;
  }

  hasScopes(...scopes: string[]): boolean {
    return scopes.every((scope) => this.hasScope(scope));
  }
}
