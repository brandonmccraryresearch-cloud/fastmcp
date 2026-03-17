/**
 * FastMCPComponent - Base class for all MCP components.
 *
 * All components (Tool, Resource, Prompt) extend this base,
 * providing common metadata and identification.
 *
 * Mirrors Python's FastMCPComponent from utilities/components.py
 */

import type { Icon, ComponentMeta } from "../types";

export interface FastMCPComponentOptions {
  name: string;
  version?: string;
  title?: string;
  description?: string;
  icons?: Icon[];
  tags?: Set<string> | string[];
  meta?: Record<string, unknown>;
}

export abstract class FastMCPComponent implements ComponentMeta {
  readonly name: string;
  readonly version?: string;
  readonly title?: string;
  readonly description?: string;
  readonly icons?: Icon[];
  readonly tags: Set<string>;
  readonly meta: Record<string, unknown>;

  constructor(options: FastMCPComponentOptions) {
    this.name = options.name;
    this.version = options.version;
    this.title = options.title;
    this.description = options.description;
    this.icons = options.icons;
    this.tags =
      options.tags instanceof Set
        ? options.tags
        : new Set(options.tags ?? []);
    this.meta = options.meta ?? {};
  }

  /**
   * Get the component metadata as a plain object.
   */
  getMetadata(): ComponentMeta {
    return {
      name: this.name,
      version: this.version,
      title: this.title,
      description: this.description,
      icons: this.icons,
      tags: this.tags,
      meta: this.meta,
    };
  }

  /**
   * Check if the component has a specific tag.
   */
  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  /**
   * Check if the component matches any of the given tags.
   */
  matchesTags(tags: string[]): boolean {
    return tags.some((tag) => this.tags.has(tag));
  }
}
