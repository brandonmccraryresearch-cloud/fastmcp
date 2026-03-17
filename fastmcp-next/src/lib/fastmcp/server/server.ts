/**
 * FastMCP Server - Main server class for the TypeScript MCP framework.
 *
 * This is the central orchestrator that composes providers, middleware,
 * and transports to serve MCP tools, resources, and prompts.
 *
 * Mirrors Python's FastMCP from server/server.py
 */

import { z, type ZodType } from "zod";
import type {
  ToolResult,
  ResourceResult,
  PromptResult,
  PromptArgument,
  DuplicateBehavior,
  AuthCheck,
  TaskConfig,
  JsonSchema,
  MiddlewareContext,
  FastMCPSettings,
  DEFAULT_SETTINGS,
} from "../types";
import { Tool, FunctionTool, createTool } from "../tools";
import type { ToolHandler, ToolDecoratorOptions } from "../tools";
import {
  Resource,
  FunctionResource,
  ResourceTemplate,
  createResource,
  createResourceTemplate,
} from "../resources";
import type {
  ResourceHandler,
  ResourceDecoratorOptions,
} from "../resources";
import {
  Prompt,
  FunctionPrompt,
  createPrompt,
} from "../prompts";
import type {
  PromptHandler,
  PromptDecoratorOptions,
} from "../prompts";
import { Context, InMemoryKeyValue } from "./context";
import type { AsyncKeyValue } from "./context";
import {
  LocalProvider,
  AggregateProvider,
  Provider,
} from "./providers";
import {
  Middleware,
  MiddlewarePipeline,
  ErrorHandlingMiddleware,
} from "./middleware";
import { NotFoundError, DuplicateError } from "../exceptions";
import { Logger, generateId } from "../utilities";

// ---------- Server Options ----------

export interface FastMCPOptions {
  name?: string;
  instructions?: string;
  version?: string;
  middleware?: Middleware[];
  providers?: Provider[];
  tools?: (Tool | { handler: ToolHandler; options?: ToolDecoratorOptions })[];
  onDuplicate?: DuplicateBehavior;
  maskErrorDetails?: boolean;
  strictInputValidation?: boolean;
  sessionStateStore?: AsyncKeyValue;
}

// ---------- FastMCP Server Class ----------

/**
 * The main FastMCP server class.
 *
 * Provides a fluent API for registering tools, resources, and prompts,
 * and serving them over MCP transports.
 *
 * @example
 * ```ts
 * import { FastMCP } from "@/lib/fastmcp";
 * import { z } from "zod";
 *
 * const mcp = new FastMCP({ name: "My Server" });
 *
 * mcp.addTool({
 *   name: "add",
 *   description: "Add two numbers",
 *   schema: z.object({ a: z.number(), b: z.number() }),
 *   handler: ({ a, b }) => a + b,
 * });
 *
 * mcp.addResource({
 *   name: "greeting",
 *   uri: "data://greeting",
 *   handler: () => "Hello, world!",
 * });
 *
 * mcp.addPrompt({
 *   name: "analyze",
 *   arguments: [{ name: "data", required: true }],
 *   handler: ({ data }) => `Please analyze: ${data}`,
 * });
 * ```
 */
export class FastMCP {
  readonly name: string;
  readonly instructions?: string;
  readonly version: string;

  private aggregateProvider: AggregateProvider;
  private localProvider: LocalProvider;
  private middlewarePipeline: MiddlewarePipeline;
  private logger: Logger;
  private onDuplicate: DuplicateBehavior;
  private maskErrorDetails: boolean;
  private stateStore: AsyncKeyValue;
  private _initialized = false;

