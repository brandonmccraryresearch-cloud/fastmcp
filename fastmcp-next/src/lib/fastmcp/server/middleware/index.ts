/**
 * Middleware - Request/response processing pipeline.
 *
 * Provides the base Middleware class and built-in middleware
 * implementations mirroring Python's middleware system.
 */

import type {
  MiddlewareContext,
  CallNext,
  AuthCheck,
  AuthContext,
} from "../../types";
import type { Context } from "../context";
import { Logger } from "../../utilities";
import {
  AuthorizationError,
  FastMCPError,
  MiddlewareError,
} from "../../exceptions";

// ---------- Base Middleware ----------

/**
 * Abstract base class for middleware.
 *
 * Middleware processes requests/responses in a pipeline pattern.
 * Each middleware can inspect, modify, or short-circuit the pipeline.
 */
export abstract class Middleware {
  readonly name: string;

  constructor(name?: string) {
    this.name = name ?? this.constructor.name;
  }

  abstract handle<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Promise<R>;
}

// ---------- Function Middleware ----------

/**
 * Create a middleware from a function.
 */
export class FunctionMiddleware extends Middleware {
  private handler: <T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ) => Promise<R>;

  constructor(
    name: string,
    handler: <T, R>(
      context: MiddlewareContext<T>,
      callNext: CallNext<T, R>
    ) => Promise<R>
  ) {
    super(name);
    this.handler = handler;
  }

  async handle<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Promise<R> {
    return this.handler(context, callNext);
  }
}

// ---------- Logging Middleware ----------

/**
 * Logs all requests and responses.
 */
export class LoggingMiddleware extends Middleware {
  private logger: Logger;

  constructor(level: "debug" | "info" | "warn" | "error" = "info") {
    super("LoggingMiddleware");
    this.logger = new Logger("MCP", level);
  }

  async handle<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Promise<R> {
    const start = Date.now();
    this.logger.info(
      `[${context.source}] ${context.type}: ${context.method ?? "unknown"}`
    );

    try {
      const result = await callNext(context);
      const duration = Date.now() - start;
      this.logger.info(
        `[${context.source}] ${context.method ?? "unknown"} completed in ${duration}ms`
      );
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(
        `[${context.source}] ${context.method ?? "unknown"} failed after ${duration}ms`,
        error
      );
      throw error;
    }
  }
}

// ---------- Error Handling Middleware ----------

/**
 * Catches and optionally masks error details.
 */
export class ErrorHandlingMiddleware extends Middleware {
  private maskDetails: boolean;

  constructor(maskDetails: boolean = false) {
    super("ErrorHandlingMiddleware");
    this.maskDetails = maskDetails;
  }

  async handle<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Promise<R> {
    try {
      return await callNext(context);
    } catch (error) {
      if (error instanceof FastMCPError) {
        if (this.maskDetails) {
          throw new FastMCPError("An internal error occurred");
        }
        throw error;
      }

      const message = this.maskDetails
        ? "An internal error occurred"
        : error instanceof Error
          ? error.message
          : String(error);

      throw new MiddlewareError(message);
    }
  }
}

// ---------- Rate Limiting Middleware ----------

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Token bucket rate limiting middleware.
 */
export class RateLimitingMiddleware extends Middleware {
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private buckets = new Map<string, RateLimitBucket>();

  constructor(options: {
    maxTokens?: number;
    refillRate?: number;
  } = {}) {
    super("RateLimitingMiddleware");
    this.maxTokens = options.maxTokens ?? 100;
    this.refillRate = options.refillRate ?? 10;
  }

  async handle<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Promise<R> {
    const key = context.source;
    const bucket = this.getOrCreateBucket(key);

    this.refillBucket(bucket);

    if (bucket.tokens < 1) {
      throw new MiddlewareError("Rate limit exceeded");
    }

    bucket.tokens -= 1;
    return callNext(context);
  }

  private getOrCreateBucket(key: string): RateLimitBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: this.maxTokens,
        lastRefill: Date.now(),
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refillBucket(bucket: RateLimitBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const refill = elapsed * this.refillRate;
    bucket.tokens = Math.min(
      this.maxTokens,
      bucket.tokens + refill
    );
    bucket.lastRefill = now;
  }
}

// ---------- Timing Middleware ----------

/**
 * Measures and reports operation latency.
 */
export class TimingMiddleware extends Middleware {
  private logger: Logger;
  private onTiming?: (method: string, durationMs: number) => void;

  constructor(options?: {
    onTiming?: (method: string, durationMs: number) => void;
  }) {
    super("TimingMiddleware");
    this.logger = new Logger("Timing");
    this.onTiming = options?.onTiming;
  }

  async handle<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Promise<R> {
    const start = performance.now();
    try {
      return await callNext(context);
    } finally {
      const duration = performance.now() - start;
      const method = context.method ?? "unknown";
      this.logger.debug(`${method}: ${duration.toFixed(2)}ms`);
      this.onTiming?.(method, duration);
    }
  }
}

// ---------- Middleware Pipeline ----------

/**
 * Compose multiple middleware into a processing pipeline.
 */
export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  add(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute the middleware pipeline with the given handler.
   */
  async execute<T, R>(
    context: MiddlewareContext<T>,
    handler: CallNext<T, R>
  ): Promise<R> {
    if (this.middlewares.length === 0) {
      return handler(context);
    }

    const chain = this.buildChain(handler);
    return chain(context);
  }

  private buildChain<T, R>(
    handler: CallNext<T, R>
  ): CallNext<T, R> {
    let next = handler;

    // Build chain from end to start
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const middleware = this.middlewares[i];
      const currentNext = next;
      next = ((ctx: MiddlewareContext<T>) =>
        middleware.handle(ctx, currentNext)) as CallNext<T, R>;
    }

    return next;
  }
}

// ---------- Helpers ----------

/**
 * Create a middleware from a function.
 */
export function createMiddleware(
  name: string,
  handler: <T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ) => Promise<R>
): Middleware {
  return new FunctionMiddleware(name, handler);
}
