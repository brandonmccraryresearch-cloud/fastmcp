/**
 * VersionFilter Transform — Filters components by version range.
 *
 * Mirrors Python's `server/transforms/version_filter.py`
 */

import { Transform } from "./base";
import type { GetToolNext, GetResourceNext, GetPromptNext } from "./base";
import type { Tool } from "../../tools";
import type { Resource, ResourceTemplate } from "../../resources";
import type { Prompt } from "../../prompts";
import type { VersionSpec } from "../../types";
import type { FastMCPComponent } from "../../utilities/components";

// ---------- Version Comparison ----------

/**
 * Compare two semver-like version strings.
 * Returns: negative if a < b, positive if a > b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

// ---------- VersionFilter Transform ----------

export interface VersionFilterOptions {
  /** Inclusive lower bound (versions >= this pass) */
  versionGte?: string;
  /** Exclusive upper bound (versions < this pass) */
  versionLt?: string;
  /** Whether unversioned components pass (default: true) */
  includeUnversioned?: boolean;
}

export class VersionFilter extends Transform {
  private versionGte?: string;
  private versionLt?: string;
  private includeUnversioned: boolean;

  constructor(options: VersionFilterOptions) {
    super("VersionFilter");
    this.versionGte = options.versionGte;
    this.versionLt = options.versionLt;
    this.includeUnversioned = options.includeUnversioned ?? true;
  }

  private matchesVersion(component: FastMCPComponent): boolean {
    const version = component.version;

    if (!version) {
      return this.includeUnversioned;
    }

    if (this.versionGte && compareVersions(version, this.versionGte) < 0) {
      return false;
    }

    if (this.versionLt && compareVersions(version, this.versionLt) >= 0) {
      return false;
    }

    return true;
  }

  // ---------- List Operations ----------

  async listTools(tools: Tool[]): Promise<Tool[]> {
    return tools.filter((t) => this.matchesVersion(t));
  }

  async listResources(resources: Resource[]): Promise<Resource[]> {
    return resources.filter((r) => this.matchesVersion(r));
  }

  async listResourceTemplates(
    templates: ResourceTemplate[]
  ): Promise<ResourceTemplate[]> {
    return templates.filter((t) => this.matchesVersion(t));
  }

  async listPrompts(prompts: Prompt[]): Promise<Prompt[]> {
    return prompts.filter((p) => this.matchesVersion(p));
  }

  // ---------- Get Operations ----------

  async getTool(
    name: string,
    callNext: GetToolNext,
    version?: VersionSpec
  ): Promise<Tool | null> {
    const tool = await callNext(name, version);
    if (!tool) return null;
    return this.matchesVersion(tool) ? tool : null;
  }

  async getResource(
    uri: string,
    callNext: GetResourceNext,
    version?: VersionSpec
  ): Promise<Resource | null> {
    const resource = await callNext(uri, version);
    if (!resource) return null;
    return this.matchesVersion(resource) ? resource : null;
  }

  async getPrompt(
    name: string,
    callNext: GetPromptNext,
    version?: VersionSpec
  ): Promise<Prompt | null> {
    const prompt = await callNext(name, version);
    if (!prompt) return null;
    return this.matchesVersion(prompt) ? prompt : null;
  }
}
