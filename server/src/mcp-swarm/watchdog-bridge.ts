/**
 * WatchdogUIBridge — bridges MCP Swarm telemetry to the Paperclip health
 * endpoint for real-time operator oversight.
 *
 * This service:
 * 1. Subscribes to the Swarm telemetry WebSocket stream
 * 2. Aggregates heartbeat events into per-cell health summaries
 * 3. Exposes a `/health/swarm` HTTP endpoint for the WatchdogUIBridge pipeline
 * 4. Raises alerts when circuit breaker trips or rate limits are hit
 *
 * The bridge is designed for the Thursday handoff — it provides the
 * visibility surface that MIT Lincoln reviewers will use to verify
 * the swarm is operating within spec.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { SwarmTelemetryServer, TelemetryEvent, TelemetryEventType } from "./telemetry-ws.js";
import type { CellName } from "./token-bucket.js";
import { logger } from "../middleware/logger.js";

export interface WatchdogBridgeHealth {
  status: "healthy" | "degraded" | "critical";
  cells: Record<CellName, { agents: number; lastHeartbeat: string | null; status: string }>;
  circuitBreaker: { tripped: boolean; errorRate: number; timeRemainingMs: number };
  connectedClients: number;
  timestamp: string;
}

export interface SwarmWatchdogBridge {
  start(telemetryServer: SwarmTelemetryServer): void;
  stop(): void;
  getHealth(): WatchdogBridgeHealth;
  handleHealthRequest(req: IncomingMessage, res: ServerResponse): void;
}

const CELL_NAMES: CellName[] = ["RECON", "EXPLOITATION", "AUDIT"];

export function createSwarmWatchdogBridge(): SwarmWatchdogBridge {
  const log = logger.child({ service: "mcp-swarm-watchdog-bridge" });

  let telemetryServer: SwarmTelemetryServer | null = null;
  let unsubscribeTelemetry: (() => void) | null = null;

  // Aggregated state
  const cellState = new Map<CellName, { agents: Set<string>; lastHeartbeat: string | null; status: string }>();
  let circuitBreakerState = { tripped: false, errorRate: 0, timeRemainingMs: 0 };
  let connectedClients = 0;

  // Initialize cell state
  for (const cell of CELL_NAMES) {
    cellState.set(cell, { agents: new Set<string>(), lastHeartbeat: null, status: "unknown" });
  }

  function handleTelemetryEvent(event: TelemetryEvent): void {
    switch (event.type as TelemetryEventType) {
      case "heartbeat": {
        const payload = event.payload as { agentId: string; cell: CellName; status: string };
        const state = cellState.get(payload.cell);
        if (state) {
          state.agents.add(payload.agentId);
          state.lastHeartbeat = event.timestamp;
          state.status = payload.status;
        }
        break;
      }
      case "circuit_breaker": {
        const payload = event.payload as { tripped: boolean; errorRate: number; timeRemainingMs: number };
        circuitBreakerState = payload;
        if (payload.tripped) {
          log.warn({ errorRate: payload.errorRate }, "Circuit breaker tripped — swarm degraded");
        }
        break;
      }
      case "rate_limit": {
        const payload = event.payload as { cell: CellName; remaining: number; limit: number };
        if (payload.remaining === 0) {
          log.info({ cell: payload.cell, limit: payload.limit }, "Cell rate limit exhausted");
        }
        break;
      }
      case "mission_update": {
        const payload = event.payload as { missionId: string; status: string; cell: CellName };
        log.info({ missionId: payload.missionId, status: payload.status, cell: payload.cell }, "Mission update");
        break;
      }
    }
  }

  function computeOverallStatus(): "healthy" | "degraded" | "critical" {
    if (circuitBreakerState.tripped) return "critical";

    const now = Date.now();
    let degradedCells = 0;

    for (const [, state] of cellState) {
      // An idle cell with no agents is not a degradation.
      if (state.agents.size === 0) continue;
      if (!state.lastHeartbeat) {
        degradedCells += 1;
        continue;
      }
      const lastHb = new Date(state.lastHeartbeat).getTime();
      if (now - lastHb > 5000) { // 5s without heartbeat = degraded
        degradedCells += 1;
      }
    }

    if (degradedCells === 0) return "healthy";
    if (degradedCells >= 2) return "critical";
    return "degraded";
  }

  return {
    start(telemetry: SwarmTelemetryServer) {
      telemetryServer = telemetry;
      unsubscribeTelemetry = telemetry.subscribe(handleTelemetryEvent);
      log.info("Swarm watchdog bridge started");
    },

    stop() {
      if (unsubscribeTelemetry) {
        unsubscribeTelemetry();
        unsubscribeTelemetry = null;
      }
      telemetryServer = null;
      log.info("Swarm watchdog bridge stopped");
    },

    getHealth(): WatchdogBridgeHealth {
      const cells: Record<CellName, { agents: number; lastHeartbeat: string | null; status: string }> = {
        RECON: { agents: 0, lastHeartbeat: null, status: "unknown" },
        EXPLOITATION: { agents: 0, lastHeartbeat: null, status: "unknown" },
        AUDIT: { agents: 0, lastHeartbeat: null, status: "unknown" },
      };

      for (const [cell, state] of cellState) {
        cells[cell] = {
          agents: state.agents.size,
          lastHeartbeat: state.lastHeartbeat,
          status: state.status,
        };
      }

      return {
        status: computeOverallStatus(),
        cells,
        circuitBreaker: circuitBreakerState,
        connectedClients: telemetryServer?.getConnectedCount() ?? connectedClients,
        timestamp: new Date().toISOString(),
      };
    },

    handleHealthRequest(_req: IncomingMessage, res: ServerResponse) {
      const health = this.getHealth();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(health, null, 2));
    },
  };
}