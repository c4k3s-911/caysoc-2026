import { describe, expect, it } from "vitest";
import http from "node:http";
import { createMcpSwarmServer } from "../mcp-swarm/server.js";
import { JSONRPC_VERSION, JSONRPC_ERROR_CODES } from "../mcp-swarm/jsonrpc.js";

function post(port: number, body: unknown): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { host: "127.0.0.1", port, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
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

describe("MCP swarm server", () => {
  it("responds to ping with a JSON-RPC 2.0 success envelope", async () => {
    const server = createMcpSwarmServer({ port: 0 });
    await server.start();
    // Use a real ephemeral port by reading the actual address.
    const address = (server as unknown as { _addr?: { port: number } });
    // Fallback: the server listens on an ephemeral port; resolve via a probe.
    // We instead start on a fixed high port to keep the test deterministic.
    await server.stop();
    const s = createMcpSwarmServer({ port: 41913 });
    await s.start();
    const res = await post(41913, { jsonrpc: JSONRPC_VERSION, id: 1, method: "ping" });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ jsonrpc: JSONRPC_VERSION, id: 1, result: { ok: true } });
    await s.stop();
  });

  it("rejects malformed payloads with INVALID_REQUEST", async () => {
    const s = createMcpSwarmServer({ port: 41914 });
    await s.start();
    const res = await post(41914, { foo: "bar" });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: { code: JSONRPC_ERROR_CODES.INVALID_REQUEST } });
    await s.stop();
  });

  it("returns METHOD_NOT_FOUND for unknown methods", async () => {
    const s = createMcpSwarmServer({ port: 41915 });
    await s.start();
    const res = await post(41915, { jsonrpc: JSONRPC_VERSION, id: 2, method: "nope" });
    expect(res.json).toMatchObject({ error: { code: JSONRPC_ERROR_CODES.METHOD_NOT_FOUND } });
    await s.stop();
  });
});