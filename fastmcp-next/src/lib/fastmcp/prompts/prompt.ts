/**
 * Prompt - MCP Prompt abstraction.
 *
 * Provides the base Prompt class and FunctionPrompt implementation
 * mirroring Python's prompt system.
 */

import type {
  PromptResult,
  PromptMessage,
  PromptArgument,
  ContentBlock,
  AuthCheck,
  Role,
} from "../types";
import { FastMCPComponent } from "../utilities/components";
import type { FastMCPComponentOptions } from "../utilities/components";
import type { Context } from "../server/context";
import { PromptError } from "../exceptions";

// ---------- Prompt Options ----------

export interface PromptOptions extends FastMCPComponentOptions {
  arguments?: PromptArgument[];
  auth?: AuthCheck | AuthCheck[];
}

// ---------- Function Prompt Options ----------

export interface FunctionPromptOptions extends PromptOptions {
  handler: PromptHandler;
}

// ---------- Prompt Handler ----------

export type PromptHandler = (
  args: Record<string, unknown>,
  context?: Context
) => PromptResult | PromptMessage[] | string | Promise<PromptResult | PromptMessage[] | string>;

// ---------- Base Prompt Class ----------

export abstract class Prompt extends FastMCPComponent {
  readonly arguments: PromptArgument[];
  readonly auth?: AuthCheck | AuthCheck[];

  constructor(options: PromptOptions) {
    super(options);
    this.arguments = options.arguments ?? [];
    this.auth = options.auth;
  }

  /**
   * Render the prompt with the given arguments and context.
   */
  abstract render(
    args: Record<string, unknown>,
    context?: Context
  ): Promise<PromptResult>;
}

// ---------- Function Prompt ----------

/**
 * A Prompt backed by a function handler.
 */
export class FunctionPrompt extends Prompt {
  private handler: PromptHandler;

  constructor(options: FunctionPromptOptions) {
    super(options);
    this.handler = options.handler;
  }

  async render(
    args: Record<string, unknown>,
    context?: Context
  ): Promise<PromptResult> {
    // Validate required arguments
    for (const arg of this.arguments) {
      if (arg.required !== false && !(arg.name in args)) {
        throw new PromptError(
          this.name,
          `Missing required argument: ${arg.name}`
        );
      }
    }

    try {
      const result = await this.handler(args, context);
      return normalizePromptResult(result);
    } catch (error) {
      if (error instanceof PromptError) throw error;
      throw new PromptError(
        this.name,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// ---------- Helper Functions ----------

/**
 * Create a message helper.
 */
export function message(
  text: string,
  role: Role = "user"
): PromptMessage {
  return {
    role,
    content: [{ type: "text", text }],
  };
}

/**
 * Create a user message.
 */
export function userMessage(text: string): PromptMessage {
  return message(text, "user");
}

/**
 * Create an assistant message.
 */
export function assistantMessage(text: string): PromptMessage {
  return message(text, "assistant");
}

/**
 * Normalize handler result to PromptResult.
 */
function normalizePromptResult(
  result: PromptResult | PromptMessage[] | string
): PromptResult {
  // Already a PromptResult
  if (
    typeof result === "object" &&
    !Array.isArray(result) &&
    "messages" in result
  ) {
    return result;
  }

  // Array of messages
  if (Array.isArray(result)) {
    return { messages: result };
  }

  // String - convert to single user message
  return {
    messages: [userMessage(result)],
  };
}

// ---------- Prompt Builder ----------

export interface PromptDecoratorOptions {
  name?: string;
  description?: string;
  arguments?: PromptArgument[];
  tags?: string[];
  auth?: AuthCheck | AuthCheck[];
}

/**
 * Create a FunctionPrompt from a handler function.
 *
 * TypeScript equivalent of @mcp.prompt() decorator.
 *
 * @example
 * ```ts
 * const analyzePrompt = createPrompt({
 *   name: "analyze",
 *   description: "Analyze data",
 *   arguments: [{ name: "data", required: true }],
 *   handler: ({ data }) => `Please analyze: ${data}`,
 * });
 * ```
 */
export function createPrompt(
  options: PromptDecoratorOptions & { handler: PromptHandler }
): FunctionPrompt {
  const name = options.name ?? options.handler.name;
  if (!name) {
    throw new PromptError(
      "unknown",
      "Prompt must have a name or the handler must be a named function"
    );
  }

  return new FunctionPrompt({
    name,
    description: options.description,
    arguments: options.arguments,
    tags: options.tags,
    auth: options.auth,
    handler: options.handler,
  });
}
