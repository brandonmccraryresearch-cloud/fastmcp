# FastMCP TypeScript/Next.js Port — Copilot Instructions

> **For AI agents continuing the TypeScript port of FastMCP**

## Overview

This document provides instructions for AI agents (GitHub Copilot, Claude, etc.) continuing the port of the **Python FastMCP framework** to **TypeScript/Next.js**. The original Python codebase is in the repository root (`src/fastmcp/`), and the TypeScript port lives in `fastmcp-next/`.

## Current State (Session 2 Complete)

### What Has Been Ported

The foundational architecture is in place with **122 passing tests** and a **successful Next.js build**:

| Module | Status | Location | Tests |
|--------|--------|----------|-------|
| Core Types & Interfaces | ✅ Done | `src/lib/fastmcp/types/index.ts` | — |
| Exceptions/Errors | ✅ Done | `src/lib/fastmcp/exceptions.ts` | — |
| FastMCPComponent Base | ✅ Done | `src/lib/fastmcp/utilities/components.ts` | 3 tests |
| Utilities (Logger, ID gen, etc.) | ✅ Done | `src/lib/fastmcp/utilities/index.ts` | 6 tests |
| Tool System | ✅ Done | `src/lib/fastmcp/tools/tool.ts` | 10 tests |
| Resource System | ✅ Done | `src/lib/fastmcp/resources/resource.ts` | 10 tests |
| Prompt System | ✅ Done | `src/lib/fastmcp/prompts/prompt.ts` | 10 tests |
| Provider System (Local + Aggregate) | ✅ Done | `src/lib/fastmcp/server/providers/index.ts` | via server tests |
| Middleware Pipeline | ✅ Done | `src/lib/fastmcp/server/middleware/index.ts` | 8 tests |
| Auth System | ✅ Done | `src/lib/fastmcp/server/auth/index.ts` | 11 tests |
| JWT Auth Provider | ✅ Done | `src/lib/fastmcp/server/auth/jwt.ts` | 12 tests |
| Context & State | ✅ Done | `src/lib/fastmcp/server/context/index.ts` | via server tests |
| FastMCP Server | ✅ Done | `src/lib/fastmcp/server/server.ts` | 15 tests |
| Transform System | ✅ Done | `src/lib/fastmcp/server/transforms/` | 24 tests |
| Client SDK | ✅ Done | `src/lib/fastmcp/client/client.ts` | via transport tests |
| Client Transports (HTTP + InMemory) | ✅ Done | `src/lib/fastmcp/client/transports/` | 13 tests |
| Next.js API Handler | ✅ Done | `src/lib/fastmcp/server/nextjs-handler.ts` | — |
| Example MCP Server | ✅ Done | `src/app/api/mcp/server.ts` | — |
| Demo Landing Page | ✅ Done | `src/app/page.tsx` | — |
| Barrel Exports | ✅ Done | `src/lib/fastmcp/index.ts` | — |

### What Remains to Be Ported

Listed in approximate priority order:

#### High Priority

1. **SSE Transport** — Server-Sent Events for streaming
   - Implement SSE endpoint for browser-compatible streaming
   - Python source: `src/fastmcp/server/low_level.py`

2. **OpenAPI Provider** — Port `server/providers/openapi.py`
   - Auto-generates tools from OpenAPI/Swagger specs
   - Python source: `src/fastmcp/utilities/openapi/`

3. **PromptsAsTools / ResourcesAsTools** — Synthetic tool generation transforms
   - Expose prompts and resources as tools for tool-only clients
   - Python source: `src/fastmcp/server/transforms/prompts_as_tools.py`, `resources_as_tools.py`

4. **Search Transforms** — Tool discovery via search (regex, BM25)
   - Python source: `src/fastmcp/server/transforms/search/`

#### Medium Priority

5. **Task System** — Background task support
   - Python source: `src/fastmcp/server/tasks/`
   - TaskConfig modes: optional, required, forbidden
   - For TypeScript, consider using a job queue library

6. **ProxyProvider** — Proxy to remote MCP servers
   - Python source: `src/fastmcp/server/providers/proxy.py`

7. **FastMCPApp** — Composable applications with global tool registry
   - Python source: `src/fastmcp/server/app.py`

8. **CLI Commands** — Port `cli/` module
   - Python source: `src/fastmcp/cli/`
   - Consider using `commander` or `yargs` for TypeScript CLI

