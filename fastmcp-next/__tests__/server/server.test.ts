/**
 * Tests for the FastMCP Server class.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { FastMCP } from "@/lib/fastmcp/server/server";
import { NotFoundError } from "@/lib/fastmcp/exceptions";
import { LocalProvider } from "@/lib/fastmcp/server/providers";
import { createTool } from "@/lib/fastmcp/tools";
import { createResource } from "@/lib/fastmcp/resources";
import { createPrompt, userMessage } from "@/lib/fastmcp/prompts";

describe("FastMCP Server", () => {
  let mcp: FastMCP;

  beforeEach(() => {
    mcp = new FastMCP({ name: "Test Server" });
  });

  // --- Lifecycle ---

  it("should initialize with default options", () => {
    expect(mcp.name).toBe("Test Server");
    expect(mcp.version).toBe("1.0.0");
  });

  it("should initialize with custom options", () => {
    const custom = new FastMCP({
      name: "Custom",
      version: "2.0.0",
      instructions: "Be helpful",
    });

    const info = custom.getInfo();
    expect(info.name).toBe("Custom");
    expect(info.version).toBe("2.0.0");
    expect(info.instructions).toBe("Be helpful");
  });

  // --- Tool Registration ---

  it("should register and list tools", async () => {
    mcp.addTool({
      name: "add",
      description: "Add numbers",
      schema: z.object({ a: z.number(), b: z.number() }),
      handler: ({ a, b }) => (a as number) + (b as number),
    });

    const tools = await mcp.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("add");
  });

  it("should call a registered tool", async () => {
    mcp.addTool({
      name: "multiply",
      handler: (args) =>
        (args.a as number) * (args.b as number),
    });

    const result = await mcp.callTool("multiply", { a: 3, b: 4 });

    expect(result.content).toHaveLength(1);
    expect(
      (result.content[0] as { type: "text"; text: string }).text
    ).toBe("12");
  });

  it("should throw NotFoundError for unknown tool", async () => {
    await expect(
      mcp.callTool("nonexistent")
    ).rejects.toThrow(NotFoundError);
  });

  // --- Resource Registration ---

  it("should register and list resources", async () => {
    mcp.addResource({
      name: "config",
      uri: "data://config",
      handler: () => ({ key: "value" }),
    });

    const resources = await mcp.listResources();
    expect(resources).toHaveLength(1);
    expect(resources[0].uri).toBe("data://config");
  });

  it("should read a registered resource", async () => {
    mcp.addResource({
      name: "greeting",
      uri: "data://greeting",
      handler: () => "Hello!",
    });

    const result = await mcp.readResource("data://greeting");

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].text).toBe("Hello!");
  });

  it("should throw NotFoundError for unknown resource", async () => {
    await expect(
      mcp.readResource("data://nonexistent")
    ).rejects.toThrow(NotFoundError);
  });

  // --- Prompt Registration ---

  it("should register and list prompts", async () => {
    mcp.addPrompt({
      name: "analyze",
      description: "Analyze data",
      arguments: [{ name: "data", required: true }],
      handler: ({ data }) => `Analyze: ${data}`,
    });

    const prompts = await mcp.listPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe("analyze");
  });

  it("should render a registered prompt", async () => {
    mcp.addPrompt({
      name: "greet",
      handler: (args) => `Hello, ${args.name}!`,
    });

    const result = await mcp.getPrompt("greet", { name: "World" });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
  });

  it("should throw NotFoundError for unknown prompt", async () => {
    await expect(
      mcp.getPrompt("nonexistent")
    ).rejects.toThrow(NotFoundError);
  });

  // --- Provider System ---

  it("should support additional providers", async () => {
    const extra = new LocalProvider("extra");
    extra.addTool(
      createTool({
        name: "extra_tool",
        handler: () => "from extra provider",
      })
    );

    mcp.addProvider(extra);
    const tools = await mcp.listTools();

    expect(tools.some((t) => t.name === "extra_tool")).toBe(true);
  });

  it("should resolve tools in provider order (first match wins)", async () => {
    // Register a tool on the main server
    mcp.addTool({
      name: "shared",
      handler: () => "from local",
    });

    // Register same-named tool in extra provider
    const extra = new LocalProvider("extra");
    extra.addTool(
      createTool({
        name: "shared",
        handler: () => "from extra",
      })
    );
    mcp.addProvider(extra);

    // Local should win (registered first)
    const result = await mcp.callTool("shared");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toBe("from local");
  });

  // --- State Management ---

  it("should manage server-level state", async () => {
    await mcp.setState("counter", 42);

    const value = await mcp.getState("counter");
    expect(value).toBe(42);

    const cleared = await mcp.clearState("counter");
    expect(cleared).toBe(true);

    const afterClear = await mcp.getState("counter");
    expect(afterClear).toBeUndefined();
  });

  // --- Multiple Components ---

  it("should handle a full server setup", async () => {
    mcp.addTool({
      name: "add",
      schema: z.object({ a: z.number(), b: z.number() }),
      handler: ({ a, b }) => (a as number) + (b as number),
    });

    mcp.addResource({
      name: "status",
      uri: "data://status",
      handler: () => ({ status: "ok" }),
    });

    mcp.addPrompt({
      name: "help",
      handler: () => "How can I help you?",
    });

    const tools = await mcp.listTools();
    const resources = await mcp.listResources();
    const prompts = await mcp.listPrompts();

    expect(tools).toHaveLength(1);
    expect(resources).toHaveLength(1);
    expect(prompts).toHaveLength(1);

    // Call tool
    const toolResult = await mcp.callTool("add", { a: 5, b: 3 });
    expect(
      (toolResult.content[0] as { type: "text"; text: string }).text
    ).toBe("8");

    // Read resource
    const resResult = await mcp.readResource("data://status");
    const parsed = JSON.parse(resResult.contents[0].text!);
    expect(parsed).toEqual({ status: "ok" });

    // Get prompt
    const promptResult = await mcp.getPrompt("help");
    expect(promptResult.messages).toHaveLength(1);
  });
});
