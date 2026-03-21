/**
 * Visibility Transform — Marks components with visibility state.
 *
 * Unlike other transforms, Visibility doesn't filter inline.
 * It marks components with visibility metadata that the Provider
 * layer uses for final filtering.
 *
 * Mirrors Python's `server/transforms/visibility.py`
 */

import { Transform } from "./base";
import type { Tool } from "../../tools";
import type { Resource, ResourceTemplate } from "../../resources";
import type { Prompt } from "../../prompts";
import type { FastMCPComponent } from "../../utilities/components";
import { cloneComponent } from "./utils";

// ---------- Helpers ----------

/**
 * Get the primary identifier for a component (URI, template URI, or name).
 */
function getComponentIdentifier(component: FastMCPComponent): string {
  if ("uri" in component) {
    return (component as unknown as { uri: string }).uri;
  }
  if ("uriTemplate" in component) {
    return (component as unknown as { uriTemplate: string }).uriTemplate;
  }
  return component.name;
}

// ---------- Visibility Criteria ----------

export interface VisibilityCriteria {
  /** Match by component name or URI */
  names?: string[];
  /** Match by tags (component must have at least one matching tag) */
  tags?: string[];
  /** Match by component type */
  components?: Set<"tool" | "resource" | "prompt" | "resource_template">;
  /** Match all components */
  matchAll?: boolean;
}

// ---------- Visibility Transform ----------

export class Visibility extends Transform {
  private enabled: boolean;
  private criteria: VisibilityCriteria;

  constructor(enabled: boolean, criteria: VisibilityCriteria = {}) {
    super(`Visibility(${enabled})`);
    this.enabled = enabled;
    this.criteria = criteria;
  }

  // ---------- Matching ----------

  private matchesComponent(
    component: FastMCPComponent,
    componentType: "tool" | "resource" | "prompt" | "resource_template"
  ): boolean {
    if (this.criteria.matchAll) return true;

    // Check component type filter
    if (
      this.criteria.components &&
      !this.criteria.components.has(componentType)
    ) {
      return false;
    }

    let hasAnyCriteria = false;
    let matchesAnyCriteria = false;

    // Check names
    if (this.criteria.names && this.criteria.names.length > 0) {
      hasAnyCriteria = true;
      const identifier = getComponentIdentifier(component);
      if (this.criteria.names.includes(identifier)) {
        matchesAnyCriteria = true;
      }
    }

    // Check tags
    if (this.criteria.tags && this.criteria.tags.length > 0) {
      hasAnyCriteria = true;
      if (component.matchesTags(this.criteria.tags)) {
        matchesAnyCriteria = true;
      }
    }

    // If no criteria specified (but not matchAll), don't match
    if (!hasAnyCriteria) return false;

    return matchesAnyCriteria;
  }

  private markComponent<T extends FastMCPComponent>(
    component: T,
    componentType: "tool" | "resource" | "prompt" | "resource_template"
  ): T {
    if (!this.matchesComponent(component, componentType)) {
      return component;
    }

    const clone = cloneComponent(component, {});
    if (!clone.meta.fastmcp) {
      clone.meta.fastmcp = {};
    }
    const fastmcpMeta = clone.meta.fastmcp as Record<string, unknown>;
    if (!fastmcpMeta._internal) {
      fastmcpMeta._internal = {};
    }
    (fastmcpMeta._internal as Record<string, unknown>).visibility =
      this.enabled;
    return clone;
  }

  // ---------- List Operations ----------

  async listTools(tools: Tool[]): Promise<Tool[]> {
    return tools.map((t) => this.markComponent(t, "tool"));
  }

  async listResources(resources: Resource[]): Promise<Resource[]> {
    return resources.map((r) => this.markComponent(r, "resource"));
  }

  async listResourceTemplates(
    templates: ResourceTemplate[]
  ): Promise<ResourceTemplate[]> {
    return templates.map((t) =>
      this.markComponent(t, "resource_template")
    );
  }

  async listPrompts(prompts: Prompt[]): Promise<Prompt[]> {
    return prompts.map((p) => this.markComponent(p, "prompt"));
  }
}

// ---------- Visibility Check Helper ----------

/**
 * Check if a component is enabled based on visibility metadata.
 * Components without visibility marks are considered enabled.
 */
export function isEnabled(component: FastMCPComponent): boolean {
  const meta = component.meta;
  const fastmcpMeta = meta?.fastmcp as
    | Record<string, unknown>
    | undefined;
  const internal = fastmcpMeta?._internal as
    | Record<string, unknown>
    | undefined;

  if (internal?.visibility === undefined) {
    return true; // No visibility mark = enabled
  }

  return internal.visibility as boolean;
}
