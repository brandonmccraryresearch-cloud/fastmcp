/**
 * Shared utility functions for FastMCP.
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Generate a unique identifier string.
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Create a short hash suffix for global keys.
 */
export function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

/**
 * Deep clone an object using structured clone.
 */
export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

/**
 * Simple logger matching FastMCP patterns.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private name: string;
  private level: LogLevel;

  constructor(name: string, level: LogLevel = "info") {
    this.name = name;
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.debug(`[${this.name}] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.info(`[${this.name}] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(`[${this.name}] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(`[${this.name}] ${message}`, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

/**
 * Convert a function's parameter info to a JSON Schema.
 * In TypeScript, we use Zod schemas for this purpose,
 * but this provides a basic fallback.
 */
export function createObjectSchema(
  properties: Record<
    string,
    {
      type: string;
      description?: string;
      required?: boolean;
      default?: unknown;
    }
  >
): {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
} {
  const schemaProperties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [name, prop] of Object.entries(properties)) {
    schemaProperties[name] = {
      type: prop.type,
      ...(prop.description && { description: prop.description }),
      ...(prop.default !== undefined && { default: prop.default }),
    };
    if (prop.required !== false) {
      required.push(name);
    }
  }

  return {
    type: "object" as const,
    properties: schemaProperties,
    required,
  };
}
