/**
 * Shared swarm schemas — the TypeScript side of the Pydantic mirror.
 *
 * These types describe the capability catalog served at `/api/v2/toolkit`
 * and the per-cell security tiers. Agents query the catalog on
 * initialization and only see tools tagged for their current mission
 * phase.
 */

/** Security tiers for swarm cells. */
export const TOOLKIT_SECURITY_TIERS = {
  PUBLIC: "public",
  SENSITIVE: "sensitive",
  RESTRICTED: "restricted",
} as const;

export type SecurityTier = (typeof TOOLKIT_SECURITY_TIERS)[keyof typeof TOOLKIT_SECURITY_TIERS];

/** A single tool descriptor in the toolkit catalog. */
export interface ToolkitToolDescriptor {
  name: string;
  displayName: string;
  description: string;
  tier: SecurityTier;
  parametersSchema: Record<string, unknown>;
  cell: string;
}

/** A capability manifest for a single swarm cell. */
export interface ToolkitCapability {
  cell: string;
  tier: SecurityTier;
  tools: ToolkitToolDescriptor[];
}

/** The full toolkit catalog returned by `/api/v2/toolkit`. */
export interface ToolkitCatalog {
  version: string;
  generatedAt: string;
  capabilities: ToolkitCapability[];
}

/** The swarm mission lifecycle states. */
export const SWARM_MISSION_STATUSES = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type SwarmMissionStatus =
  (typeof SWARM_MISSION_STATUSES)[keyof typeof SWARM_MISSION_STATUSES];

/** A mission record persisted to PostgreSQL. */
export interface SwarmMission {
  id: string;
  issueId: string;
  status: SwarmMissionStatus;
  cell: string;
  startedAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
}