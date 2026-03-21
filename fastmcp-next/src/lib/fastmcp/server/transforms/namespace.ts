/**
 * Namespace Transform — Prefixes component names with a namespace string.
 *
 * Transforms:
 * - Tools:     "add" → "math_add"
 * - Prompts:   "summarize" → "api_summarize"
 * - Resources: "file://data.txt" → "file://math/data.txt"
 * - Templates: "http://api/files/{id}" → "http://api/math/files/{id}"
 *
 * Mirrors Python's `server/transforms/namespace.py`
 */

import { Transform } from "./base";
import type {
  GetToolNext,
  GetResourceNext,
  GetResourceTemplateNext,
  GetPromptNext,
} from "./base";
import type { Tool } from "../../tools";
import type { Resource, ResourceTemplate } from "../../resources";
import type { Prompt } from "../../prompts";
import type { VersionSpec } from "../../types";
import { cloneComponent } from "./utils";

export class Namespace extends Transform {
  readonly prefix: string;
  readonly separator: string;

  constructor(prefix: string, separator: string = "_") {
    super(`Namespace(${prefix})`);
    this.prefix = prefix;
    this.separator = separator;
  }

  // ---------- Name Transforms ----------

  private transformName(name: string): string {
    return `${this.prefix}${this.separator}${name}`;
  }

  private reverseName(name: string): string | null {
    const prefix = `${this.prefix}${this.separator}`;
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
    return null;
  }

  private transformUri(uri: string): string {
    // Insert namespace as a path segment after the scheme
    const schemeEnd = uri.indexOf("://");
    if (schemeEnd === -1) {
      return `${this.prefix}/${uri}`;
    }
    const scheme = uri.slice(0, schemeEnd + 3);
    const path = uri.slice(schemeEnd + 3);
    return `${scheme}${this.prefix}/${path}`;
  }

  private reverseUri(uri: string): string | null {
    const schemeEnd = uri.indexOf("://");
    if (schemeEnd === -1) {
      if (uri.startsWith(`${this.prefix}/`)) {
        return uri.slice(this.prefix.length + 1);
      }
      return null;
    }
    const scheme = uri.slice(0, schemeEnd + 3);
    const path = uri.slice(schemeEnd + 3);
    const expectedPrefix = `${this.prefix}/`;
    if (path.startsWith(expectedPrefix)) {
      return `${scheme}${path.slice(expectedPrefix.length)}`;
    }
    return null;
  }

  // ---------- List Operations (Pure) ----------

  async listTools(tools: Tool[]): Promise<Tool[]> {
    return tools.map((tool) =>
      cloneComponent(tool, { name: this.transformName(tool.name) })
    );
  }

  async listResources(resources: Resource[]): Promise<Resource[]> {
    return resources.map((resource) =>
      cloneComponent(resource, {
        name: this.transformName(resource.name),
        uri: this.transformUri(resource.uri),
      })
    );
  }

  async listResourceTemplates(
    templates: ResourceTemplate[]
  ): Promise<ResourceTemplate[]> {
    return templates.map((template) =>
      cloneComponent(template, {
        name: this.transformName(template.name),
        uriTemplate: this.transformUri(template.uriTemplate),
      })
    );
  }

  async listPrompts(prompts: Prompt[]): Promise<Prompt[]> {
    return prompts.map((prompt) =>
      cloneComponent(prompt, { name: this.transformName(prompt.name) })
    );
  }

  // ---------- Get Operations (Middleware) ----------

  async getTool(
    name: string,
    callNext: GetToolNext,
    version?: VersionSpec
  ): Promise<Tool | null> {
    const original = this.reverseName(name);
    if (original === null) return null;

    const tool = await callNext(original, version);
    if (!tool) return null;

    return cloneComponent(tool, { name });
  }

  async getResource(
    uri: string,
    callNext: GetResourceNext,
    version?: VersionSpec
  ): Promise<Resource | null> {
    const original = this.reverseUri(uri);
    if (original === null) return null;

    const resource = await callNext(original, version);
    if (!resource) return null;

    return cloneComponent(resource, { uri });
  }

  async getResourceTemplate(
    uri: string,
    callNext: GetResourceTemplateNext,
    version?: VersionSpec
  ): Promise<ResourceTemplate | null> {
    const original = this.reverseUri(uri);
    if (original === null) return null;

    const template = await callNext(original, version);
    if (!template) return null;

    return cloneComponent(template, { uriTemplate: uri });
  }

  async getPrompt(
    name: string,
    callNext: GetPromptNext,
    version?: VersionSpec
  ): Promise<Prompt | null> {
    const original = this.reverseName(name);
    if (original === null) return null;

    const prompt = await callNext(original, version);
    if (!prompt) return null;

    return cloneComponent(prompt, { name });
  }
}
