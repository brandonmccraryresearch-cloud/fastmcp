/**
 * MCP API Route - Next.js App Router handler.
 *
 * Exposes the FastMCP server via JSON-RPC and REST endpoints.
 *
 * Endpoints:
 *   GET  /api/mcp           - Server info
 *   GET  /api/mcp/tools     - List tools
 *   GET  /api/mcp/resources - List resources
 *   GET  /api/mcp/prompts   - List prompts
 *   POST /api/mcp           - JSON-RPC operations
 */

import { createMCPHandler } from "@/lib/fastmcp/server/nextjs-handler";
import { mcp } from "./server";

const { GET, POST, OPTIONS } = createMCPHandler(mcp);

export { GET, POST, OPTIONS };
