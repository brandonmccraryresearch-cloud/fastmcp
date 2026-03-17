/**
 * Example MCP Server instance.
 *
 * Demonstrates how to configure a FastMCP server with tools,
 * resources, and prompts for use with Next.js API routes.
 */

import { z } from "zod";
import { FastMCP } from "@/lib/fastmcp";

// Create a singleton server instance
const mcp = new FastMCP({
  name: "FastMCP Demo Server",
  version: "1.0.0",
  instructions:
    "A demo MCP server showcasing tools, resources, and prompts.",
});

// ---------- Tools ----------

mcp.addTool({
  name: "add",
  description: "Add two numbers together",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
  handler: ({ a, b }) => ({
    sum: (a as number) + (b as number),
  }),
});

mcp.addTool({
  name: "greet",
  description: "Generate a personalized greeting",
  schema: z.object({
    name: z.string().describe("Name of the person to greet"),
    style: z
      .enum(["formal", "casual", "pirate"])
      .optional()
      .describe("Greeting style"),
  }),
  handler: ({ name, style }) => {
    const n = name as string;
    switch (style) {
      case "formal":
        return `Good day, esteemed ${n}. It is a pleasure to make your acquaintance.`;
      case "pirate":
        return `Ahoy, ${n}! Welcome aboard, ye scallywag!`;
      case "casual":
      default:
        return `Hey ${n}! What's up?`;
    }
  },
});

mcp.addTool({
  name: "calculate",
  description: "Perform basic arithmetic operations",
  schema: z.object({
    operation: z
      .enum(["add", "subtract", "multiply", "divide"])
      .describe("The arithmetic operation"),
    x: z.number().describe("First operand"),
    y: z.number().describe("Second operand"),
  }),
  handler: ({ operation, x, y }) => {
    const a = x as number;
    const b = y as number;
    switch (operation) {
      case "add":
        return { result: a + b };
      case "subtract":
        return { result: a - b };
      case "multiply":
        return { result: a * b };
      case "divide":
        if (b === 0) return { error: "Division by zero" };
        return { result: a / b };
      default:
        return { error: "Unknown operation" };
    }
  },
});

// ---------- Resources ----------

mcp.addResource({
  name: "server-info",
  uri: "data://server/info",
  description: "Server information and capabilities",
  mimeType: "application/json",
  handler: () => ({
    name: "FastMCP Demo",
    version: "1.0.0",
    framework: "Next.js + TypeScript",
    capabilities: ["tools", "resources", "prompts"],
  }),
});

mcp.addResource({
  name: "available-tools",
  uri: "data://tools/catalog",
  description: "Catalog of all available tools",
  mimeType: "application/json",
  handler: async () => {
    const tools = await mcp.listTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
  },
});

// ---------- Resource Templates ----------

mcp.addResourceTemplate({
  name: "user-profile",
  uriTemplate: "data://users/{userId}",
  description: "Get user profile by ID",
  mimeType: "application/json",
  handler: ({ userId }) => ({
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`,
    joinedAt: new Date().toISOString(),
  }),
});

// ---------- Prompts ----------

mcp.addPrompt({
  name: "code-review",
  description: "Generate a code review prompt",
  arguments: [
    { name: "code", description: "The code to review", required: true },
    {
      name: "language",
      description: "Programming language",
      required: false,
    },
  ],
  handler: ({ code, language }) => {
    const lang = (language as string) ?? "unknown";
    return [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Please review this ${lang} code for potential issues, improvements, and best practices:\n\n\`\`\`${lang}\n${code}\n\`\`\``,
          },
        ],
      },
    ];
  },
});

mcp.addPrompt({
  name: "explain",
  description: "Request an explanation of a topic",
  arguments: [
    { name: "topic", description: "Topic to explain", required: true },
    {
      name: "level",
      description: "Explanation level",
      required: false,
    },
  ],
  handler: ({ topic, level }) => {
    const l = (level as string) ?? "intermediate";
    return `Please explain "${topic}" at a ${l} level. Include examples where helpful.`;
  },
});

export { mcp };
