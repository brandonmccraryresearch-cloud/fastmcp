/**
 * Transform System — Two-phase component transformation pipeline.
 *
 * Transforms modify how components (tools, resources, prompts) appear to clients.
 * They operate in two phases:
 *
 * 1. **List operations** (pure): Transform sequences of components
 *    `Sequence<Component> → Sequence<Component>`
 *
 * 2. **Get operations** (middleware): Intercept named lookups with call_next chaining
 *    `(name, callNext) → callNext(reversedName) → transformResult`
 *
 * Mirrors Python's `server/transforms/` module.
 */

import type { Tool } from "../../tools";
import type { Resource, ResourceTemplate } from "../../resources";
import type { Prompt } from "../../prompts";
import type { VersionSpec } from "../../types";

// Re-export base types
export {
  Transform,
  type GetToolNext,
  type GetResourceNext,
  type GetResourceTemplateNext,
  type GetPromptNext,
} from "./base";

import { Transform } from "./base";
import type { GetToolNext, GetResourceNext, GetResourceTemplateNext, GetPromptNext } from "./base";

// ---------- Transform Pipeline ----------

/**
 * Chains transforms for sequential execution.
 *
 * List operations execute sequentially (output of N is input to N+1).
 * Get operations wrap each other in middleware fashion (innermost calls
 * downstream first).
 */
export class TransformPipeline {
  private transforms: Transform[] = [];

  add(transform: Transform): void {
    this.transforms.push(transform);
  }

  remove(name: string): boolean {
    const index = this.transforms.findIndex((t) => t.name === name);
    if (index >= 0) {
      this.transforms.splice(index, 1);
      return true;
    }
    return false;
  }

  getTransforms(): readonly Transform[] {
    return this.transforms;
  }

  get length(): number {
    return this.transforms.length;
  }

  // List operations — chain sequentially

  async listTools(tools: Tool[]): Promise<Tool[]> {
    let result = tools;
    for (const transform of this.transforms) {
      result = await transform.listTools(result);
    }
    return result;
  }

  async listResources(resources: Resource[]): Promise<Resource[]> {
    let result = resources;
    for (const transform of this.transforms) {
      result = await transform.listResources(result);
    }
    return result;
  }

  async listResourceTemplates(
    templates: ResourceTemplate[]
  ): Promise<ResourceTemplate[]> {
    let result = templates;
    for (const transform of this.transforms) {
      result = await transform.listResourceTemplates(result);
    }
    return result;
  }

  async listPrompts(prompts: Prompt[]): Promise<Prompt[]> {
    let result = prompts;
    for (const transform of this.transforms) {
      result = await transform.listPrompts(result);
    }
    return result;
  }

  // Get operations — chain as middleware (build call_next chain)

  async getTool(
    name: string,
    finalLookup: GetToolNext,
    version?: VersionSpec
  ): Promise<Tool | null> {
    let callNext = finalLookup;
    // Build the chain from the innermost (last) transform outward
    for (let i = this.transforms.length - 1; i >= 0; i--) {
      const transform = this.transforms[i];
      const next = callNext;
      callNext = (n: string, v?: VersionSpec) =>
        transform.getTool(n, next, v);
    }
    return callNext(name, version);
  }

  async getResource(
    uri: string,
    finalLookup: GetResourceNext,
    version?: VersionSpec
  ): Promise<Resource | null> {
    let callNext = finalLookup;
    for (let i = this.transforms.length - 1; i >= 0; i--) {
      const transform = this.transforms[i];
      const next = callNext;
      callNext = (u: string, v?: VersionSpec) =>
        transform.getResource(u, next, v);
    }
    return callNext(uri, version);
  }

  async getResourceTemplate(
    uri: string,
    finalLookup: GetResourceTemplateNext,
    version?: VersionSpec
  ): Promise<ResourceTemplate | null> {
    let callNext = finalLookup;
    for (let i = this.transforms.length - 1; i >= 0; i--) {
      const transform = this.transforms[i];
      const next = callNext;
      callNext = (u: string, v?: VersionSpec) =>
        transform.getResourceTemplate(u, next, v);
    }
    return callNext(uri, version);
  }

  async getPrompt(
    name: string,
    finalLookup: GetPromptNext,
    version?: VersionSpec
  ): Promise<Prompt | null> {
    let callNext = finalLookup;
    for (let i = this.transforms.length - 1; i >= 0; i--) {
      const transform = this.transforms[i];
      const next = callNext;
      callNext = (n: string, v?: VersionSpec) =>
        transform.getPrompt(n, next, v);
    }
    return callNext(name, version);
  }
}

// Re-export concrete transforms
export { Namespace } from "./namespace";
export { Visibility, isEnabled } from "./visibility";
export { VersionFilter } from "./version-filter";
export { ToolTransform } from "./tool-transform";
