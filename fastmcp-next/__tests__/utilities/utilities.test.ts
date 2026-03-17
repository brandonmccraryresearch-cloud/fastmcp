/**
 * Tests for utility functions.
 */
import { describe, it, expect } from "vitest";
import {
  generateId,
  shortHash,
  Logger,
  createObjectSchema,
} from "@/lib/fastmcp/utilities";
import { FastMCPComponent } from "@/lib/fastmcp/utilities/components";

describe("generateId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
  });
});

describe("shortHash", () => {
  it("should generate consistent hashes", () => {
    const hash1 = shortHash("test");
    const hash2 = shortHash("test");

    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different inputs", () => {
    const hash1 = shortHash("hello");
    const hash2 = shortHash("world");

    expect(hash1).not.toBe(hash2);
  });
});

describe("Logger", () => {
  it("should respect log levels", () => {
    const logger = new Logger("test", "warn");

    // These should not throw
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");
  });

  it("should allow changing log level", () => {
    const logger = new Logger("test", "error");
    logger.setLevel("debug");

    // Should not throw
    logger.debug("now visible");
  });
});

describe("createObjectSchema", () => {
  it("should create a valid object schema", () => {
    const schema = createObjectSchema({
      name: { type: "string", description: "User name", required: true },
      age: { type: "number", required: false, default: 0 },
    });

    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["name"]);
    expect(schema.properties).toHaveProperty("name");
    expect(schema.properties).toHaveProperty("age");
  });
});

describe("FastMCPComponent", () => {
  class TestComponent extends FastMCPComponent {}

  it("should store metadata", () => {
    const comp = new TestComponent({
      name: "test",
      version: "1.0",
      title: "Test Component",
      description: "A test",
      tags: ["math", "utility"],
      meta: { custom: true },
    });

    expect(comp.name).toBe("test");
    expect(comp.version).toBe("1.0");
    expect(comp.title).toBe("Test Component");
    expect(comp.description).toBe("A test");
    expect(comp.tags).toEqual(new Set(["math", "utility"]));
    expect(comp.meta).toEqual({ custom: true });
  });

  it("should check tags", () => {
    const comp = new TestComponent({
      name: "test",
      tags: ["a", "b"],
    });

    expect(comp.hasTag("a")).toBe(true);
    expect(comp.hasTag("c")).toBe(false);
    expect(comp.matchesTags(["b", "c"])).toBe(true);
    expect(comp.matchesTags(["c", "d"])).toBe(false);
  });

  it("should provide metadata object", () => {
    const comp = new TestComponent({
      name: "test",
      description: "desc",
    });

    const meta = comp.getMetadata();
    expect(meta.name).toBe("test");
    expect(meta.description).toBe("desc");
  });
});
