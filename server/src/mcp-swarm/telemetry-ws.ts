/**
 * Real-time WebSocket telemetry stream for the MCP Swarm layer.
 *
 * Streams sub-second agent health metrics and mission status updates
 * to the Paperclip UI and the WatchdogUIBridge pipeline.
 *
 * Clients connect to `/ws/swarm` and receive JSON frames:
 *   { type: "heartbeat", agentId, cell, status, timestamp }
 *   { type: "mission_update", missionId, status, cell, timestamp }
 *   { type: "circuit_breaker", tripped, errorRate, timestamp }
 *   { type: "rate_limit", cell, remaining, limit, timestamp }
 */

import type { WebSocketServer, WebSocket } from "ws";
import type { CellName } from "./token-bucket.js";
import { logger } from "../middleware/logger.js";

export type TelemetryEventType =
  | "heartbeat"
  | "mission_update"
  | "circuit_breaker"
  | "rate_limit";

export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SwarmTelemetryServer {
  start(httpServer: ReturnType<typeof import("node:http").createServer>): Promise<void>;
  stop(): Promise<void>;
  emit(event: TelemetryEvent): void;
  /** Subscribe a listener to every emitted event. Returns an unsubscribe fn. */
  subscribe(listener: (event: TelemetryEvent) => void): () => void;
  emitHeartbeat(agentId: string, cell: CellName, status: string): void;
  emitMissionUpdate(missionId: string, status: string, cell: CellName): void;
  getConnectedCount(): number;
  isRunning(): boolean;
}

const HEARTBEAT_INTERVAL_MS = 500; // 2Hz for sub-second health metrics

export function createSwarmTelemetryServer(): SwarmTelemetryServer {
  const log = logger.child({ service: "mcp-swarm-telemetry" });

  let wsServer: WebSocketServer | null = null;
  let running = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  // In-memory ring buffer for recent events (for clients that reconnect)
  const eventBuffer: TelemetryEvent[] = [];
  const MAX_BUFFER_SIZE = 500;
  const listeners = new Set<(event: TelemetryEvent) => void>();

  function broadcast(event: TelemetryEvent): void {
    // Notify in-process subscribers (e.g. the watchdog bridge) even when no
    // WebSocket clients are connected.
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // never let a subscriber break telemetry
      }
    }

    // Always retain recent events so reconnecting clients can catch up.
    eventBuffer.push(event);
    if (eventBuffer.length > MAX_BUFFER_SIZE) {
      eventBuffer.shift();
    }

    if (!wsServer) return;
    const serialized = JSON.stringify(event);

    // Broadcast to all connected clients
    wsServer.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(serialized);
        } catch {
          // swallow send errors
        }
      }
    });
  }

  function sendEventBuffer(client: WebSocket): void {
    if (client.readyState !== 1) return;
    for (const event of eventBuffer) {
      try {
        client.send(JSON.stringify(event));
      } catch {
        break;
      }
    }
  }

  return {
    async start(httpServer) {
      if (running) return;
      const { WebSocketServer } = await import("ws");

      const server = new WebSocketServer({ noServer: true });
      wsServer = server;

      httpServer.on("upgrade", (request, socket, head) => {
        const url = new URL(request.url ?? "", `http://${request.headers.host}`);
        if (url.pathname !== "/ws/swarm") {
          socket.destroy();
          return;
        }

        server.handleUpgrade(request, socket, head, (client) => {
          server.emit("connection", client, request as any);
        });
      });

      server.on("connection", (client) => {
        log.info({ connected: server.clients.size }, "Swarm telemetry client connected");

        // Send recent events buffer on connect
        sendEventBuffer(client);

        client.on("close", () => {
          log.info({ connected: server.clients.size }, "Swarm telemetry client disconnected");
        });

        client.on("error", () => {
          // swallow client errors
        });
      });

      running = true;
      log.info("Swarm telemetry WebSocket server started");
    },

    async stop() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (wsServer) {
        await new Promise<void>((resolve) => {
          wsServer!.close(() => resolve());
        });
      }
      running = false;
      wsServer = null;
      log.info("Swarm telemetry WebSocket server stopped");
    },

    emit(event: TelemetryEvent) {
      broadcast(event);
    },

    subscribe(listener: (event: TelemetryEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    emitHeartbeat(agentId: string, cell: CellName, status: string) {
      const event: TelemetryEvent = {
        type: "heartbeat",
        timestamp: new Date().toISOString(),
        payload: { agentId, cell, status },
      };
      broadcast(event);
    },

    emitMissionUpdate(missionId: string, status: string, cell: CellName) {
      const event: TelemetryEvent = {
        type: "mission_update",
        timestamp: new Date().toISOString(),
        payload: { missionId, status, cell },
      };
      broadcast(event);
    },

    getConnectedCount(): number {
      return wsServer?.clients.size ?? 0;
    },

    isRunning() {
      return running;
    },
  };
}