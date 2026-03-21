/**
 * Resource - MCP Resource abstraction.
 *
 * Provides the base Resource class, FunctionResource, and ResourceTemplate
 * implementations mirroring Python's resource system.
 */

import type {
  ResourceContent,
  ResourceResult,
  AuthCheck,
  TaskConfig,
} from "../types";
import { FastMCPComponent } from "../utilities/components";
import type { FastMCPComponentOptions } from "../utilities/components";
import type { Context } from "../server/context";
import { ResourceError } from "../exceptions";

// ---------- Resource Options ----------

export interface ResourceOptions extends FastMCPComponentOptions {
  uri: string;
  mimeType?: string;
  auth?: AuthCheck | AuthCheck[];
  task?: TaskConfig | boolean;
}

// ---------- Function Resource Options ----------

export interface FunctionResourceOptions
  extends Omit<ResourceOptions, "uri"> {
  /** URI or URI template (e.g., "data://users/{id}") */
  uri: string;
  /** The handler function */
  handler: ResourceHandler;
}

// ---------- Resource Handler ----------

export type ResourceHandler = (
  params: Record<string, string>,
  context?: Context
) => unknown | Promise<unknown>;

// ---------- Base Resource Class ----------

export abstract class Resource extends FastMCPComponent {
  readonly uri: string;
  readonly mimeType: string;
  readonly auth?: AuthCheck | AuthCheck[];
  readonly task?: TaskConfig;

  constructor(options: ResourceOptions) {
    super(options);
    this.uri = options.uri;
    this.mimeType = options.mimeType ?? "text/plain";
    this.auth = options.auth;
    this.task =
      typeof options.task === "boolean"
        ? options.task
          ? { mode: "optional" }
          : { mode: "forbidden" }
        : options.task;
  }

  /**
   * Read the resource and return its contents.
   */
  abstract read(
    params: Record<string, string>,
    context?: Context
  ): Promise<ResourceResult>;
}

// ---------- Function Resource ----------

/**
 * A Resource backed by a function handler.
 */
export class FunctionResource extends Resource {
  private handler: ResourceHandler;

  constructor(options: FunctionResourceOptions) {
    super(options);
    this.handler = options.handler;
  }

