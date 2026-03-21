import { describe, it, expect } from "vitest";
import { createTool } from "@/lib/fastmcp/tools/tool";
import { createResource } from "@/lib/fastmcp/resources/resource";
import { createPrompt } from "@/lib/fastmcp/prompts/prompt";
import { z } from "zod";
import {
  Transform,
  TransformPipeline,
  Namespace,
  Visibility,
  isEnabled,
  VersionFilter,
  ToolTransform,
} from "@/lib/fastmcp/server/transforms";

// ---------- Helpers ----------

function makeTools() {
  return [
    createTool({
      name: "add",
      description: "Add numbers",
      schema: z.object({ a: z.number(), b: z.number() }),
      handler: ({ a, b }) => (a as number) + (b as number),
    }),
    createTool({
      name: "multiply",
      description: "Multiply numbers",
      schema: z.object({ x: z.number(), y: z.number() }),
      handler: ({ x, y }) => (x as number) * (y as number),
    }),
  ];
}

function makePrompts() {
  return [
    createPrompt({
      name: "greet",
      description: "Greet someone",
      arguments: [{ name: "name", required: true }],
      handler: ({ name }) => `Hello, ${name}!`,
    }),
  ];
}

function makeVersionedTools() {
  return [
    createTool({
      name: "v1_tool",
      description: "Version 1",
      handler: () => "v1",
    }),
    createTool({
      name: "v2_tool",
      description: "Version 2",
      handler: () => "v2",
    }),
    createTool({
      name: "v3_tool",
      description: "Version 3",
      handler: () => "v3",
    }),
    createTool({
      name: "unversioned_tool",
      description: "No version",
      handler: () => "unversioned",
    }),
  ].map((tool, i) => {
    // Manually set versions on clones
    const versions = ["1.0", "2.0", "3.0", undefined];
    if (versions[i]) {
      Object.defineProperty(tool, "version", { value: versions[i], writable: false });
    }
    return tool;
  });
}

// ---------- Transform Base ----------

describe("Transform (base class)", () => {
  it("should pass through by default", async () => {
    class NoopTransform extends Transform {
      constructor() {
        super("noop");
      }
    }
    const transform = new NoopTransform();
    const tools = makeTools();
    const result = await transform.listTools(tools);
    expect(result).toEqual(tools);
  });

  it("should pass get operations through to callNext", async () => {
    class NoopTransform extends Transform {
      constructor() {
        super("noop");
      }
    }
    const transform = new NoopTransform();
    const tools = makeTools();
    const lookup = async (name: string) =>
      tools.find((t) => t.name === name) ?? null;

    const result = await transform.getTool("add", lookup);
    expect(result?.name).toBe("add");
  });
});

// ---------- Namespace Transform ----------

describe("Namespace Transform", () => {
  it("should prefix tool names on list", async () => {
    const ns = new Namespace("math");
    const tools = makeTools();
    const result = await ns.listTools(tools);

    expect(result[0].name).toBe("math_add");
    expect(result[1].name).toBe("math_multiply");
  });

  it("should prefix prompt names on list", async () => {
    const ns = new Namespace("api");
    const prompts = makePrompts();
    const result = await ns.listPrompts(prompts);

    expect(result[0].name).toBe("api_greet");
  });

  it("should use custom separator", async () => {
    const ns = new Namespace("ns", ".");
    const tools = makeTools();
    const result = await ns.listTools(tools);

    expect(result[0].name).toBe("ns.add");
  });

  it("should reverse-map names on get", async () => {
    const ns = new Namespace("math");
    const tools = makeTools();
    const lookup = async (name: string) =>
      tools.find((t) => t.name === name) ?? null;

    const result = await ns.getTool("math_add", lookup);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("math_add");
  });

  it("should return null for non-matching names on get", async () => {
    const ns = new Namespace("math");
    const tools = makeTools();
    const lookup = async (name: string) =>
      tools.find((t) => t.name === name) ?? null;

    const result = await ns.getTool("other_add", lookup);
    expect(result).toBeNull();
  });

  it("should transform resource URIs", async () => {
    const ns = new Namespace("data");
    const resources = [
      createResource({
        name: "config",
        uri: "file://config.json",
        handler: () => "{}",
      }),
    ];
    const result = await ns.listResources(resources);
    expect(result[0].uri).toBe("file://data/config.json");
  });
});

// ---------- Visibility Transform ----------

