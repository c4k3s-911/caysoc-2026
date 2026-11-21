import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  CELL_RATE_LIMITS,
  type CellName,
  cellBuckets,
  circuitBreaker,
  tryAcquire,
  markSuccess,
  markError,
  getState,
} from "../token-bucket.js";

describe("cell rate limits", () => {
  it("reports correct rates for all cells", () => {
    expect(CELL_RATE_LIMITS.RECON).toBe(50);
    expect(CELL_RATE_LIMITS.EXPLOITATION).toBe(10);
    expect(CELL_RATE_LIMITS.AUDIT).toBe(20);
  });
});

describe("token bucket", () => {
  const resetState = () => {
    cellBuckets.clear();
    circuitBreaker.errorCount = 0;
    circuitBreaker.successCount = 0;
    circuitBreaker.lastReset = Date.now();
    circuitBreaker.tripped = false;
    circuitBreaker.tripTime = null;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    resetState();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    resetState();
  });

  it("allows immediate consumption when bucket has tokens", () => {
    const cell: CellName = "RECON";
    const result = tryAcquire(cell);
    expect(result.allowed).toBe(true);
    expect(result.remainingMs).toBe(0);
    expect(result.cell).toBe(cell);
  });

  it("denies when bucket is exhausted", () => {
    // Drain the RECON bucket (3 burst tokens) plus a couple of extra calls
    for (let i = 0; i < 5; i++) {
      tryAcquire("RECON");
    }
    const result = tryAcquire("RECON");
    expect(result.allowed).toBe(false);
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it("refills tokens over time", () => {
    // Drain the EXPLOITATION bucket completely
    for (let i = 0; i < 10; i++) {
      tryAcquire("EXPLOITATION");
    }
    const before = tryAcquire("EXPLOITATION");
    expect(before.allowed).toBe(false);

    // Fast-forward one minute so the bucket refills
    vi.advanceTimersByTime(60_000);
    const after = tryAcquire("EXPLOITATION");
    expect(after.allowed).toBe(true);
    expect(after.remainingMs).toBe(0);
  });

  it("records success and error for circuit breaker", () => {
    // 90 successes + 5 errors = 5/95 ≈ 5.26% > 5% threshold
    for (let i = 0; i < 90; i++) {
      markSuccess();
    }
    for (let i = 0; i < 5; i++) {
      markError();
    }
    const state = getState();
    expect(state.circuit.errorRate).toBeGreaterThan(0.05);
    expect(state.circuit.tripped).toBe(true);
  });
});
