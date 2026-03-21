/**
 * In-Memory Transport — Connect to a FastMCP server in the same process.
 *
 * This transport bypasses network entirely, calling the server's
 * methods directly. Useful for testing and same-process integration.
 *
 * Mirrors Python's FastMCPTransport.
 */

import type { ClientTransport } from "../client";
import type { FastMCP } from "../../server/server";

export class InMemoryTransport implements ClientTransport {
  readonly name = "memory";
  private server: FastMCP;
  private connected = false;

  constructor(server: FastMCP) {
    this.server = server;
  }

  async connect(): Promise<void> {
    await this.server.initialize();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async request(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.connected) {
      throw new Error("Transport is not connected");
    }

    switch (method) {
      case "tools/list": {
        const tools = await this.server.listTools();
        return {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        };
      }

      case "tools/call": {
        const { name, arguments: args } = params as {
          name: string;
          arguments?: Record<string, unknown>;
        };
        return this.server.callTool(name, args ?? {});
      }

      case "resources/list": {
        const resources = await this.server.listResources();
        return {
          resources: resources.map((r) => ({
            name: r.name,
            uri: r.uri,
            description: r.description,
            mimeType: r.mimeType,
          })),
        };
      }

      case "resources/read": {
        const { uri } = params as { uri: string };
        return this.server.readResource(uri);
      }

      case "resources/templates/list": {
        const templates = await this.server.listResourceTemplates();
        return {
          resourceTemplates: templates.map((t) => ({
            name: t.name,
            uriTemplate: t.uriTemplate,
            description: t.description,
            mimeType: t.mimeType,
          })),
        };
      }

      case "prompts/list": {
        const prompts = await this.server.listPrompts();
        return {
          prompts: prompts.map((p) => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
          })),
        };
      }

      case "prompts/get": {
        const { name: promptName, arguments: promptArgs } = params as {
          name: string;
          arguments?: Record<string, unknown>;
        };
        return this.server.getPrompt(promptName, promptArgs ?? {});
      }

      case "initialize": {
        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false, subscribe: false },
            prompts: { listChanged: false },
          },
          serverInfo: this.server.getInfo(),
        };
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }
}