describe("Visibility Transform", () => {
  it("should mark matching components as disabled", async () => {
    const vis = new Visibility(false, {
      names: ["add"],
    });
    const tools = makeTools();
    const result = await vis.listTools(tools);

    expect(isEnabled(result[0])).toBe(false); // "add" disabled
    expect(isEnabled(result[1])).toBe(true); // "multiply" unchanged
  });

  it("should mark matching components as enabled", async () => {
    const vis = new Visibility(true, { matchAll: true });
    const tools = makeTools();
    const result = await vis.listTools(tools);

    expect(isEnabled(result[0])).toBe(true);
    expect(isEnabled(result[1])).toBe(true);
  });

  it("should match by tags", async () => {
    const tool = createTool({
      name: "tagged",
      tags: ["internal"],
      handler: () => "result",
    });
    const vis = new Visibility(false, { tags: ["internal"] });
    const result = await vis.listTools([tool]);

    expect(isEnabled(result[0])).toBe(false);
  });

  it("should not match when no criteria specified", async () => {
    const vis = new Visibility(false, {});
    const tools = makeTools();
    const result = await vis.listTools(tools);

    // No criteria means no match — all enabled
    expect(isEnabled(result[0])).toBe(true);
    expect(isEnabled(result[1])).toBe(true);
  });

  it("isEnabled should return true for unmarked components", async () => {
    const tool = createTool({
      name: "plain",
      handler: () => "result",
    });
    expect(isEnabled(tool)).toBe(true);
  });
});

// ---------- VersionFilter Transform ----------

describe("VersionFilter Transform", () => {
  it("should filter by version >= bound", async () => {
    const filter = new VersionFilter({ versionGte: "2.0" });
    const tools = makeVersionedTools();
    const result = await filter.listTools(tools);

    const names = result.map((t) => t.name);
    expect(names).toContain("v2_tool");
    expect(names).toContain("v3_tool");
    expect(names).toContain("unversioned_tool"); // included by default
    expect(names).not.toContain("v1_tool");
  });

  it("should filter by version < bound", async () => {
    const filter = new VersionFilter({ versionLt: "3.0" });
    const tools = makeVersionedTools();
    const result = await filter.listTools(tools);

    const names = result.map((t) => t.name);
    expect(names).toContain("v1_tool");
    expect(names).toContain("v2_tool");
    expect(names).not.toContain("v3_tool");
  });

  it("should exclude unversioned when configured", async () => {
    const filter = new VersionFilter({
      versionGte: "1.0",
      includeUnversioned: false,
    });
    const tools = makeVersionedTools();
    const result = await filter.listTools(tools);

    const names = result.map((t) => t.name);
    expect(names).not.toContain("unversioned_tool");
  });

  it("should filter on get operations", async () => {
    const filter = new VersionFilter({ versionGte: "2.0" });
    const tools = makeVersionedTools();
    const lookup = async (name: string) =>
      tools.find((t) => t.name === name) ?? null;

    const v1 = await filter.getTool("v1_tool", lookup);
    const v2 = await filter.getTool("v2_tool", lookup);
    expect(v1).toBeNull();
    expect(v2).not.toBeNull();
  });
});

// ---------- ToolTransform ----------

describe("ToolTransform", () => {
  it("should rename a tool", async () => {
    const transform = new ToolTransform({
      add: { name: "addition" },
    });
    const tools = makeTools();
    const result = await transform.listTools(tools);

    expect(result.find((t) => t.name === "addition")).toBeTruthy();
    expect(result.find((t) => t.name === "add")).toBeFalsy();
  });

  it("should rename tool arguments", async () => {
    const transform = new ToolTransform({
      add: {
        arguments: {
          a: { name: "first" },
          b: { name: "second" },
        },
      },
    });
    const tools = makeTools();
    const result = await transform.listTools(tools);

    const addTool = result.find((t) => t.name === "add");
    expect(addTool?.inputSchema.properties).toHaveProperty("first");
    expect(addTool?.inputSchema.properties).toHaveProperty("second");
    expect(addTool?.inputSchema.properties).not.toHaveProperty("a");
    expect(addTool?.inputSchema.properties).not.toHaveProperty("b");
  });

  it("should reverse-map names on get", async () => {
    const transform = new ToolTransform({
      add: { name: "addition" },
    });
    const tools = makeTools();
    const lookup = async (name: string) =>
      tools.find((t) => t.name === name) ?? null;

    const result = await transform.getTool("addition", lookup);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("addition");
  });

  it("should throw on duplicate target names", () => {
    expect(
      () =>
        new ToolTransform({
          add: { name: "same" },
          multiply: { name: "same" },
        })
    ).toThrow("Duplicate target name");
  });
});

// ---------- TransformPipeline ----------

describe("TransformPipeline", () => {
  it("should chain list operations sequentially", async () => {
    const pipeline = new TransformPipeline();
    pipeline.add(new Namespace("math"));
    pipeline.add(
      new ToolTransform({
        math_add: { name: "math_addition" },
      })
    );

    const tools = makeTools();
    const result = await pipeline.listTools(tools);

    expect(result.find((t) => t.name === "math_addition")).toBeTruthy();
    expect(result.find((t) => t.name === "math_multiply")).toBeTruthy();
  });

  it("should chain get operations as middleware", async () => {
    const pipeline = new TransformPipeline();
    pipeline.add(new Namespace("math"));

    const tools = makeTools();
    const lookup = async (name: string) =>
      tools.find((t) => t.name === name) ?? null;

    const result = await pipeline.getTool("math_add", lookup);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("math_add");
  });

  it("should support remove", () => {
    const pipeline = new TransformPipeline();
    const ns = new Namespace("test");
    pipeline.add(ns);
    expect(pipeline.length).toBe(1);

    pipeline.remove(ns.name);
    expect(pipeline.length).toBe(0);
  });
});
