/**
 * JSON-RPC 2.0 protocol primitives for the MCP Swarm layer.
 *
 * The wire format is intentionally minimal: every request carries an
 * integer `id`, a `method` string, and an optional `params` object. Responses
 * are either success envelopes or error objects with a numeric code and a
 * machine-readable `data` payload. This keeps the Python side able to
 * validate with Pydantic without a shared IDL.
 */

export const JSONRPC_VERSION = "2.0" as const;

/** Standard JSON-RPC 2.0 error codes. */
export const JSONRPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SWARM_RATE_LIMITED: -32099,
  SWARM_CIRCUIT_OPEN: -32098,
  SWARM_UNAUTHORIZED: -32097,
} as const;

export type JsonRpcErrorCode = (typeof JSONRPC_ERROR_CODES)[keyof typeof JSONRPC_ERROR_CODES];

/** A single JSON-RPC 2.0 request envelope. */
export interface JsonRpcRequest {
  jsonrpc: typeof JSONRPC_VERSION;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/** A JSON-RPC 2.0 error object. */
export interface JsonRpcErrorObject {
  code: JsonRpcErrorCode;
  message: string;
  data?: Record<string, unknown>;
}

/** A JSON-RPC 2.0 success response. */
export interface JsonRpcSuccess {
  jsonrpc: typeof JSONRPC_VERSION;
  id: number | string;
  result: unknown;
}

/** A JSON-RPC 2.0 error response. */
export interface JsonRpcError {
  jsonrpc: typeof JSONRPC_VERSION;
  id: number | string | null;
  error: JsonRpcErrorObject;
}

/** Union of both response shapes. */
export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

/** Build a success response. */
export function successResponse(id: number | string, result: unknown): JsonRpcSuccess {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

/** Build an error response. */
export function errorResponse(
  id: number | string | null,
  code: JsonRpcErrorCode,
  message: string,
  data?: Record<string, unknown>,
): JsonRpcError {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: { code, message, data },
  };
}

/** Validate that an unknown payload is a well-formed JSON-RPC request. */
export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.jsonrpc === JSONRPC_VERSION &&
    (typeof v.id === "number" || typeof v.id === "string") &&
    typeof v.method === "string"
  );
}