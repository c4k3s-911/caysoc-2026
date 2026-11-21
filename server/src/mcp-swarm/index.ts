/**
 * MCP Swarm — parallel layer for autonomous multi-agent operations.
 *
 * Exposes a JSON-RPC 2.0 server over local loopback HTTP so the TypeScript
 * Paperclip core and the Python 3.11 swarm agents can talk without stdio
 * pipes or type drift. Shared Pydantic schemas on the Python side mirror
 * the TypeScript interfaces here.
 *
 * @see docs/refactor-plan-mcp-swarm.md
 */

export { createMcpSwarmServer } from "./server.js";
export type { McpSwarmServer } from "./server.js";
export {
  JSONRPC_VERSION,
  JSONRPC_ERROR_CODES,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcError,
  type JsonRpcErrorObject,
  type JsonRpcSuccess,
} from "./jsonrpc.js";
export {
  TOOLKIT_SECURITY_TIERS,
  type SecurityTier,
  type ToolkitCapability,
  type ToolkitCatalog,
  type ToolkitToolDescriptor,
} from "./schemas.js";
export { createSwarmRedisClient, type RedisClient, type RedisClientOptions } from "./redis-client.js";
export {
  tryGetTool,
  hasCell,
  hasTool,
  filterByTier,
  filterByCell,
  getToolNames,
  validateToolParams,
} from "./catalog-guards.js";
export {
  tryAcquire,
  markSuccess,
  markError,
  getState,
  CELL_RATE_LIMITS,
  type CellName,
  type RateLimitResult,
} from "./token-bucket.js";
export {
  createSwarmTelemetryServer,
  type SwarmTelemetryServer,
  type TelemetryEventType,
} from "./telemetry-ws.js";
export {
  createSwarmWatchdogBridge,
  type SwarmWatchdogBridge,
  type WatchdogBridgeHealth,
} from "./watchdog-bridge.js";
export {
  createSwarmPersistenceService,
  type SwarmPersistenceService,
} from "./persistence.js";
export { mapCaySocRoleToTool, CAYSEC_TOOLS, getToolsByCell, getToolsByTier, isAuthorized, getRateBucket, getTier } from "./caysoc-tool-mapping.js";
export {
  FULL_TOOL_CATALOG,
  buildFullCatalog,
  getToolCountByCell,
  getToolCountByTier,
  printCatalogSummary,
} from "./full-tool-catalog.js";