/**
 * Provider - Multi-source component resolution system.
 *
 * Providers contribute Tools, Resources, and Prompts to the server.
 * The system uses first-match semantics with provider ordering.
 *
 * Mirrors Python's Provider from server/providers/
 */

import type { Tool } from "../../tools";
import type { Resource, ResourceTemplate } from "../../resources";
import type { Prompt } from "../../prompts";
import type { VersionSpec } from "../../types";

// ---------- Base Provider ----------

/**
 * Abstract base class for all component providers.
 */
export abstract class Provider {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  // List operations
  abstract listTools(): Promise<Tool[]>;
  abstract listResources(): Promise<Resource[]>;
  abstract listResourceTemplates(): Promise<ResourceTemplate[]>;
  abstract listPrompts(): Promise<Prompt[]>;

  // Get operations
  abstract getTool(
    name: string,
    version?: VersionSpec
  ): Promise<Tool | null>;
  abstract getResource(
    uri: string,
    version?: VersionSpec
  ): Promise<Resource | null>;
  abstract getPrompt(
    name: string,
    version?: VersionSpec
  ): Promise<Prompt | null>;
}

// ---------- Local Provider ----------

/**
 * Provider that stores components registered via decorators/builders.
 *
 * This is the default provider used when registering tools/resources/prompts
 * directly on a FastMCP instance.
 */
export class LocalProvider extends Provider {
  private tools = new Map<string, Tool>();
  private resources = new Map<string, Resource>();
  private resourceTemplates = new Map<string, ResourceTemplate>();
  private prompts = new Map<string, Prompt>();

  constructor(name: string = "local") {
    super(name);
  }

  // Registration
  addTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  addResource(resource: Resource): void {
    this.resources.set(resource.uri, resource);
  }

  addResourceTemplate(template: ResourceTemplate): void {
    this.resourceTemplates.set(template.uriTemplate, template);
  }

  addPrompt(prompt: Prompt): void {
    this.prompts.set(prompt.name, prompt);
  }

  // Removal
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  removeResource(uri: string): boolean {
    return this.resources.delete(uri);
  }

  removePrompt(name: string): boolean {
    return this.prompts.delete(name);
  }

  // List operations
  async listTools(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }

  async listResources(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  async listResourceTemplates(): Promise<ResourceTemplate[]> {
    return Array.from(this.resourceTemplates.values());
  }

  async listPrompts(): Promise<Prompt[]> {
    return Array.from(this.prompts.values());
  }

  // Get operations
  async getTool(name: string): Promise<Tool | null> {
    return this.tools.get(name) ?? null;
  }

  async getResource(uri: string): Promise<Resource | null> {
    // Direct match
    const resource = this.resources.get(uri);
    if (resource) return resource;

    // Template match
    for (const template of this.resourceTemplates.values()) {
      if (template.matches(uri)) {
        const params = template.extractParams(uri);
        if (params) {
          // Create a dynamic resource from the template
          const { FunctionResource } = await import(
            "../../resources"
          );
          return new FunctionResource({
            name: template.name,
            uri,
            mimeType: template.mimeType,
            handler: (p, ctx) => template.read(p, ctx),
          });
        }
      }
    }

    return null;
  }

  async getPrompt(name: string): Promise<Prompt | null> {
    return this.prompts.get(name) ?? null;
  }
}

// ---------- Aggregate Provider ----------

/**
 * Composes multiple providers with first-match semantics.
 *
 * This is used by FastMCP to aggregate all registered providers.
 */
export class AggregateProvider extends Provider {
  private providers: Provider[] = [];

  constructor(name: string = "aggregate") {
    super(name);
  }

  addProvider(provider: Provider): void {
    this.providers.push(provider);
  }

  removeProvider(name: string): boolean {
    const index = this.providers.findIndex((p) => p.name === name);
    if (index >= 0) {
      this.providers.splice(index, 1);
      return true;
    }
    return false;
  }

  getProviders(): readonly Provider[] {
    return this.providers;
  }

  // List operations - aggregate from all providers
  async listTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];
    const seen = new Set<string>();
    for (const provider of this.providers) {
      const tools = await provider.listTools();
      for (const tool of tools) {
        if (!seen.has(tool.name)) {
          seen.add(tool.name);
          allTools.push(tool);
        }
      }
    }
    return allTools;
  }

  async listResources(): Promise<Resource[]> {
    const allResources: Resource[] = [];
    const seen = new Set<string>();
    for (const provider of this.providers) {
      const resources = await provider.listResources();
      for (const resource of resources) {
        if (!seen.has(resource.uri)) {
          seen.add(resource.uri);
          allResources.push(resource);
        }
      }
    }
    return allResources;
  }

  async listResourceTemplates(): Promise<ResourceTemplate[]> {
    const allTemplates: ResourceTemplate[] = [];
    const seen = new Set<string>();
    for (const provider of this.providers) {
      const templates = await provider.listResourceTemplates();
      for (const template of templates) {
        if (!seen.has(template.uriTemplate)) {
          seen.add(template.uriTemplate);
          allTemplates.push(template);
        }
      }
    }
    return allTemplates;
  }

  async listPrompts(): Promise<Prompt[]> {
    const allPrompts: Prompt[] = [];
    const seen = new Set<string>();
    for (const provider of this.providers) {
      const prompts = await provider.listPrompts();
      for (const prompt of prompts) {
        if (!seen.has(prompt.name)) {
          seen.add(prompt.name);
          allPrompts.push(prompt);
        }
      }
    }
    return allPrompts;
  }

  // Get operations - first match wins
  async getTool(
    name: string,
    version?: VersionSpec
  ): Promise<Tool | null> {
    for (const provider of this.providers) {
      const tool = await provider.getTool(name, version);
      if (tool) return tool;
    }
    return null;
  }

  async getResource(
    uri: string,
    version?: VersionSpec
  ): Promise<Resource | null> {
    for (const provider of this.providers) {
      const resource = await provider.getResource(uri, version);
      if (resource) return resource;
    }
    return null;
  }

  async getPrompt(
    name: string,
    version?: VersionSpec
  ): Promise<Prompt | null> {
    for (const provider of this.providers) {
      const prompt = await provider.getPrompt(name, version);
      if (prompt) return prompt;
    }
    return null;
  }
}
