/**
 * Tool - MCP Tool abstraction.
 *
 * Provides the base Tool class and FunctionTool implementation
 * that mirrors Python's tool system with decorator-style registration.
 *
 * In TypeScript, we use Zod schemas for input validation instead of
 * Python's type annotation introspection.
 */

import { z, type ZodType } from "zod";
import type {
  ToolInputSchema,
  ToolResult,
  ContentBlock,
  AuthCheck,
  TaskConfig,
  JsonSchema,
} from "../types";
import { FastMCPComponent } from "../utilities/components";
import type { FastMCPComponentOptions } from "../utilities/components";
import type { Context } from "../server/context";
import { ToolError } from "../exceptions";

// ---------- Tool Options ----------

export interface ToolOptions extends FastMCPComponentOptions {
  inputSchema?: ToolInputSchema;
  outputSchema?: JsonSchema;
  auth?: AuthCheck | AuthCheck[];
  task?: TaskConfig | boolean;
  timeout?: number;
}

// ---------- Function Tool Options ----------

export interface FunctionToolOptions
  extends Omit<ToolOptions, "inputSchema"> {
  /** Zod schema for input validation */
  schema?: ZodType;
  /** The handler function */
  handler: ToolHandler;
}

// ---------- Tool Handler ----------

export type ToolHandler = (
  args: Record<string, unknown>,
  context?: Context
) => unknown | Promise<unknown>;

// ---------- Base Tool Class ----------

export abstract class Tool extends FastMCPComponent {
  readonly inputSchema: ToolInputSchema;
  readonly outputSchema?: JsonSchema;
  readonly auth?: AuthCheck | AuthCheck[];
  readonly task?: TaskConfig;
  readonly timeout?: number;

  constructor(options: ToolOptions) {
    super(options);
    this.inputSchema = options.inputSchema ?? {
      type: "object",
      properties: {},
    };
    this.outputSchema = options.outputSchema;
    this.auth = options.auth;
    this.task =
      typeof options.task === "boolean"
        ? options.task
          ? { mode: "optional" }
          : { mode: "forbidden" }
        : options.task;
    this.timeout = options.timeout;
  }

  /**
   * Execute the tool with the given arguments and context.
   */
  abstract run(
    args: Record<string, unknown>,
    context?: Context
  ): Promise<ToolResult>;
}

// ---------- Function Tool ----------

/**
 * A Tool backed by a plain function handler.
 *
 * This is the TypeScript equivalent of Python's FunctionTool,
 * which wraps a decorated function as an MCP tool.
 */
export class FunctionTool extends Tool {
  private handler: ToolHandler;
  private schema?: ZodType;

  constructor(options: FunctionToolOptions) {
    const inputSchema = options.schema
      ? zodToJsonSchema(options.schema)
      : { type: "object" as const, properties: {} };

    super({
      ...options,
      inputSchema,
    });
    this.handler = options.handler;
    this.schema = options.schema;
  }

  async run(
    args: Record<string, unknown>,
    context?: Context
  ): Promise<ToolResult> {
    // Validate input if schema is provided
    let validatedArgs = args;
    if (this.schema) {
      const parsed = this.schema.safeParse(args);
      if (!parsed.success) {
        throw new ToolError(
          this.name,
          `Input validation failed: ${parsed.error.message}`
        );
      }
      validatedArgs = parsed.data as Record<string, unknown>;
    }

    // Execute with optional timeout
    let result: unknown;
    if (this.timeout) {
      result = await withTimeout(
        this.handler(validatedArgs, context),
        this.timeout,
        this.name
      );
    } else {
      result = await this.handler(validatedArgs, context);
    }

    // Convert result to ToolResult
    return normalizeToolResult(result);
  }
}

// ---------- Helper Functions ----------

/**
 * Convert a Zod schema to JSON Schema for MCP protocol.
 */
function zodToJsonSchema(schema: ZodType): ToolInputSchema {
  // Use Zod's built-in JSON schema generation if available,
  // otherwise build a basic schema
  try {
    const jsonSchema = schema._toJsonSchema?.() ?? { type: "object" };
    return {
      type: "object",
      properties: jsonSchema.properties ?? {},
      required: jsonSchema.required,
    };
  } catch {
    // Fallback: manual extraction for common Zod types
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const zodField = value as ZodType;
        properties[key] = zodFieldToJsonSchema(zodField);
        if (!isOptional(zodField)) {
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
    return { type: "object", properties: {} };
  }
}

function zodFieldToJsonSchema(field: ZodType): JsonSchema {
  if (field instanceof z.ZodString) return { type: "string" };
  if (field instanceof z.ZodNumber) return { type: "number" };
  if (field instanceof z.ZodBoolean) return { type: "boolean" };
  if (field instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodFieldToJsonSchema(field._zod.def.element),
    };
  }
  if (field instanceof z.ZodOptional) {
    return zodFieldToJsonSchema(field._zod.def.innerType);
  }
  if (field instanceof z.ZodDefault) {
    const inner = zodFieldToJsonSchema(field._zod.def.innerType);
    return { ...inner, default: field._zod.def.defaultValue };
  }
  return {};
}

function isOptional(field: ZodType): boolean {
  return (
    field instanceof z.ZodOptional || field instanceof z.ZodDefault
  );
}

/**
 * Normalize a handler return value to a ToolResult.
 */
function normalizeToolResult(result: unknown): ToolResult {
  // Already a ToolResult
  if (
    result !== null &&
    typeof result === "object" &&
    "content" in result &&
    Array.isArray((result as ToolResult).content)
  ) {
    return result as ToolResult;
  }

  // Convert to text content
  const content: ContentBlock[] = [
    {
      type: "text",
      text:
        typeof result === "string"
          ? result
          : JSON.stringify(result, null, 2),
    },
  ];

  return { content };
}

/**
 * Run a promise with a timeout.
 */
async function withTimeout<T>(
  promise: T | Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new ToolError(
              operationName,
              `Timed out after ${timeoutMs}ms`
            )
          ),
        timeoutMs
      )
    ),
  ]);
}

// ---------- Tool Builder (decorator-style API) ----------

export interface ToolDecoratorOptions {
  name?: string;
  description?: string;
  tags?: string[];
  schema?: ZodType;
  outputSchema?: JsonSchema;
  auth?: AuthCheck | AuthCheck[];
  task?: TaskConfig | boolean;
  timeout?: number;
}

/**
 * Create a FunctionTool from a handler function.
 *
 * This is the TypeScript equivalent of @mcp.tool() decorator.
 *
 * @example
 * ```ts
 * const myTool = createTool({
 *   name: "add",
 *   description: "Add two numbers",
 *   schema: z.object({ a: z.number(), b: z.number() }),
 *   handler: ({ a, b }) => a + b,
 * });
 * ```
 */
export function createTool(
  options: ToolDecoratorOptions & { handler: ToolHandler }
): FunctionTool {
  const name = options.name ?? options.handler.name;
  if (!name) {
    throw new ToolError(
      "unknown",
      "Tool must have a name or the handler must be a named function"
    );
  }

  return new FunctionTool({
    name,
    description: options.description,
    tags: options.tags,
    schema: options.schema,
    outputSchema: options.outputSchema,
    auth: options.auth,
    task: options.task,
    timeout: options.timeout,
    handler: options.handler,
  });
}
