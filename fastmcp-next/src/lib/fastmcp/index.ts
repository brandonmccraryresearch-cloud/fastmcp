/**
 * FastMCP - TypeScript/Next.js port of the FastMCP framework.
 *
 * A comprehensive framework for building Model Context Protocol (MCP)
 * servers and clients with TypeScript.
 *
 * @example
 * ```ts
 * import { FastMCP, createTool, createResource, createPrompt } from "@/lib/fastmcp";
 * import { z } from "zod";
 *
 * const mcp = new FastMCP({ name: "My Server" });
 *
 * mcp.addTool({
 *   name: "add",
 *   description: "Add two numbers",
 *   schema: z.object({ a: z.number(), b: z.number() }),
 *   handler: ({ a, b }) => ({ sum: a + b }),
 * });
 * ```
 */

// Core server
export { FastMCP } from "./server/server";
export type { FastMCPOptions } from "./server/server";

// Client
export { Client } from "./client";
export type { ClientOptions, ClientTransport } from "./client";

// Tools
export { Tool, FunctionTool, createTool } from "./tools";
export type {
  ToolOptions,
  FunctionToolOptions,
  ToolHandler,
  ToolDecoratorOptions,
} from "./tools";

// Resources
export {
  Resource,
  FunctionResource,
  TextResource,
  FileResource,
  ResourceTemplate,
  createResource,
  createResourceTemplate,
} from "./resources";
export type {
  ResourceOptions,
  FunctionResourceOptions,
  ResourceHandler,
  ResourceDecoratorOptions,
  ResourceTemplateOptions,
} from "./resources";

// Prompts
export {
  Prompt,
  FunctionPrompt,
  createPrompt,
  message,
  userMessage,
  assistantMessage,
} from "./prompts";
export type {
  PromptOptions,
  FunctionPromptOptions,
  PromptHandler,
  PromptDecoratorOptions,
} from "./prompts";

// Context
export { Context, InMemoryKeyValue } from "./server/context";
export type { AsyncKeyValue, StateValue, LogCallback } from "./server/context";

// Providers
export {
  Provider,
  LocalProvider,
  AggregateProvider,
} from "./server/providers";

// Middleware
export {
  Middleware,
  FunctionMiddleware,
  LoggingMiddleware,
  ErrorHandlingMiddleware,
  RateLimitingMiddleware,
  TimingMiddleware,
  MiddlewarePipeline,
  createMiddleware,
} from "./server/middleware";

// Auth
export {
  requireToken,
  requireAuthenticated,
  requireScopes,
  requireClaim,
  runAuthChecks,
  InMemoryAuthProvider,
} from "./server/auth";
export type { AuthProvider } from "./server/auth";

// Exceptions
export {
  FastMCPError,
  NotFoundError,
  DuplicateError,
  ValidationError,
  AuthorizationError,
  AuthenticationError,
  ToolError,
  ResourceError,
  PromptError,
  TransportError,
  MiddlewareError,
} from "./exceptions";

// Types
export type {
  Role,
  TextContent,
  ImageContent,
  AudioContent,
  FileContent,
  EmbeddedResource,
  ContentBlock,
  Icon,
  ComponentMeta,
  ToolInputSchema,
  ToolResult,
  ResourceContent,
  ResourceResult,
  PromptMessage,
  PromptArgument,
  PromptResult,
  JsonSchema,
  DuplicateBehavior,
  TransportType,
  TaskMode,
  TaskConfig,
  AccessToken,
  AuthContext,
  AuthCheck,
  MessageSource,
  MessageType,
  MiddlewareContext,
  CallNext,
  VersionSpec,
  FastMCPSettings,
} from "./types";

// Utilities
export { FastMCPComponent } from "./utilities/components";
export { Logger, generateId, shortHash, deepClone, createObjectSchema } from "./utilities";
