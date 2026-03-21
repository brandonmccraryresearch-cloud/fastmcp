import { describe, it, expect } from "vitest";
import { FastMCP } from "@/lib/fastmcp/server/server";
import { Client } from "@/lib/fastmcp/client/client";
import { InMemoryTransport } from "@/lib/fastmcp/client/transports/memory";
import { z } from "zod";

describe("InMemoryTransport", () => {
  it("should list tools through client", async () => {
    const server = new FastMCP({ name: "Test" });
    server.addTool({
      name: "add",
      schema: z.object({ a: z.number(), b: z.number() }),
      handler: ({ a, b }) => (a as number) + (b as number),
    });

    const transport = new InMemoryTransport(server);
    const client = new Client({ transport });

    await client.connect();
    const tools = await client.listTools();
    expect(tools).toHaveLength(1);
    expect((tools[0] as { name: string }).name).toBe("add");
    await client.disconnect();
  });

  it("should call tools through client", async () => {
    const server = new FastMCP({ name: "Test" });
    server.addTool({
      name: "greet",
      schema: z.object({ name: z.string() }),
      handler: ({ name }) => `Hello, ${name}!`,
    });

    const transport = new InMemoryTransport(server);
    const client = new Client({ transport });

    await client.connect();
    const result = await client.callTool("greet", { name: "World" });
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Hello, World!",
    });
    await client.disconnect();
  });

  it("should list resources through client", async () => {
    const server = new FastMCP({ name: "Test" });
    server.addResource({
      name: "config",
      uri: "data://config",
      handler: () => ({ debug: false }),
    });

    const transport = new InMemoryTransport(server);
    const client = new Client({ transport });

    await client.connect();
    const resources = await client.listResources();
    expect(resources).toHaveLength(1);
    expect((resources[0] as { uri: string }).uri).toBe("data://config");
    await client.disconnect();
  });

  it("should read resources through client", async () => {
    const server = new FastMCP({ name: "Test" });
    server.addResource({
      name: "greeting",
      uri: "data://greeting",
      handler: () => "Hello from resource!",
    });

    const transport = new InMemoryTransport(server);
    const client = new Client({ transport });

    await client.connect();
    const result = await client.readResource("data://greeting");
    expect(result.contents[0].text).toBe("Hello from resource!");
    await client.disconnect();
  });

  it("should list prompts through client", async () => {
    const server = new FastMCP({ name: "Test" });
    server.addPrompt({
      name: "analyze",
      description: "Analyze data",
      arguments: [{ name: "data", required: true }],
      handler: ({ data }) => `Analyze: ${data}`,
    });

    const transport = new InMemoryTransport(server);
    const client = new Client({ transport });

    await client.connect();
    const prompts = await client.listPrompts();
    expect(prompts).toHaveLength(1);
    expect((prompts[0] as { name: string }).name).toBe("analyze");
    await client.disconnect();
  });

  it("should get prompts through client", async () => {
    const server = new FastMCP({ name: "Test" });
    server.addPrompt({
      name: "greet",
      arguments: [{ name: "name", required: true }],
      handler: ({ name }) => `Hello, ${name}!`,
    });

    const transport = new InMemoryTransport(server);
    const client = new Client({ transport });

    await client.connect();
    const result = await client.getPrompt("greet", { name: "Alice" });
    expect(result.messages[0].content[0]).toEqual({
      type: "text",
      text: "Hello, Alice!",
    });
    await client.disconnect();
  });

  it("should handle initialize request", async () => {
    const server = new FastMCP({ name: "My Server", version: "2.0.0" });
    const transport = new InMemoryTransport(server);

    await transport.connect();
    const result = (await transport.request("initialize")) as {
      serverInfo: { name: string; version: string };
      capabilities: Record<string, unknown>;
    };
    expect(result.serverInfo.name).toBe("My Server");
    expect(result.serverInfo.version).toBe("2.0.0");
    expect(result.capabilities).toBeDefined();
    await transport.disconnect();
  });

  it("should throw for unknown methods", async () => {
    const server = new FastMCP({ name: "Test" });
    const transport = new InMemoryTransport(server);

    await transport.connect();
    await expect(transport.request("unknown/method")).rejects.toThrow(
      "Unknown method"
    );
    await transport.disconnect();
  });

  it("should throw when not connected", async () => {
    const server = new FastMCP({ name: "Test" });
    const transport = new InMemoryTransport(server);

    await expect(transport.request("tools/list")).rejects.toThrow(
      "not connected"
    );
  });

  it("should list resource templates", async () => {
    const server = new FastMCP({ name: "Test" });
    server.addResourceTemplate({
      name: "user",
      uriTemplate: "data://users/{id}",
      handler: ({ id }) => ({ userId: id }),
    });

    const transport = new InMemoryTransport(server);
    const client = new Client({ transport });

    await client.connect();
    const templates = await client.listResourceTemplates();
    expect(templates).toHaveLength(1);
    expect(
      (templates[0] as { uriTemplate: string }).uriTemplate
    ).toBe("data://users/{id}");
    await client.disconnect();
  });
});

describe("HttpTransport", () => {
  it("should have correct interface", async () => {
    const { HttpTransport } = await import(
      "@/lib/fastmcp/client/transports/http"
    );
    const transport = new HttpTransport("http://localhost:8080/api/mcp");
    expect(transport.name).toBe("http");
    expect(transport.isConnected()).toBe(false);

    await transport.connect();
    expect(transport.isConnected()).toBe(true);

    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
  });

  it("should construct with options object", async () => {
    const { HttpTransport } = await import(
      "@/lib/fastmcp/client/transports/http"
    );
    const transport = new HttpTransport({
      url: "http://localhost:8080",
      bearerToken: "test-token",
      timeoutMs: 5000,
    });
    expect(transport.name).toBe("http");
  });

  it("should throw when not connected", async () => {
    const { HttpTransport } = await import(
      "@/lib/fastmcp/client/transports/http"
    );
    const transport = new HttpTransport("http://localhost:8080");
    await expect(
      transport.request("tools/list")
    ).rejects.toThrow("not connected");
  });
});
