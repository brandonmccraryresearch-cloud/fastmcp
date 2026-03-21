/**
 * Client - MCP Client SDK.
 *
 * Provides the Client class for connecting to MCP servers
 * and invoking tools, reading resources, and getting prompts.
 *
 * Mirrors Python's Client from client/client.py
 */

import type {
  ToolResult,
  ResourceResult,
  PromptResult,
} from "../types";

// ---------- Client Transport ----------

/**
 * Abstract transport interface for connecting to MCP servers.
 */
export interface ClientTransport {
  /** Transport name/type */
  readonly name: string;
  /** Connect to the server */
  connect(): Promise<void>;
  /** Disconnect from the server */
  disconnect(): Promise<void>;
  /** Check if connected */
  isConnected(): boolean;
  /** Send a request and get a response */
  request(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown>;
}

// ---------- Client Options ----------

export interface ClientOptions {
  transport: ClientTransport;
  name?: string;
}

// ---------- Client State ----------

interface ClientState {
  connected: boolean;
  nestingCount: number;
}

// ---------- Client Class ----------

/**
 * MCP Client for communicating with MCP servers.
 *
 * Supports reentrant context management pattern where
 * nested connections reuse the same session.
 *
 * @example
 * ```ts
 * const client = new Client({
 *   transport: new HttpTransport("http://localhost:8000"),
 * });
 *
 * await client.connect();
 * const tools = await client.listTools();
 * const result = await client.callTool("add", { a: 1, b: 2 });
 * await client.disconnect();
 * ```
 */
export class Client {
  readonly name: string;
  private transport: ClientTransport;
  private state: ClientState;

  constructor(options: ClientOptions) {
    this.name = options.name ?? "FastMCP Client";
    this.transport = options.transport;
    this.state = {
      connected: false,
      nestingCount: 0,
    };
  }

  // ---------- Lifecycle ----------

  /**
   * Connect to the MCP server.
   * Supports reentrant connections (nested calls reuse session).
   */
  async connect(): Promise<void> {
    this.state.nestingCount++;
    if (this.state.nestingCount === 1) {
      await this.transport.connect();
      this.state.connected = true;
    }
  }

  /**
   * Disconnect from the MCP server.
   * Only truly disconnects when all nested connections are closed.
   */
  async disconnect(): Promise<void> {
    this.state.nestingCount = Math.max(
      0,
      this.state.nestingCount - 1
    );
    if (this.state.nestingCount === 0 && this.state.connected) {
      await this.transport.disconnect();
      this.state.connected = false;
    }
  }

  /**
   * Check if the client is connected.
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  // ---------- Tool Operations ----------

  /**
   * List all available tools from the server.
   */
  async listTools(): Promise<unknown[]> {
    this.ensureConnected();
    const result = await this.transport.request("tools/list");
    return (result as { tools: unknown[] })?.tools ?? [];
  }

  /**
   * Call a tool on the server.
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<ToolResult> {
    this.ensureConnected();
    const result = await this.transport.request("tools/call", {
      name,
      arguments: args,
    });
    return result as ToolResult;
  }

  // ---------- Resource Operations ----------

  /**
   * List all available resources.
   */
  async listResources(): Promise<unknown[]> {
    this.ensureConnected();
    const result = await this.transport.request("resources/list");
    return (result as { resources: unknown[] })?.resources ?? [];
  }

  /**
   * Read a resource by URI.
   */
  async readResource(uri: string): Promise<ResourceResult> {
    this.ensureConnected();
    const result = await this.transport.request("resources/read", {
      uri,
    });
    return result as ResourceResult;
  }

  /**
   * List available resource templates.
   */
  async listResourceTemplates(): Promise<unknown[]> {
    this.ensureConnected();
    const result = await this.transport.request(
      "resources/templates/list"
    );
    return (
      (result as { resourceTemplates: unknown[] })
        ?.resourceTemplates ?? []
    );
  }

  // ---------- Prompt Operations ----------

  /**
   * List all available prompts.
   */
  async listPrompts(): Promise<unknown[]> {
    this.ensureConnected();
    const result = await this.transport.request("prompts/list");
    return (result as { prompts: unknown[] })?.prompts ?? [];
  }

  /**
   * Get (render) a prompt by name.
   */
  async getPrompt(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<PromptResult> {
    this.ensureConnected();
    const result = await this.transport.request("prompts/get", {
      name,
      arguments: args,
    });
    return result as PromptResult;
  }

  // ---------- Internal ----------

  private ensureConnected(): void {
    if (!this.state.connected) {
      throw new Error("Client is not connected. Call connect() first.");
    }
  }
}
