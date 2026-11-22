/**
 * MCP Swarm server — JSON-RPC 2.0 over local loopback HTTP.
 *
 * This is the parallel layer that the Python swarm agents talk to. It
 * exposes a minimal JSON-RPC surface and a toolkit catalog endpoint.
 * The server is created lazily and is feature-flagged off by default
 * until the Thursday handoff.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { PluginToolDispatcher } from "../services/plugin-tool-dispatcher.js";
import { logger } from "../middleware/logger.js";
import type { ToolRunContext } from "@paperclipai/plugin-sdk";
import {
  JSONRPC_ERROR_CODES,
  type JsonRpcErrorCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
  successResponse,
  errorResponse,
  isJsonRpcRequest,
} from "./jsonrpc.js";
import {
  TOOLKIT_SECURITY_TIERS,
  type SecurityTier,
  type ToolkitCapability,
  type ToolkitCatalog,
  type ToolkitToolDescriptor,
} from "./schemas.js";
import { tryAcquire, markSuccess, markError, getState, type CellName } from "./token-bucket.js";

export interface McpSwarmServerOptions {
  host?: string;
  port?: number;
  dispatcher?: PluginToolDispatcher;
  redisOptions?: { host?: string; port?: number; password?: string; db?: number; keyPrefix?: string };
}

export interface McpSwarmServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/** Map a plugin tool descriptor to a swarm toolkit descriptor tagged by cell. */
function toToolkitTool(
  descriptor: { name: string; displayName: string; description: string; parametersSchema: Record<string, unknown> },
  cell: string,
  tier: SecurityTier,
): ToolkitToolDescriptor {
  return {
    name: descriptor.name,
    displayName: descriptor.displayName,
    description: descriptor.description,
    tier,
    parametersSchema: descriptor.parametersSchema,
    cell,
  };
}

/** Built-in scope-gated dark-web monitor tool (no plugin required). */
const TORBOT_TOOL: ToolkitToolDescriptor = {
  name: "recon:torbot",
  displayName: "TorBot Dark-web Monitor",
  description:
    "Scope-gated passive dark-web/brand monitoring. Requires an approved lab scope token with tool 'torbot'; results are redacted aggregates plus a SHA-256 evidence hash.",
  tier: TOOLKIT_SECURITY_TIERS.SENSITIVE,
  cell: "RECON",
  parametersSchema: {
    type: "object",
    properties: {
      target: { type: "string", description: "Authorised domain or onion URL" },
      scopeToken: { type: "string", description: "Short-lived execution token from the scope gate" },
      depth: { type: "number", default: 1 },
    },
    required: ["target", "scopeToken"],
  },
};

async function invokeTorbot(params: Record<string, unknown>): Promise<unknown> {
  const base = process.env.CAYSOC_AGGREGATOR_URL || "http://127.0.0.1:4310";
  let operatorToken = process.env.CAYSOC_TORBOT_TOKEN || "";
  if (!operatorToken) {
    try {
      const tokens = JSON.parse(process.env.CAYSOC_GOV_TOKENS || "[]") as Array<{ role?: string; token?: string }>;
      operatorToken = tokens.find((t) => t.role === "operator")?.token || "";
    } catch { /* ignore */ }
  }
  if (!operatorToken) throw new Error("governance operator token unavailable");
  const response = await fetch(`${base}/api/csg/assets/onion/scan`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({
      target: params.target,
      scopeToken: params.scopeToken,
      depth: Number(params.depth) || 1,
    }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`torbot denied: ${JSON.stringify(body)}`);
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        ok: true,
        sighting: body.sighting,
        check: body.check,
        note: "Redacted aggregate only. Raw dark-web content never leaves the runner.",
      }),
    }],
  };
}

/** Build the toolkit catalog from the live plugin tool dispatcher. */
function buildCatalog(dispatcher?: PluginToolDispatcher): ToolkitCatalog {
  const tools = dispatcher ? dispatcher.listToolsForAgent() : [];
  const capabilities: ToolkitCapability[] = [];
  const seen = new Map<string, ToolkitCapability>();

  for (const tool of tools) {
    const cell = tool.pluginId;
    const tier: SecurityTier =
      tool.name.includes("exploit") || tool.name.includes("payload")
        ? TOOLKIT_SECURITY_TIERS.RESTRICTED
        : tool.name.includes("audit") || tool.name.includes("compliance")
        ? TOOLKIT_SECURITY_TIERS.SENSITIVE
        : TOOLKIT_SECURITY_TIERS.PUBLIC;

    let cap = seen.get(cell);
    if (!cap) {
      cap = { cell, tier: TOOLKIT_SECURITY_TIERS.PUBLIC, tools: [] };
      seen.set(cell, cap);
      capabilities.push(cap);
    }
    cap.tools.push(toToolkitTool(tool, cell, tier));
  }

  let recon = seen.get("RECON");
  if (!recon) {
    recon = { cell: "RECON", tier: TOOLKIT_SECURITY_TIERS.PUBLIC, tools: [] };
    seen.set("RECON", recon);
    capabilities.push(recon);
  }
  if (!recon.tools.some((t) => t.name === TORBOT_TOOL.name)) recon.tools.push(TORBOT_TOOL);

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    capabilities,
  };
}

