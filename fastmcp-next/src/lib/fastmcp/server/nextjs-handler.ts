/**
 * Next.js API Route Handler for MCP Server.
 *
 * Provides a Next.js App Router-compatible API route that serves
 * MCP operations over HTTP. This bridges FastMCP with Next.js.
 *
 * @example
 * ```ts
 * // app/api/mcp/route.ts
 * import { createMCPHandler } from "@/lib/fastmcp/server/nextjs-handler";
 * import { FastMCP } from "@/lib/fastmcp";
 *
 * const mcp = new FastMCP({ name: "My Server" });
 * // ... register tools, resources, prompts ...
 *
 * const { GET, POST } = createMCPHandler(mcp);
 * export { GET, POST };
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import type { FastMCP } from "./server";
import { NotFoundError, ValidationError } from "../exceptions";

// ---------- MCP JSON-RPC Types ----------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ---------- Handler ----------

export interface MCPHandlerOptions {
  /** Base path for the MCP API (default: "/api/mcp") */
  basePath?: string;
  /** CORS origins to allow */
  corsOrigins?: string[];
}

/**
 * Create Next.js API route handlers for an MCP server.
 */
export function createMCPHandler(
  mcp: FastMCP,
  options: MCPHandlerOptions = {}
) {
  const corsOrigins = options.corsOrigins ?? ["*"];

  function corsHeaders(): Record<string, string> {
    return {
      "Access-Control-Allow-Origin": corsOrigins.join(", "),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }

  /**
   * Handle GET requests - server info and discovery.
   */
  async function GET(request: NextRequest): Promise<NextResponse> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Server info
    if (pathname.endsWith("/info") || pathname.endsWith("/mcp")) {
      return NextResponse.json(
        {
          ...mcp.getInfo(),
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
          },
        },
        { headers: corsHeaders() }
      );
    }

    // List tools
    if (pathname.endsWith("/tools")) {
      const tools = await mcp.listTools();
      return NextResponse.json(
        {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            ...(t.version && { version: t.version }),
          })),
        },
        { headers: corsHeaders() }
      );
    }

    // List resources
    if (pathname.endsWith("/resources")) {
      const resources = await mcp.listResources();
      return NextResponse.json(
        {
          resources: resources.map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
          })),
        },
        { headers: corsHeaders() }
      );
    }

    // List resource templates
    if (pathname.endsWith("/templates")) {
      const templates = await mcp.listResourceTemplates();
      return NextResponse.json(
        {
          resourceTemplates: templates.map((t) => ({
            uriTemplate: t.uriTemplate,
            name: t.name,
            description: t.description,
            mimeType: t.mimeType,
          })),
        },
        { headers: corsHeaders() }
      );
    }

    // List prompts
    if (pathname.endsWith("/prompts")) {
      const prompts = await mcp.listPrompts();
      return NextResponse.json(
        {
          prompts: prompts.map((p) => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
          })),
        },
        { headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  /**
   * Handle POST requests - JSON-RPC operations.
   */
  async function POST(request: NextRequest): Promise<NextResponse> {
    let rpcRequest: JsonRpcRequest;

    try {
      rpcRequest = (await request.json()) as JsonRpcRequest;
    } catch {
      return NextResponse.json(
        createRpcError(null, -32700, "Parse error"),
        { status: 400, headers: corsHeaders() }
      );
    }

    if (rpcRequest.jsonrpc !== "2.0" || !rpcRequest.method) {
      return NextResponse.json(
        createRpcError(
          rpcRequest.id ?? null,
          -32600,
          "Invalid Request"
        ),
        { status: 400, headers: corsHeaders() }
      );
    }

    try {
      const result = await handleMethod(
        mcp,
        rpcRequest.method,
        rpcRequest.params ?? {}
      );

      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: rpcRequest.id,
        result,
      };

      return NextResponse.json(response, {
        headers: corsHeaders(),
      });
    } catch (error) {
      const [code, message] = getErrorInfo(error);
      return NextResponse.json(
        createRpcError(rpcRequest.id ?? null, code, message),
        { status: getHttpStatus(code), headers: corsHeaders() }
      );
    }
  }

  /**
   * Handle OPTIONS for CORS preflight.
   */
  async function OPTIONS(): Promise<NextResponse> {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  return { GET, POST, OPTIONS };
}

// ---------- Method Dispatch ----------

async function handleMethod(
  mcp: FastMCP,
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (method) {
    case "initialize":
      await mcp.initialize();
      return {
        protocolVersion: "2024-11-05",
        serverInfo: mcp.getInfo(),
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
      };

    case "tools/list": {
      const tools = await mcp.listTools();
      return {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    }

    case "tools/call": {
      const name = params.name as string;
      const args = (params.arguments as Record<string, unknown>) ?? {};
      if (!name) {
        throw new ValidationError("Tool name is required");
      }
      return mcp.callTool(name, args);
    }

    case "resources/list": {
      const resources = await mcp.listResources();
      return {
        resources: resources.map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        })),
      };
    }

    case "resources/read": {
      const uri = params.uri as string;
      if (!uri) {
        throw new ValidationError("Resource URI is required");
      }
      return mcp.readResource(uri);
    }

    case "resources/templates/list": {
      const templates = await mcp.listResourceTemplates();
      return {
        resourceTemplates: templates.map((t) => ({
          uriTemplate: t.uriTemplate,
          name: t.name,
          description: t.description,
          mimeType: t.mimeType,
        })),
      };
    }

    case "prompts/list": {
      const prompts = await mcp.listPrompts();
      return {
        prompts: prompts.map((p) => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments,
        })),
      };
    }

    case "prompts/get": {
      const name = params.name as string;
      const args = (params.arguments as Record<string, unknown>) ?? {};
      if (!name) {
        throw new ValidationError("Prompt name is required");
      }
      return mcp.getPrompt(name, args);
    }

    case "ping":
      return {};

    default:
      throw new ValidationError(`Unknown method: ${method}`);
  }
}

// ---------- Error Helpers ----------

function createRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  const error: { code: number; message: string; data?: unknown } = {
    code,
    message,
  };
  if (data !== undefined) {
    error.data = data;
  }
  return {
    jsonrpc: "2.0",
    id: id ?? undefined,
    error,
  };
}

function getErrorInfo(error: unknown): [number, string] {
  if (error instanceof NotFoundError) {
    return [-32001, error.message];
  }
  if (error instanceof ValidationError) {
    return [-32602, error.message];
  }
  if (error instanceof Error) {
    return [-32603, error.message];
  }
  return [-32603, "Internal error"];
}

function getHttpStatus(code: number): number {
  if (code === -32700 || code === -32600) return 400;
  if (code === -32601) return 404;
  if (code === -32602) return 422;
  return 500;
}
