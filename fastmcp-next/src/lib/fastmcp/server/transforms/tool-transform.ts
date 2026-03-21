/**
 * ToolTransform — Modifies tool schemas (rename tools, rename arguments).
 *
 * Mirrors Python's `server/transforms/tool_transform.py`
 */

import { Transform } from "./base";
import type { GetToolNext } from "./base";
import type { Tool } from "../../tools";
import type { VersionSpec, JsonSchema } from "../../types";
import { cloneComponent } from "./utils";

// ---------- Config Types ----------

export interface ArgTransformConfig {
  /** New name for the argument */
  name?: string;
  /** New description */
  description?: string;
  /** Hide this argument from the schema (set a default value) */
  hide?: boolean;
  /** Default value when hidden */
  defaultValue?: unknown;
}

export interface ToolTransformConfig {
  /** New name for the tool */
  name?: string;
  /** New description */
  description?: string;
  /** Argument transformations */
  arguments?: Record<string, ArgTransformConfig>;
}

// ---------- ToolTransform ----------

export class ToolTransform extends Transform {
  private configs: Record<string, ToolTransformConfig>;
  /** Reverse mapping: final_name → original_name */
  private reverseMap: Map<string, string>;

  constructor(configs: Record<string, ToolTransformConfig>) {
    super("ToolTransform");
    this.configs = configs;

    // Build reverse map
    this.reverseMap = new Map();
    for (const [originalName, config] of Object.entries(configs)) {
      const finalName = config.name ?? originalName;
      if (this.reverseMap.has(finalName)) {
        throw new Error(
          `ToolTransform: Duplicate target name "${finalName}"`
        );
      }
      this.reverseMap.set(finalName, originalName);
    }
  }

  private applyTransform(tool: Tool): Tool {
    const config = this.configs[tool.name];
    if (!config) return tool;

    const overrides: Record<string, unknown> = {};

    // Rename tool
    if (config.name) {
      overrides.name = config.name;
    }

    // Update description
    if (config.description !== undefined) {
      overrides.description = config.description;
    }

    // Transform arguments in schema
    if (config.arguments && tool.inputSchema) {
      const newSchema = { ...tool.inputSchema };
      const newProperties = { ...newSchema.properties };
      const newRequired = [...(newSchema.required ?? [])];

      for (const [argName, argConfig] of Object.entries(
        config.arguments
      )) {
        if (!(argName in newProperties)) continue;

        if (argConfig.hide) {
          // Remove hidden arg from schema
          delete newProperties[argName];
          const reqIndex = newRequired.indexOf(argName);
          if (reqIndex >= 0) newRequired.splice(reqIndex, 1);
          continue;
        }

        if (argConfig.name) {
          // Rename argument
          const prop = newProperties[argName] as JsonSchema;
          delete newProperties[argName];
          newProperties[argConfig.name] = {
            ...prop,
            ...(argConfig.description
              ? { description: argConfig.description }
              : {}),
          };
          const reqIndex = newRequired.indexOf(argName);
          if (reqIndex >= 0) {
            newRequired[reqIndex] = argConfig.name;
          }
        } else if (argConfig.description) {
          newProperties[argName] = {
            ...(newProperties[argName] as JsonSchema),
            description: argConfig.description,
          };
        }
      }

      overrides.inputSchema = {
        ...newSchema,
        properties: newProperties,
        required: newRequired.length > 0 ? newRequired : undefined,
      };
    }

    return cloneComponent(tool, overrides);
  }

  // ---------- List Operations ----------

  async listTools(tools: Tool[]): Promise<Tool[]> {
    return tools.map((tool) => this.applyTransform(tool));
  }

  // ---------- Get Operations ----------

  async getTool(
    name: string,
    callNext: GetToolNext,
    version?: VersionSpec
  ): Promise<Tool | null> {
    // Reverse-map the name
    const originalName = this.reverseMap.get(name) ?? name;
    const tool = await callNext(originalName, version);
    if (!tool) return null;

    return this.applyTransform(tool);
  }
}
