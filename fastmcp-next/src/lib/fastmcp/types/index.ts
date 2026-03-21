/**
 * Core types for FastMCP TypeScript port.
 *
 * These types mirror the Python FastMCP codebase's type system,
 * providing a type-safe foundation for the MCP framework.
 */

// ---------- Content Types ----------

export type Role = "user" | "assistant";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface AudioContent {
  type: "audio";
  data: string;
  mimeType: string;
}

export interface FileContent {
  type: "file";
  data: string;
  mimeType: string;
  name?: string;
}

export interface EmbeddedResource {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | FileContent
  | EmbeddedResource;

// ---------- Icon ----------

export interface Icon {
  url: string;
  mediaType?: string;
}

// ---------- Component Metadata ----------

export interface ComponentMeta {
  name: string;
  version?: string;
  title?: string;
  description?: string;
  icons?: Icon[];
  tags?: Set<string>;
  meta?: Record<string, unknown>;
}

// ---------- Tool Types ----------

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolResult {
  content: ContentBlock[];
  structuredContent?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  isError?: boolean;
}

// ---------- Resource Types ----------

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface ResourceResult {
  contents: ResourceContent[];
}

// ---------- Prompt Types ----------

export interface PromptMessage {
  role: Role;
  content: ContentBlock[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface PromptResult {
  messages: PromptMessage[];
  description?: string;
}

// ---------- JSON Schema ----------

export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  nullable?: boolean;
}

// ---------- Duplicate Behavior ----------

export type DuplicateBehavior = "warn" | "error" | "replace" | "ignore";

// ---------- Transport Types ----------

export type TransportType = "stdio" | "http" | "sse";

// ---------- Task Types ----------

export type TaskMode = "optional" | "required" | "forbidden";

export interface TaskConfig {
  mode: TaskMode;
  pollIntervalMs?: number;
}

// ---------- Auth Types ----------

export interface AccessToken {
  token: string;
  scopes?: string[];
  claims?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface AuthContext {
  token: AccessToken | null;
  component: ComponentMeta;
}

export type AuthCheck = (
  context: AuthContext
) => boolean | Promise<boolean>;

// ---------- Middleware Types ----------

export type MessageSource = "client" | "server";
export type MessageType = "request" | "notification";

export interface MiddlewareContext<T = unknown> {
  message: T;
  source: MessageSource;
  type: MessageType;
  method?: string;
  timestamp: Date;
}

export type CallNext<T, R> = (context: MiddlewareContext<T>) => Promise<R>;

// ---------- Version Types ----------

export type VersionSpec = string;

// ---------- Settings ----------

export interface FastMCPSettings {
  logEnabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  maskErrorDetails: boolean;
  strictInputValidation: boolean;
  deprecationWarnings: boolean;
  onDuplicate: DuplicateBehavior;
}

export const DEFAULT_SETTINGS: FastMCPSettings = {
  logEnabled: true,
  logLevel: "info",
  maskErrorDetails: false,
  strictInputValidation: false,
  deprecationWarnings: true,
  onDuplicate: "warn",
};
