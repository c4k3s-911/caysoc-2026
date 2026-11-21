/**
 * E2E Staging Harness — Full Recon→Exploit→Persist→Cover Cycle
 *
 * This test simulates a complete adversarial operation across all three
 * swarm cells (RECON, EXPLOITATION, AUDIT), verifying:
 *   1. Tool catalog discovery and security tier filtering
 *   2. Per-cell rate limiting (RECON 50/min, EXPLOITATION 10/min, AUDIT 20/min)
 *   3. Global circuit-breaker trip at 5% error rate
 *   4. WebSocket telemetry emission (heartbeat, mission_update, circuit_breaker)
 *   5. WatchdogUIBridge health endpoint accuracy
 *   6. PostgreSQL mission/task persistence (audit trail)
 *
 * Run this test in staging before the Thursday handoff to validate the
 * full swarm operates within spec under MIT Lincoln review conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import http from "node:http";
import WebSocket from "ws";
import { createMcpSwarmServer } from "../server.js";
import { createSwarmTelemetryServer } from "../telemetry-ws.js";
import { createSwarmWatchdogBridge } from "../watchdog-bridge.js";
import { tryAcquire, markSuccess, markError, getState, CELL_RATE_LIMITS } from "../token-bucket.js";
import { buildFullCatalog, FULL_TOOL_CATALOG, getToolCountByCell } from "../full-tool-catalog.js";
import { JSONRPC_VERSION, JSONRPC_ERROR_CODES } from "../jsonrpc.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function postJson(port: number, body: unknown): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: res.statusCode ?? 0, json: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode ?? 0, json: raw });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function getJson(port: number, path: string): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method: "GET", path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ status: res.statusCode ?? 0, json: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode ?? 0, json: raw });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function connectWs(port: number, path: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E Full Cycle Test
// ─────────────────────────────────────────────────────────────────────────────

describe("E2E Full Recon→Exploit→Persist→Cover Cycle", () => {
  let swarmServer: ReturnType<typeof createMcpSwarmServer>;
  let telemetryServer: ReturnType<typeof createSwarmTelemetryServer>;
  let watchdogBridge: ReturnType<typeof createSwarmWatchdogBridge>;
  let wsClient: WebSocket | null = null;

  beforeEach(async () => {
    swarmServer = createMcpSwarmServer({ port: 41930 });
    telemetryServer = createSwarmTelemetryServer();
    watchdogBridge = createSwarmWatchdogBridge();

    await swarmServer.start();

    const { createServer } = await import("node:http");
    const httpServer = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await telemetryServer.start(httpServer);
    watchdogBridge.start(telemetryServer);
  });

  afterEach(async () => {
    wsClient?.close();
    await swarmServer.stop();
    await telemetryServer.stop();
    watchdogBridge.stop();
  });

  it("executes full adversarial cycle with rate limiting and telemetry", async () => {
    // ───────────────────────────────────────────────────────────────────────
    // Phase 1: RECON — 4 agents, 50 req/min bucket
    // ───────────────────────────────────────────────────────────────────────
    const reconAgents = ["recon-scout", "recon-mapper", "recon-spider", "recon-gatherer"];
    const reconResults: { agent: string; allowed: boolean; remainingMs: number }[] = [];

    for (const agent of reconAgents) {
      // Each agent performs 10 recon actions
      for (let i = 0; i < 10; i++) {
        const result = tryAcquire("RECON");
        reconResults.push({ agent, allowed: result.allowed, remainingMs: result.remainingMs });
        markSuccess();
      }
    }

    // Verify all RECON actions were allowed (40 actions < 50/min limit)
    expect(reconResults.every((r) => r.allowed)).toBe(true);

    // Verify RECON bucket still has tokens remaining
    const reconState = getState().cells.RECON;
    expect(reconState.tokens).toBeGreaterThan(0);

    // ───────────────────────────────────────────────────────────────────────
    // Phase 2: EXPLOITATION — 4 agents, 10 req/min bucket (strict)
    // ───────────────────────────────────────────────────────────────────────
    const exploitAgents = ["exploit-breacher", "exploit-injector", "exploit-pivot", "exploit-escalator"];
    const exploitResults: { agent: string; allowed: boolean; remainingMs: number }[] = [];

    for (const agent of exploitAgents) {
      // Each agent performs 3 exploit actions (12 total, exceeds 10/min limit)
      for (let i = 0; i < 3; i++) {
        const result = tryAcquire("EXPLOITATION");
        exploitResults.push({ agent, allowed: result.allowed, remainingMs: result.remainingMs });
        if (result.allowed) {
          markSuccess();
        }
      }
    }

    // Verify some EXPLOITATION actions were rate-limited (12 actions > 10/min limit)
    const deniedCount = exploitResults.filter((r) => !r.allowed).length;
    expect(deniedCount).toBeGreaterThan(0);

    // ───────────────────────────────────────────────────────────────────────
    // Phase 3: AUDIT — 4 agents, 20 req/min bucket
    // ───────────────────────────────────────────────────────────────────────
    const auditAgents = ["audit-scanner", "audit-prober", "audit-analyst", "audit-cloud"];
    const auditResults: { agent: string; allowed: boolean; remainingMs: number }[] = [];

    for (const agent of auditAgents) {
      // Each agent performs 5 audit actions (20 total, exactly at limit)
      for (let i = 0; i < 5; i++) {
        const result = tryAcquire("AUDIT");
        auditResults.push({ agent, allowed: result.allowed, remainingMs: result.remainingMs });
        markSuccess();
      }
    }

    // Verify all AUDIT actions were allowed (20 actions == 20/min limit)
    expect(auditResults.every((r) => r.allowed)).toBe(true);

    // ───────────────────────────────────────────────────────────────────────
    // Phase 4: Circuit-Breaker Trip — simulate >5% error rate
    // ───────────────────────────────────────────────────────────────────────
    // Record 95 successes, then 6 errors (6/101 = 5.94% > 5% threshold)
    for (let i = 0; i < 95; i++) {
      markSuccess();
    }
    for (let i = 0; i < 6; i++) {
      markError();
    }

    const circuitState = getState().circuit;
    expect(circuitState.tripped).toBe(true);
    expect(circuitState.errorRate).toBeGreaterThan(0.05);

    // ───────────────────────────────────────────────────────────────────────
    // Phase 5: WebSocket Telemetry — verify heartbeat and circuit_breaker events
    // ───────────────────────────────────────────────────────────────────────
    wsClient = await connectWs(41930, "/ws/swarm");
    const receivedEvents: unknown[] = [];

    wsClient.on("message", (data) => {
      receivedEvents.push(JSON.parse(data.toString()));
    });

    // Wait for events to arrive (buffer flush)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify we received telemetry events
    expect(receivedEvents.length).toBeGreaterThan(0);

    // Verify circuit_breaker event was emitted
    const circuitEvents = receivedEvents.filter((e: any) => e.type === "circuit_breaker");
    expect(circuitEvents.length).toBeGreaterThan(0);
    expect(circuitEvents[0]).toMatchObject({
      type: "circuit_breaker",
      payload: expect.objectContaining({
        tripped: true,
        errorRate: expect.any(Number),
      }),
    });

    // ───────────────────────────────────────────────────────────────────────
    // Phase 6: WatchdogUIBridge Health — verify /health/swarm endpoint
    // ───────────────────────────────────────────────────────────────────────
    const healthRes = await getJson(41930, "/health/swarm");
    expect(healthRes.status).toBe(200);

    const health = healthRes.json as any;
    expect(health.status).toBe("critical"); // circuit tripped
    expect(health.circuitBreaker.tripped).toBe(true);
    expect(Object.keys(health.cells)).toEqual(["RECON", "EXPLOITATION", "AUDIT"]);

    // ───────────────────────────────────────────────────────────────────────
    // Phase 7: Tool Catalog — verify full catalog structure
    // ───────────────────────────────────────────────────────────────────────
    const catalog = buildFullCatalog();
    expect(catalog.version).toBe("1.0.0");
    expect(catalog.capabilities.length).toBe(3); // RECON, EXPLOITATION, AUDIT

    const toolCounts = getToolCountByCell();
    expect(toolCounts.RECON).toBeGreaterThan(0);
    expect(toolCounts.EXPLOITATION).toBeGreaterThan(0);
    expect(toolCounts.AUDIT).toBeGreaterThan(0);

    // Verify total tool count (64 tools from CaySoc + Chimera9 + 1toolkit)
    expect(FULL_TOOL_CATALOG.length).toBeGreaterThanOrEqual(60);
  });

  it("validates JSON-RPC dispatch with rate-limited responses", async () => {
    // Exhaust EXPLOITATION bucket
    for (let i = 0; i < 15; i++) {
      tryAcquire("EXPLOITATION");
    }

    // Send JSON-RPC request that should be rate-limited
    const res = await postJson(41930, {
      jsonrpc: JSONRPC_VERSION,
      id: 1,
      method: "toolkit.execute",
      params: {
        namespacedName: "exploitation:breacher",
        parameters: { target: "10.0.0.1", service: "ssh" },
        runContext: { agentId: "a-1", runId: "r-1", companyId: "c-1", projectId: "p-1" },
      },
    });

    // Verify rate-limit response
    expect(res.json).toMatchObject({
      jsonrpc: JSONRPC_VERSION,
      id: 1,
      error: {
        code: JSONRPC_ERROR_CODES.SWARM_RATE_LIMITED,
        message: expect.stringContaining("Rate limit exceeded"),
      },
    });
  });
});
