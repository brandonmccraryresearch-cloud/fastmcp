/**
 * Tool - MCP Tool abstraction.
 *
 * Provides the base Tool class and FunctionTool implementation
 * that mirrors Python's tool system with decorator-style registration.
 *
 * In TypeScript, we use Zod schemas for input validation instead of
 * Python's type annotation introspection.
 */

import { z, type ZodType, toJSONSchema } from "zod";
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
  try {
    const jsonSchema = toJSONSchema(schema) as Record<string, unknown>;
    return {
      type: "object",
      properties: (jsonSchema.properties ?? {}) as Record<string, JsonSchema>,
      required: jsonSchema.required as string[] | undefined,
    };
  } catch {
    // Fallback: manual extraction for common Zod types
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape as Record<string, ZodType>;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodFieldToJsonSchema(value);
        if (!isOptional(value)) {
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
  // Use Zod's public toJSONSchema for individual fields too
  try {
    const schema = toJSONSchema(field) as Record<string, unknown>;
    return schema as JsonSchema;
  } catch {
    // Fallback to basic type mapping
    return {};
  }
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