  async read(
    params: Record<string, string>,
    context?: Context
  ): Promise<ResourceResult> {
    try {
      const result = await this.handler(params, context);
      return normalizeResourceResult(this.uri, result, this.mimeType);
    } catch (error) {
      if (error instanceof ResourceError) throw error;
      throw new ResourceError(
        this.uri,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// ---------- Text Resource ----------

/**
 * A simple text-based resource.
 */
export class TextResource extends Resource {
  private text: string;

  constructor(
    options: Omit<ResourceOptions, "mimeType"> & { text: string }
  ) {
    super({ ...options, mimeType: "text/plain" });
    this.text = options.text;
  }

  async read(): Promise<ResourceResult> {
    return {
      contents: [
        {
          uri: this.uri,
          mimeType: this.mimeType,
          text: this.text,
        },
      ],
    };
  }
}

// ---------- File Resource ----------

/**
 * A file-based resource (for use in Node.js environments).
 */
export class FileResource extends Resource {
  private filePath: string;

  constructor(
    options: ResourceOptions & { filePath: string }
  ) {
    super(options);
    this.filePath = options.filePath;
  }

  async read(): Promise<ResourceResult> {
    // Dynamic import for Node.js fs module
    const fs = await import("fs/promises");
    const content = await fs.readFile(this.filePath);
    const isText = this.mimeType.startsWith("text/");

    return {
      contents: [
        {
          uri: this.uri,
          mimeType: this.mimeType,
          ...(isText
            ? { text: content.toString("utf-8") }
            : { blob: content.toString("base64") }),
        },
      ],
    };
  }
}

// ---------- Resource Template ----------

export interface ResourceTemplateOptions
  extends FastMCPComponentOptions {
  uriTemplate: string;
  mimeType?: string;
  auth?: AuthCheck | AuthCheck[];
  handler: ResourceHandler;
}

/**
 * A parameterized resource template.
 *
 * URI templates use `{param}` syntax for variable parts.
 * Example: "data://users/{userId}/posts/{postId}"
 */
export class ResourceTemplate extends FastMCPComponent {
  readonly uriTemplate: string;
  readonly mimeType: string;
  readonly auth?: AuthCheck | AuthCheck[];
  private handler: ResourceHandler;

  constructor(options: ResourceTemplateOptions) {
    super(options);
    this.uriTemplate = options.uriTemplate;
    this.mimeType = options.mimeType ?? "text/plain";
    this.auth = options.auth;
    this.handler = options.handler;
  }

  /**
   * Check if a URI matches this template.
   */
  matches(uri: string): boolean {
    const regex = this.toRegex();
    return regex.test(uri);
  }

  /**
   * Extract parameters from a URI that matches this template.
   */
  extractParams(uri: string): Record<string, string> | null {
    const regex = this.toRegex();
    const match = uri.match(regex);
    if (!match) return null;

    const paramNames = this.getParamNames();
    const params: Record<string, string> = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });
    return params;
  }

  /**
   * Read the resource with the given parameters.
   */
  async read(
    params: Record<string, string>,
    context?: Context
  ): Promise<ResourceResult> {
    try {
      const result = await this.handler(params, context);
      const resolvedUri = this.resolveUri(params);
      return normalizeResourceResult(
        resolvedUri,
        result,
        this.mimeType
      );
    } catch (error) {
      if (error instanceof ResourceError) throw error;
      throw new ResourceError(
        this.uriTemplate,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private toRegex(): RegExp {
    const escaped = this.uriTemplate.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const pattern = escaped.replace(
      /\\\{(\w+)\\\}/g,
      "([^/]+)"
    );
    return new RegExp(`^${pattern}$`);
  }

  private getParamNames(): string[] {
    const matches = this.uriTemplate.matchAll(/\{(\w+)\}/g);
    return Array.from(matches, (m) => m[1]);
  }

  private resolveUri(params: Record<string, string>): string {
    return this.uriTemplate.replace(
      /\{(\w+)\}/g,
      (_, name) => params[name] ?? `{${name}}`
    );
  }
}

// ---------- Helper Functions ----------

function normalizeResourceResult(
  uri: string,
  result: unknown,
  mimeType: string
): ResourceResult {
  // Already a ResourceResult
  if (
    result !== null &&
    typeof result === "object" &&
    "contents" in result &&
    Array.isArray((result as ResourceResult).contents)
  ) {
    return result as ResourceResult;
  }

  // String content
  if (typeof result === "string") {
    return {
      contents: [{ uri, mimeType, text: result }],
    };
  }

  // Buffer/Uint8Array content
  if (result instanceof Uint8Array) {
    const base64 = Buffer.from(result).toString("base64");
    return {
      contents: [{ uri, mimeType, blob: base64 }],
    };
  }

  // Object content (serialize to JSON)
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

// ---------- Resource Builder ----------

export interface ResourceDecoratorOptions {
  name?: string;
  uri: string;
  description?: string;
  mimeType?: string;
  tags?: string[];
  auth?: AuthCheck | AuthCheck[];
  task?: TaskConfig | boolean;
}

/**
 * Create a FunctionResource from a handler function.
 *
 * TypeScript equivalent of @mcp.resource() decorator.
 *
 * @example
 * ```ts
 * const userResource = createResource({
 *   name: "user",
 *   uri: "data://users/{id}",
 *   description: "Get user data",
 *   handler: ({ id }) => ({ userId: id, name: "Alice" }),
 * });
 * ```
 */
export function createResource(
  options: ResourceDecoratorOptions & { handler: ResourceHandler }
): FunctionResource {
  const name = options.name ?? options.handler.name ?? options.uri;

  return new FunctionResource({
    name,
    uri: options.uri,
    description: options.description,
    mimeType: options.mimeType,
    tags: options.tags,
    auth: options.auth,
    task: options.task,
    handler: options.handler,
  });
}

/**
 * Create a ResourceTemplate from a handler function.
 *
 * @example
 * ```ts
 * const userTemplate = createResourceTemplate({
 *   name: "user_template",
 *   uriTemplate: "data://users/{id}",
 *   description: "Get user by ID",
 *   handler: ({ id }) => ({ userId: id }),
 * });
 * ```
 */
export function createResourceTemplate(
  options: Omit<ResourceTemplateOptions, "name"> & { name?: string }
): ResourceTemplate {
  const name =
    options.name ?? options.handler.name ?? options.uriTemplate;

  return new ResourceTemplate({
    ...options,
    name,
  });
}
