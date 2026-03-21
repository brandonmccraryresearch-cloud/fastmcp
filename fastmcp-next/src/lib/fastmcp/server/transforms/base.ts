/**
 * Transform Base — Abstract base class for all transforms.
 *
 * Separated from index.ts to avoid circular imports with concrete transforms.
 */

import type { Tool } from "../../tools";
import type { Resource, ResourceTemplate } from "../../resources";
import type { Prompt } from "../../prompts";
import type { VersionSpec } from "../../types";

// ---------- Call-Next Protocol Types ----------

export type GetToolNext = (
  name: string,
  version?: VersionSpec
) => Promise<Tool | null>;

export type GetResourceNext = (
  uri: string,
  version?: VersionSpec
) => Promise<Resource | null>;

export type GetResourceTemplateNext = (
  uri: string,
  version?: VersionSpec
) => Promise<ResourceTemplate | null>;

export type GetPromptNext = (
  name: string,
  version?: VersionSpec
) => Promise<Prompt | null>;

// ---------- Base Transform ----------

/**
 * Base class for all component transformations.
 *
 * Override list operations (pure functions) and/or get operations
 * (middleware with call_next) to transform components.
 *
 * Default implementations pass through unchanged.
 */
export abstract class Transform {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  // List operations (pure functions — transform sequences)

  async listTools(tools: Tool[]): Promise<Tool[]> {
    return tools;
  }

  async listResources(resources: Resource[]): Promise<Resource[]> {
    return resources;
  }

  async listResourceTemplates(
    templates: ResourceTemplate[]
  ): Promise<ResourceTemplate[]> {
    return templates;
  }

  async listPrompts(prompts: Prompt[]): Promise<Prompt[]> {
    return prompts;
  }

  // Get operations (middleware — intercept named lookups)

  async getTool(
    name: string,
    callNext: GetToolNext,
    version?: VersionSpec
  ): Promise<Tool | null> {
    return callNext(name, version);
  }

  async getResource(
    uri: string,
    callNext: GetResourceNext,
    version?: VersionSpec
  ): Promise<Resource | null> {
    return callNext(uri, version);
  }

  async getResourceTemplate(
    uri: string,
    callNext: GetResourceTemplateNext,
    version?: VersionSpec
  ): Promise<ResourceTemplate | null> {
    return callNext(uri, version);
  }

  async getPrompt(
    name: string,
    callNext: GetPromptNext,
    version?: VersionSpec
  ): Promise<Prompt | null> {
    return callNext(name, version);
  }
}
