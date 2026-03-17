/**
 * Tests for the Middleware system.
 */
import { describe, it, expect, vi } from "vitest";
import {
  LoggingMiddleware,
  ErrorHandlingMiddleware,
  RateLimitingMiddleware,
  TimingMiddleware,
  MiddlewarePipeline,
  createMiddleware,
} from "@/lib/fastmcp/server/middleware";
import type { MiddlewareContext, CallNext } from "@/lib/fastmcp/types";
import { FastMCPError, MiddlewareError } from "@/lib/fastmcp/exceptions";

function createTestContext<T>(
  message: T,
  method: string = "test"
): MiddlewareContext<T> {
  return {
    message,
    source: "client",
    type: "request",
    method,
    timestamp: new Date(),
  };
}

describe("MiddlewarePipeline", () => {
  it("should execute handler directly with no middleware", async () => {
    const pipeline = new MiddlewarePipeline();
    const handler = vi.fn().mockResolvedValue("result");
    const ctx = createTestContext("test");

    const result = await pipeline.execute(ctx, handler);

    expect(result).toBe("result");
    expect(handler).toHaveBeenCalledWith(ctx);
  });

  it("should execute middleware in order", async () => {
    const pipeline = new MiddlewarePipeline();
    const order: string[] = [];

    pipeline.add(
      createMiddleware("first", async (ctx, next) => {
        order.push("first-before");
        const result = await next(ctx);
        order.push("first-after");
        return result;
      })
    );

    pipeline.add(
      createMiddleware("second", async (ctx, next) => {
        order.push("second-before");
        const result = await next(ctx);
        order.push("second-after");
        return result;
      })
    );

    const handler = vi.fn().mockImplementation(() => {
      order.push("handler");
      return "result";
    });

    const ctx = createTestContext("test");
    await pipeline.execute(ctx, handler);

    expect(order).toEqual([
      "first-before",
      "second-before",
      "handler",
      "second-after",
      "first-after",
    ]);
  });
});

describe("ErrorHandlingMiddleware", () => {
  it("should pass through successful results", async () => {
    const middleware = new ErrorHandlingMiddleware();
    const ctx = createTestContext("test");
    const next = vi.fn().mockResolvedValue("success");

    const result = await middleware.handle(ctx, next);
    expect(result).toBe("success");
  });

  it("should re-throw FastMCPError", async () => {
    const middleware = new ErrorHandlingMiddleware();
    const ctx = createTestContext("test");
    const next = vi.fn().mockRejectedValue(
      new FastMCPError("test error")
    );

    await expect(middleware.handle(ctx, next)).rejects.toThrow(
      "test error"
    );
  });

  it("should mask error details when configured", async () => {
    const middleware = new ErrorHandlingMiddleware(true);
    const ctx = createTestContext("test");
    const next = vi.fn().mockRejectedValue(
      new FastMCPError("sensitive detail")
    );

    await expect(middleware.handle(ctx, next)).rejects.toThrow(
      "An internal error occurred"
    );
  });
});

describe("RateLimitingMiddleware", () => {
  it("should allow requests within rate limit", async () => {
    const middleware = new RateLimitingMiddleware({
      maxTokens: 5,
      refillRate: 10,
    });
    const ctx = createTestContext("test");
    const next = vi.fn().mockResolvedValue("ok");

    for (let i = 0; i < 5; i++) {
      const result = await middleware.handle(ctx, next);
      expect(result).toBe("ok");
    }
  });

  it("should reject requests over rate limit", async () => {
    const middleware = new RateLimitingMiddleware({
      maxTokens: 2,
      refillRate: 0,
    });
    const ctx = createTestContext("test");
    const next = vi.fn().mockResolvedValue("ok");

    // First two should pass
    await middleware.handle(ctx, next);
    await middleware.handle(ctx, next);

    // Third should fail
    await expect(middleware.handle(ctx, next)).rejects.toThrow(
      "Rate limit exceeded"
    );
  });
});

describe("TimingMiddleware", () => {
  it("should call onTiming callback", async () => {
    const onTiming = vi.fn();
    const middleware = new TimingMiddleware({ onTiming });
    const ctx = createTestContext("test", "tools/call");
    const next = vi.fn().mockResolvedValue("ok");

    await middleware.handle(ctx, next);

    expect(onTiming).toHaveBeenCalledWith(
      "tools/call",
      expect.any(Number)
    );
  });
});