/** Parse and validate a JSON body as a JSON-RPC request. */
async function parseJsonRpcRequest(req: IncomingMessage): Promise<JsonRpcRequest | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isJsonRpcRequest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Build a validated ToolRunContext from untrusted JSON-RPC params. */
function parseRunContext(value: unknown): ToolRunContext {
  const raw = (value ?? {}) as Record<string, unknown>;
  const read = (field: keyof ToolRunContext): string => {
    const v = raw[field];
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`runContext.${field} is required`);
    }
    return v;
  };
  return {
    agentId: read("agentId"),
    runId: read("runId"),
    companyId: read("companyId"),
    projectId: read("projectId"),
  };
}

/** Dispatch a single JSON-RPC method. */
async function handleRpcMethod(
  request: JsonRpcRequest,
  dispatcher: PluginToolDispatcher | undefined,
  rateLimitCell?: CellName,
): Promise<unknown> {
  // Quick circuit-breaker check before any work
  const circuitState = getState();
  if (circuitState.circuit.tripped) {
    throw new Error(`Circuit breaker tripped — ${circuitState.circuit.errorRate * 100}% error rate`);
  }

  // Per-cell rate limiting
  if (rateLimitCell) {
    const { allowed } = tryAcquire(rateLimitCell);
    if (!allowed) {
      throw new Error(`Rate limit exceeded for cell ${rateLimitCell}`);
    }
  }

  switch (request.method) {
    case "ping":
      return { ok: true, serverTime: new Date().toISOString() };
    case "toolkit.list": {
      return buildCatalog(dispatcher);
    }
    case "toolkit.execute": {
      const params = request.params ?? {};
      const namespacedName = params.namespacedName;
      const parameters = params.parameters;
      if (typeof namespacedName !== "string") {
        throw new Error("namespacedName is required");
      }
      if (namespacedName === TORBOT_TOOL.name) {
        return invokeTorbot((parameters ?? {}) as Record<string, unknown>);
      }
      if (!dispatcher) throw new Error("tool dispatcher unavailable");
      return dispatcher.executeTool(namespacedName, parameters, parseRunContext(params.runContext));
    }
    default:
      throw new Error(`method not found: ${request.method}`);
    }
}

/** Record success or error after a tool execution. */
function recordExecution(succeeded: boolean): void {
  if (succeeded) {
    markSuccess();
  } else {
    markError();
  }
}

export function createMcpSwarmServer(options: McpSwarmServerOptions = {}): McpSwarmServer {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 9090;
  const dispatcher = options.dispatcher;
  const redisOptions = options.redisOptions ?? {};

  let server: ReturnType<typeof import("node:http").createServer> | null = null;
  let running = false;

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }

    const request = await parseJsonRpcRequest(req);
    if (!request) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          errorResponse(null, JSONRPC_ERROR_CODES.INVALID_REQUEST, "invalid JSON-RPC request"),
        ),
      );
      return;
    }

    let response: JsonRpcResponse;
    try {
      // Choose rate-limit cell based on tool namespace prefix if possible
      // Default to RECON for namespaced tools starting with "recon:", etc.
      let rateLimitCell: CellName | undefined;
      const namespacedName = request.params?.namespacedName;
      if (typeof namespacedName === "string") {
        const prefix = namespacedName.split(":")[0].toLowerCase();
        if (prefix === "recon") rateLimitCell = "RECON";
        else if (prefix === "exploit") rateLimitCell = "EXPLOITATION";
        else if (prefix === "audit") rateLimitCell = "AUDIT";
      }
      // Fall back to RECON if no prefix match
      rateLimitCell = rateLimitCell ?? "RECON";

      const result = await handleRpcMethod(request, dispatcher, rateLimitCell);
      recordExecution(true);
      response = successResponse(request.id, result ?? { ok: true });
    } catch (err) {
      recordExecution(false);
      const message = err instanceof Error ? err.message : String(err);
      let code: JsonRpcErrorCode = JSONRPC_ERROR_CODES.INTERNAL_ERROR;

      // Distinguish rate-limit trips from other errors
      if (message.includes("Rate limit exceeded")) {
        code = JSONRPC_ERROR_CODES.SWARM_RATE_LIMITED;
      } else if (message.includes("Circuit breaker tripped")) {
        code = JSONRPC_ERROR_CODES.SWARM_CIRCUIT_OPEN;
      }

      response = errorResponse(request.id, code, message);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  }

  return {
    async start() {
      if (running) return;
      const { createServer } = await import("node:http");
      server = createServer(handleRequest);
      await new Promise<void>((resolve) => {
        server!.listen(port, host, () => {
          running = true;
          logger.info({ host, port }, "MCP swarm server listening");
          resolve();
        });
      });
    },

    async stop() {
      if (!running || !server) return;
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      running = false;
      logger.info("MCP swarm server stopped");
    },

    isRunning() {
      return running;
    },
  };
}