#### Lower Priority

9. **Additional Auth Providers** — OAuth2 flows, social providers
   - Python source: `src/fastmcp/server/auth/providers/`
   - 16+ provider implementations in Python (GitHub, Google, Auth0, etc.)

10. **Sampling Handlers** — LLM sampling support
    - Python source: `src/fastmcp/client/sampling/`

11. **Rich Media Types** — Audio, Image, File utilities
    - Python source: `src/fastmcp/utilities/types.py`

12. **Contrib Modules** — Community utilities
    - Python source: `src/fastmcp/contrib/`

## Development Workflow

### Commands

```bash
cd fastmcp-next

# Install dependencies
npm install

# Run tests (122 tests currently passing)
npm test

# Watch mode for tests
npm run test:watch

# Build Next.js application
npm run build

# Run development server
npm run dev

# Lint
npm run lint
```

### Architecture Mapping (Python → TypeScript)

| Python Concept | TypeScript Equivalent |
|---|---|
| `@mcp.tool()` decorator | `mcp.addTool({ handler })` builder |
| `@mcp.resource()` decorator | `mcp.addResource({ handler })` builder |
| `@mcp.prompt()` decorator | `mcp.addPrompt({ handler })` builder |
| Pydantic models | Zod schemas |
| `async with client:` | `await client.connect()` / `await client.disconnect()` |
| `ContextVar` | Direct parameter passing (Context injection) |
| `typing.Protocol` | TypeScript `interface` |
| `abc.ABC` | `abstract class` |
| `dataclass` | TypeScript `interface` or `class` |
| `asyncio` | Native `Promise`/`async`/`await` |

### Key Design Decisions

1. **Zod v4** is used for schema validation (not v3). The `toJSONSchema()` function converts Zod schemas to JSON Schema for MCP protocol compatibility.

2. **No decorators** — TypeScript decorators have limited adoption. We use builder methods (`addTool`, `addResource`, `addPrompt`) instead.

3. **Next.js App Router** — The API route at `/api/mcp/route.ts` uses App Router conventions. The `createMCPHandler()` function creates `GET`, `POST`, `OPTIONS` handlers.

4. **Vitest** for testing — Configured in `vitest.config.ts` with `@` path alias support.

5. **Tool results** — When a handler returns a string, it's passed through directly. When it returns an object, it's JSON-serialized. This differs slightly from Python where everything goes through `normalizeToolResult`.

### File Structure

```
fastmcp-next/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── api/mcp/
│   │   │   ├── route.ts               # MCP API endpoint
│   │   │   └── server.ts              # Example MCP server config
│   │   ├── page.tsx                   # Landing page
│   │   ├── layout.tsx                 # Root layout
│   │   └── globals.css                # Global styles
│   └── lib/fastmcp/                   # Core library
│       ├── index.ts                   # Barrel exports
│       ├── exceptions.ts             # Error hierarchy
│       ├── types/index.ts            # Core type definitions
│       ├── utilities/
│       │   ├── index.ts              # Logger, ID generation, etc.
│       │   └── components.ts         # FastMCPComponent base
│       ├── tools/
│       │   ├── index.ts              # Barrel
│       │   └── tool.ts               # Tool, FunctionTool, createTool
│       ├── resources/
│       │   ├── index.ts              # Barrel
│       │   └── resource.ts           # Resource, Template, etc.
│       ├── prompts/
│       │   ├── index.ts              # Barrel
│       │   └── prompt.ts             # Prompt, FunctionPrompt, etc.
│       ├── server/
│       │   ├── index.ts              # Server barrel exports
│       │   ├── server.ts             # FastMCP main class
│       │   ├── nextjs-handler.ts     # Next.js API route handler
│       │   ├── context/index.ts      # Per-request Context
│       │   ├── providers/index.ts    # Provider, LocalProvider, AggregateProvider
│       │   ├── middleware/index.ts   # Middleware pipeline
│       │   ├── auth/
│       │   │   ├── index.ts          # Auth checks, InMemoryAuthProvider
│       │   │   └── jwt.ts            # JWTAuthProvider, StaticTokenProvider
│       │   └── transforms/
│       │       ├── index.ts          # TransformPipeline, re-exports
│       │       ├── base.ts           # Transform abstract base class
│       │       ├── namespace.ts      # Namespace prefix transform
│       │       ├── visibility.ts     # Visibility marking transform
│       │       ├── version-filter.ts # Version range filter transform
│       │       ├── tool-transform.ts # Tool schema modification transform
│       │       └── utils.ts          # cloneComponent helper
│       └── client/
│           ├── index.ts              # Client barrel
│           ├── client.ts             # Client class
│           └── transports/
│               ├── index.ts          # Transport barrel
│               ├── http.ts           # HTTP/JSON-RPC transport
│               └── memory.ts         # In-memory transport (same-process)
├── __tests__/                         # Vitest test files
│   ├── tools/tool.test.ts
│   ├── resources/resource.test.ts
│   ├── prompts/prompt.test.ts
│   ├── client/transport.test.ts
│   ├── server/
│   │   ├── server.test.ts
│   │   ├── middleware.test.ts
│   │   ├── auth.test.ts
│   │   ├── auth-jwt.test.ts
│   │   └── transforms/transforms.test.ts
│   └── utilities/utilities.test.ts
├── vitest.config.ts                   # Test configuration
├── package.json                       # Dependencies & scripts
└── tsconfig.json                      # TypeScript configuration
```

