/**
 * Type guards and safe access helpers for the toolkit catalog.
 *
 * These utilities let the TypeScript side and the Python Pydantic mirror
 * safely query the catalog without throwing. The pattern:
 *
 *   const tool = tryGetTool(catalog, "acme.exploit", "payload-delivery");
 *   if (!tool) { /* not found or wrong tier *\/ }
 *
 * The Python side will have equivalent `has_cell()` and `has_tool()`
 * methods on the Pydantic model, so both halves of the swarm share
 * identical safety semantics.
 */

import type { ToolkitCatalog, ToolkitToolDescriptor, SecurityTier } from "./schemas.js";

/** Try to get a tool by plugin cell and tool name. Returns undefined if not found. */
export function tryGetTool(
  catalog: ToolkitCatalog,
  cell: string,
  toolName: string,
): ToolkitToolDescriptor | undefined {
  const capability = catalog.capabilities.find((c) => c.cell === cell);
  if (!capability) return undefined;
  return capability.tools.find((t) => t.name === toolName);
}

/** Check whether the catalog contains a given cell. */
export function hasCell(catalog: ToolkitCatalog, cell: string): boolean {
  return catalog.capabilities.some((c) => c.cell === cell);
}

/** Check whether the catalog contains a specific tool in a cell. */
export function hasTool(catalog: ToolkitCatalog, cell: string, toolName: string): boolean {
  return tryGetTool(catalog, cell, toolName) !== undefined;
}

/** Filter tools by security tier — returns a new catalog with only matching tools. */
export function filterByTier(catalog: ToolkitCatalog, tier: SecurityTier): ToolkitCatalog {
  return {
    version: catalog.version,
    generatedAt: catalog.generatedAt,
    capabilities: catalog.capabilities.map((cap) => ({
      cell: cap.cell,
      tier: cap.tier,
      tools: cap.tools.filter((t) => t.tier === tier),
    })),
  };
}

/** Filter tools by cell — returns a new catalog with only that cell's tools. */
export function filterByCell(catalog: ToolkitCatalog, cell: string): ToolkitCatalog {
  return {
    version: catalog.version,
    generatedAt: catalog.generatedAt,
    capabilities: catalog.capabilities.filter((c) => c.cell === cell),
  };
}

/** Get all tool names for a cell — useful for Python-side validation. */
export function getToolNames(catalog: ToolkitCatalog, cell: string): string[] {
  const capability = catalog.capabilities.find((c) => c.cell === cell);
  if (!capability) return [];
  return capability.tools.map((t) => t.name);
}

/** Validate that a tool's parameters match the expected schema shape (basic structural check). */
export function validateToolParams(
  tool: ToolkitToolDescriptor,
  params: unknown,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const schema = tool.parametersSchema;

  if (typeof params !== "object" || params === null) {
    errors.push("params must be an object");
    return { valid: false, errors };
  }

  const paramsObj = params as Record<string, unknown>;
  const required = schema.required as string[] | undefined;
  const properties = schema.properties as Record<string, { type?: string }> | undefined;

  if (required) {
    for (const key of required) {
      if (!(key in paramsObj)) {
        errors.push(`missing required parameter: ${key}`);
      }
    }
  }

  if (properties) {
    for (const [key, prop] of Object.entries(properties)) {
      const value = paramsObj[key];
      if (value !== undefined && prop.type) {
        const actualType = Array.isArray(value) ? "array" : typeof value;
        if (actualType !== prop.type) {
          errors.push(`parameter ${key} must be ${prop.type}, got ${actualType}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}