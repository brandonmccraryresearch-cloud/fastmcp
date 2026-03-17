/**
 * Tests for the Tool module.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  FunctionTool,
  createTool,
  Tool,
  type ToolHandler,
} from "@/lib/fastmcp/tools";
import { ToolError } from "@/lib/fastmcp/exceptions";

describe("FunctionTool", () => {
  it("should create a tool with basic options", () => {
    const tool = new FunctionTool({
      name: "test_tool",
      description: "A test tool",
      handler: () => "hello",
    });

    expect(tool.name).toBe("test_tool");
    expect(tool.description).toBe("A test tool");
    expect(tool.inputSchema.type).toBe("object");
  });

  it("should run a simple tool", async () => {
    const tool = createTool({
      name: "greet",
      handler: (args) => `Hello, ${args.name}!`,
    });

    const result = await tool.run({ name: "World" });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as { type: "text"; text: string }).text).toBe(
      "Hello, World!"
    );
  });

  it("should handle async handlers", async () => {
    const tool = createTool({
      name: "async_tool",
      handler: async (args) => {
        return { result: (args.a as number) + (args.b as number) };
      },
    });

    const result = await tool.run({ a: 1, b: 2 });

    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(JSON.parse(text)).toEqual({ result: 3 });
  });

  it("should validate input with Zod schema", async () => {
    const tool = createTool({
      name: "validated",
      schema: z.object({
        name: z.string(),
        age: z.number(),
      }),
      handler: (args) => `${args.name} is ${args.age}`,
    });

    // Valid input
    const result = await tool.run({ name: "Alice", age: 30 });
    expect(result.content).toHaveLength(1);

    // Invalid input
    await expect(
      tool.run({ name: "Alice", age: "thirty" as unknown as number })
    ).rejects.toThrow(ToolError);
  });

  it("should handle ToolResult return values", async () => {
    const tool = createTool({
      name: "rich_result",
      handler: () => ({
        content: [{ type: "text" as const, text: "custom result" }],
      }),
    });

    const result = await tool.run({});

    expect(result.content).toHaveLength(1);
    expect((result.content[0] as { type: "text"; text: string }).text).toBe(
      "custom result"
    );
  });

  it("should timeout if handler takes too long", async () => {
    const tool = createTool({
      name: "slow_tool",
      timeout: 50,
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "done";
      },
    });

    await expect(tool.run({})).rejects.toThrow(ToolError);
  });

  it("should support tags", () => {
    const tool = createTool({
      name: "tagged",
      tags: ["math", "utility"],
      handler: () => null,
    });

    expect(tool.hasTag("math")).toBe(true);
    expect(tool.hasTag("utility")).toBe(true);
    expect(tool.hasTag("other")).toBe(false);
  });

  it("should throw if name is missing", () => {
    const anonHandler: ToolHandler = (() => {
      const fn = function () {
        return null;
      };
      Object.defineProperty(fn, "name", { value: "" });
      return fn;
    })();
    expect(() =>
      createTool({
        handler: anonHandler,
      })
    ).toThrow(ToolError);
  });
});

describe("createTool", () => {
  it("should use function name as tool name", () => {
    function myNamedTool() {
      return "result";
    }
    const tool = createTool({ handler: myNamedTool });
    expect(tool.name).toBe("myNamedTool");
  });

  it("should override function name with explicit name", () => {
    function myFunc() {
      return "result";
    }
    const tool = createTool({
      name: "custom_name",
      handler: myFunc,
    });
    expect(tool.name).toBe("custom_name");
  });
});