## How to Continue Development

### General Approach

1. **Read the Python source** for the module you're porting (in `src/fastmcp/`)
2. **Create the TypeScript equivalent** in the corresponding location under `fastmcp-next/src/lib/fastmcp/`
3. **Write tests** in `fastmcp-next/__tests__/` matching the test structure
4. **Export from barrel** files (`index.ts`) at each level
5. **Run tests** with `npm test` to verify
6. **Build** with `npm run build` to verify TypeScript compilation

### Tips for Porting

- The Python code uses `Pydantic` models extensively. Use `Zod` schemas in TypeScript.
- Python's `async with` context managers → use `connect()`/`disconnect()` patterns or `using` (TC39 proposal).
- Python's `ContextVar` for request context → pass `Context` explicitly or use AsyncLocalStorage in Node.js.
- Python's `@dataclass` → TypeScript interfaces or plain classes.
- When porting providers, follow the `Provider` abstract class interface already defined.
- When porting middleware, follow the `Middleware` abstract class and `MiddlewarePipeline` already defined.
- The `@modelcontextprotocol/sdk` npm package provides MCP protocol types. Use it for protocol-level types.

### Adding a New Provider

```typescript
// src/lib/fastmcp/server/providers/my-provider.ts
import { Provider } from "./index";
import type { Tool } from "../../tools";

export class MyProvider extends Provider {
  constructor() {
    super("my-provider");
  }

  async listTools(): Promise<Tool[]> {
    // Return tools from your source
    return [];
  }

  // ... implement other abstract methods
}
```

### Adding a New Middleware

```typescript
// src/lib/fastmcp/server/middleware/my-middleware.ts
import { Middleware } from "./index";
import type { MiddlewareContext, CallNext } from "../../types";

export class MyMiddleware extends Middleware {
  constructor() {
    super("MyMiddleware");
  }

  async handle<T, R>(
    context: MiddlewareContext<T>,
    callNext: CallNext<T, R>
  ): Promise<R> {
    // Pre-processing
    const result = await callNext(context);
    // Post-processing
    return result;
  }
}
```

### Adding a Client Transport

```typescript
// src/lib/fastmcp/client/transports/http.ts
import type { ClientTransport } from "../client";

export class HttpTransport implements ClientTransport {
  readonly name = "http";
  private baseUrl: string;
  private connected = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }
}
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.x | React framework with App Router |
| `react` / `react-dom` | 19.x | UI rendering |
| `zod` | 4.x | Schema validation (replaces Pydantic) |
| `uuid` | 13.x | ID generation |
| `@modelcontextprotocol/sdk` | 1.x | MCP protocol types & client/server SDK |
| `typescript` | 5.x | Language |
| `vitest` | 4.x | Testing framework |
| `tailwindcss` | 4.x | Styling |

## Important Notes

- **Do NOT modify** the Python source code (`src/fastmcp/`, `tests/`). Only work in `fastmcp-next/`.
- **Zod v4** is used, not v3. The API differs significantly (e.g., `toJSONSchema()` instead of zodToJsonSchema).
- The Next.js API handler at `/api/mcp` supports both REST-style GET endpoints and JSON-RPC POST.
- Tests use `@` path aliases configured in `vitest.config.ts`.
- The landing page at `src/app/page.tsx` shows the port status — update it as you complete modules.
