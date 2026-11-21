/**
 * Per-cell token-bucket rate limiter for the MCP Swarm layer.
 *
 * Three cells are defined:
 *   • Recon (OSINT) — hot cell, 50 requests/minute with generous jitter
 *   • Exploitation — strict cell, 10 requests/minute with jitter to avoid EDR anomaly thresholds
 *   • Audit & Oversight — relaxed cell, 20 requests/minute steady
 *
 * Global circuit breaker trips when aggregate error rate across all cells
 * exceeds 5% over a rolling 1‑minute window. On trip the swarm rejects
 * new requests for 1 minute; after the cooldown the breaker resets and
 * new requests flow again.
 *
 * All rates are expressed per-agent — the dispatcher multiplies by the
 * number of active agents in the cell before computing the bucket fill.
 *
 * The algorithm:
 *   - Tokens fill at `rate` tokens per second.
 *   - Consuming a request deducts one token; if none are available the
 *     request is rejected immediately (no back‑off, no queue).
 *   - Jitter adds a random offset to the refill interval so that bursts
 *     across many agents don't synchronise and spike the error surface.
 */

import { logger } from "../middleware/logger.js";

export const CELL_RATE_LIMITS = {
  /** OSINT / Reconnaissance cell — high‑throughput. */
  RECON: 50,
  /** Exploitation cell — strict, avoids triggering EDR heuristics. */
  EXPLOITATION: 10,
  /** Audit & GRC cell — steady medium‑throughput. */
  AUDIT: 20,
} as const;

export type CellName = keyof typeof CELL_RATE_LIMITS;

/** Token‑bucket state for a single cell. */
interface BucketState {
  tokens: number;
  lastRefill: number;
}

/** Global circuit‑breaker state shared across all cells. */
interface CircuitBreakerState {
  errorCount: number;
  successCount: number;
  lastReset: number;
  tripped: boolean;
  tripTime: number | null;
}

const DEFAULT_BUCKET_TOKENS = 3; // short burst allowance
const DEFAULT_REFILL_INTERVAL_MS = 60_000; // 1 minute window
const CIRCUIT_BREAKER_ERROR_RATE = 0.05; // 5%
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000; // 1 minute
// Never trip on a tiny sample: a single failed tool call must not open the
// breaker for the whole swarm.
const CIRCUIT_BREAKER_MIN_SAMPLES = 20;

/** @internal exported for the unit test harness; not part of the public API. */
export const cellBuckets = new Map<CellName, BucketState>();

/** @internal exported for the unit test harness; not part of the public API. */
export const circuitBreaker: CircuitBreakerState = {
  errorCount: 0,
  successCount: 0,
  lastReset: Date.now(),
  tripped: false,
  tripTime: null,
};

function initCellBucket(cell: CellName): void {
  if (cellBuckets.has(cell)) return;
  cellBuckets.set(cell, {
    tokens: DEFAULT_BUCKET_TOKENS,
    lastRefill: Date.now(),
  });
}

function refillCellBucket(cell: CellName): void {
  const bucket = cellBuckets.get(cell)!;
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const rate = cellRate(cell);

  // Fill tokens based on elapsed time; cap at max burst
  const fill = Math.max(0, Math.floor((elapsed / DEFAULT_REFILL_INTERVAL_MS) * rate));
  bucket.tokens = Math.min(rate + DEFAULT_BUCKET_TOKENS, bucket.tokens + fill);
  bucket.lastRefill = now;
}

function cellRate(cell: CellName): number {
  return CELL_RATE_LIMITS[cell];
}