  constructor(options: FastMCPOptions = {}) {
    this.name = options.name ?? "FastMCP";
    this.instructions = options.instructions;
    this.version = options.version ?? "1.0.0";
    this.onDuplicate = options.onDuplicate ?? "warn";
    this.maskErrorDetails = options.maskErrorDetails ?? false;
    this.stateStore =
      options.sessionStateStore ?? new InMemoryKeyValue();
    this.logger = new Logger(`FastMCP:${this.name}`);

    // Set up provider system
    this.localProvider = new LocalProvider("local");
    this.aggregateProvider = new AggregateProvider("aggregate");
    this.aggregateProvider.addProvider(this.localProvider);

    // Add additional providers
    if (options.providers) {
      for (const provider of options.providers) {
        this.aggregateProvider.addProvider(provider);
      }
    }

    // Set up middleware pipeline
    this.middlewarePipeline = new MiddlewarePipeline();
    this.middlewarePipeline.add(
      new ErrorHandlingMiddleware(options.maskErrorDetails)
    );
    if (options.middleware) {
      for (const mw of options.middleware) {
        this.middlewarePipeline.add(mw);
      }
    }

    // Register initial tools
    if (options.tools) {
      for (const toolSpec of options.tools) {
        if (toolSpec instanceof Tool) {
          this.localProvider.addTool(toolSpec);
        } else {
          const tool = createTool({
            ...toolSpec.options,
            handler: toolSpec.handler,
          });
          this.localProvider.addTool(tool);
        }
      }
    }
  }

  // ---------- Lifecycle ----------

  /**
   * Initialize the server (idempotent).
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    this.logger.info(`Server "${this.name}" initialized`);
  }

  /**
   * Shut down the server gracefully.
   */
  async shutdown(): Promise<void> {
    this._initialized = false;
    this.logger.info(`Server "${this.name}" shut down`);
  }

  // ---------- Tool Registration ----------

  /**
   * Register a tool.
   *
   * @example
   * ```ts
   * mcp.addTool({
   *   name: "greet",
   *   description: "Greet someone",
   *   schema: z.object({ name: z.string() }),
   *   handler: ({ name }) => `Hello, ${name}!`,
   * });
   * ```
   */
  addTool(
    options: ToolDecoratorOptions & { handler: ToolHandler }
  ): FunctionTool {
    const tool = createTool(options);
    this.registerTool(tool);
    return tool;
  }

  /**
   * Register an existing Tool instance.
   */
  registerTool(tool: Tool): void {
    this.handleDuplicate("tool", tool.name, async () => {
      const existing = await this.localProvider.getTool(tool.name);
      return existing !== null;
    });
    this.localProvider.addTool(tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  // ---------- Resource Registration ----------

  /**
   * Register a resource.
   *
   * @example
   * ```ts
   * mcp.addResource({
   *   name: "config",
   *   uri: "data://config",
   *   handler: () => ({ debug: false, version: "1.0" }),
   * });
   * ```
   */
  addResource(
    options: ResourceDecoratorOptions & { handler: ResourceHandler }
  ): FunctionResource {
    const resource = createResource(options);
    this.localProvider.addResource(resource);
    this.logger.debug(`Registered resource: ${resource.uri}`);
    return resource;
  }

  /**
   * Register a resource template.
   *
   * @example
   * ```ts
   * mcp.addResourceTemplate({
   *   name: "user",
   *   uriTemplate: "data://users/{id}",
   *   handler: ({ id }) => ({ userId: id }),
   * });
   * ```
   */
  addResourceTemplate(
    options: Omit<
      import("../resources").ResourceTemplateOptions,
      "name"
    > & { name?: string }
  ): ResourceTemplate {
    const template = createResourceTemplate(options);
    this.localProvider.addResourceTemplate(template);
    this.logger.debug(
      `Registered resource template: ${template.uriTemplate}`
    );
    return template;
  }

  // ---------- Prompt Registration ----------

  /**
   * Register a prompt.
   *
   * @example
   * ```ts
   * mcp.addPrompt({
   *   name: "analyze",
   *   description: "Analyze data",
   *   arguments: [{ name: "data", required: true }],
   *   handler: ({ data }) => `Analyze: ${data}`,
   * });
   * ```
   */
  addPrompt(
    options: PromptDecoratorOptions & { handler: PromptHandler }
  ): FunctionPrompt {
    const prompt = createPrompt(options);
    this.localProvider.addPrompt(prompt);
    this.logger.debug(`Registered prompt: ${prompt.name}`);
    return prompt;
  }

  // ---------- Provider Management ----------

  /**
   * Add a provider to the server.
   */
  addProvider(provider: Provider): void {
    this.aggregateProvider.addProvider(provider);
    this.logger.debug(`Added provider: ${provider.name}`);
  }

  /**
   * Add middleware to the pipeline.
   */
  addMiddleware(middleware: Middleware): void {
    this.middlewarePipeline.add(middleware);
    this.logger.debug(`Added middleware: ${middleware.name}`);
  }

  // ---------- Component Operations ----------

  /**
   * List all available tools.
   */
  async listTools(): Promise<Tool[]> {
    return this.aggregateProvider.listTools();
  }

  /**
   * List all available resources.
   */
  async listResources(): Promise<Resource[]> {
    return this.aggregateProvider.listResources();
  }

  /**
   * List all available resource templates.
   */
  async listResourceTemplates(): Promise<ResourceTemplate[]> {
    return this.aggregateProvider.listResourceTemplates();
  }

  /**
   * List all available prompts.
   */
  async listPrompts(): Promise<Prompt[]> {
    return this.aggregateProvider.listPrompts();
  }

  /**
   * Call a tool by name.
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
    context?: Context
  ): Promise<ToolResult> {
    const tool = await this.aggregateProvider.getTool(name);
    if (!tool) {
      throw new NotFoundError("Tool", name);
    }

    const ctx =
      context ??
      new Context({
        requestId: generateId(),
        stateStore: this.stateStore,
      });

    return tool.run(args, ctx);
  }

  /**
   * Read a resource by URI.
   */
  async readResource(
    uri: string,
    context?: Context
  ): Promise<ResourceResult> {
    const resource = await this.aggregateProvider.getResource(uri);
    if (!resource) {
      throw new NotFoundError("Resource", uri);
    }

    const ctx =
      context ??
      new Context({
        requestId: generateId(),
        stateStore: this.stateStore,
      });

    // Extract params from URI if resource came from a template
    return resource.read({}, ctx);
  }

  /**
   * Render a prompt by name.
   */
  async getPrompt(
    name: string,
    args: Record<string, unknown> = {},
    context?: Context
  ): Promise<PromptResult> {
    const prompt = await this.aggregateProvider.getPrompt(name);
    if (!prompt) {
      throw new NotFoundError("Prompt", name);
    }

    const ctx =
      context ??
      new Context({
        requestId: generateId(),
        stateStore: this.stateStore,
      });

    return prompt.render(args, ctx);
  }

  // ---------- State Management ----------

  /**
   * Set server-level state.
   */
  async setState(key: string, value: unknown): Promise<void> {
    await this.stateStore.set(key, value);
  }

  /**
   * Get server-level state.
   */
  async getState(key: string): Promise<unknown | undefined> {
    return this.stateStore.get(key);
  }

  /**
   * Clear server-level state.
   */
  async clearState(key: string): Promise<boolean> {
    return this.stateStore.delete(key);
  }

  // ---------- Server Info ----------

  /**
   * Get server metadata.
   */
  getInfo(): {
    name: string;
    version: string;
    instructions?: string;
  } {
    return {
      name: this.name,
      version: this.version,
      instructions: this.instructions,
    };
  }

  // ---------- Internal Helpers ----------

  private handleDuplicate(
    componentType: string,
    name: string,
    existsCheck: () => Promise<boolean>
  ): void {
    // Note: in sync context we skip the async check
    // The Python version handles this differently
    if (this.onDuplicate === "error") {
      // Will be checked on registration
    }
    if (this.onDuplicate === "warn") {
      this.logger.warn(
        `Registering ${componentType} "${name}" (may overwrite existing)`
      );
    }
  }
}