/** Attempt to consume a token from the cell bucket. Returns true on success. */
function tryConsumeCell(cell: CellName): boolean {
  initCellBucket(cell);
  refillCellBucket(cell);
  const bucket = cellBuckets.get(cell)!;
  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

/** Record a successful tool execution. */
function recordSuccess(): void {
  const now = Date.now();
  const diff = now - (circuitBreaker.lastReset || now);
  // Slide window: if we've moved more than a minute, reset counters gracefully
  if (diff > DEFAULT_REFILL_INTERVAL_MS) {
    circuitBreaker.errorCount = 0;
    circuitBreaker.successCount = 0;
    circuitBreaker.lastReset = now;
  }
  circuitBreaker.successCount += 1;
  checkCircuitBreaker();
}

/** Record a failed tool execution. */
function recordError(): void {
  const now = Date.now();
  const diff = now - (circuitBreaker.lastReset || now);
  if (diff > DEFAULT_REFILL_INTERVAL_MS) {
    circuitBreaker.errorCount = 0;
    circuitBreaker.successCount = 0;
    circuitBreaker.lastReset = now;
  }
  circuitBreaker.errorCount += 1;
  checkCircuitBreaker();
}

/** Trip the circuit breaker if error rate exceeds the threshold. */
function checkCircuitBreaker(): void {
  const total = circuitBreaker.errorCount + circuitBreaker.successCount;
  if (total < CIRCUIT_BREAKER_MIN_SAMPLES) return;
  const errorRate = circuitBreaker.errorCount / total;

  if (errorRate > CIRCUIT_BREAKER_ERROR_RATE && !circuitBreaker.tripped) {
    circuitBreaker.tripped = true;
    circuitBreaker.tripTime = Date.now();
    logger.warn(
      { errorCount: circuitBreaker.errorCount, successCount: circuitBreaker.successCount, errorRate },
      "Circuit breaker tripped — too many swarm errors",
    );
    // Schedule auto‑reset after cooldown
    setTimeout(() => {
      circuitBreaker.tripped = false;
      circuitBreaker.tripTime = null;
      circuitBreaker.errorCount = 0;
      circuitBreaker.successCount = 0;
      circuitBreaker.lastReset = Date.now();
      logger.info(
        { service: "mcp-swarm-rate" },
        "Circuit breaker reset — error rate back within threshold",
      );
    }, CIRCUIT_BREAKER_COOLDOWN_MS);
  }
}

/** Public API — try to execute a request within the rate‑limited swarm. */
export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the next token will be available (0 if allowed). */
  remainingMs: number;
  /** Human‑readable cell name. */
  cell: CellName;
}

/** Attempt to acquire a slot in the given cell. Returns { allowed, remainingMs, cell }. */
export function tryAcquire(cell: CellName): RateLimitResult {
  initCellBucket(cell);
  refillCellBucket(cell);
  const allowed = tryConsumeCell(cell);

  // One token is replenished every (window / rate) milliseconds.
  const remainingMs = allowed ? 0 : Math.ceil(DEFAULT_REFILL_INTERVAL_MS / cellRate(cell));

  // Success/error accounting is the caller's job: `tryAcquire` only asks for
  // permission, it does not know whether the tool execution succeeded.
  return { allowed, remainingMs, cell };
}

/** Public API — record that a tool execution succeeded. Call after each successful dispatch. */
export function markSuccess(): void {
  recordSuccess();
}

/** Public API — record that a tool execution failed (non‑rate‑limit error). Call after each failed dispatch. */
export function markError(): void {
  recordError();
}

/** Public API — get current bucket levels and circuit‑breaker state for observability. */
export function getState(): {
  cells: Record<CellName, { tokens: number; lastRefill: number }>;
  circuit: {
    tripped: boolean;
    errorRate: number;
    errorCount: number;
    successCount: number;
    timeRemainingMs: number;
  };
} {
  const cells: Record<CellName, { tokens: number; lastRefill: number }> = {
    RECON: { tokens: 0, lastRefill: 0 },
    EXPLOITATION: { tokens: 0, lastRefill: 0 },
    AUDIT: { tokens: 0, lastRefill: 0 },
  };
  for (const [cell, bucket] of cellBuckets) {
    cells[cell] = { tokens: bucket.tokens, lastRefill: bucket.lastRefill };
  }

  const total = circuitBreaker.errorCount + circuitBreaker.successCount;
  const errorRate = total === 0 ? 0 : circuitBreaker.errorCount / total;
  const timeRemainingMs =
    circuitBreaker.tripped
      ? Math.max(0, CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - (circuitBreaker.tripTime || 0)))
      : 0;

  return {
    cells,
    circuit: {
      tripped: circuitBreaker.tripped,
      errorRate,
      errorCount: circuitBreaker.errorCount,
      successCount: circuitBreaker.successCount,
      timeRemainingMs,
    },
  };
}