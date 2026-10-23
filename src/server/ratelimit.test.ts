import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimit, rateLimit } from "./ratelimit";

const MIN = 60_000;

describe("rateLimit", () => {
  beforeEach(_resetRateLimit);

  it("allows up to max, then blocks with a retry time", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("a", 3, 60 * MIN, i * 1000).ok).toBe(true);
    const d = rateLimit("a", 3, 60 * MIN, 5000);
    expect(d.ok).toBe(false);
    expect(d.retryAfterSec).toBe(3595); // oldest hit at t=0 expires at 60 min
  });

  it("frees a slot once the oldest hit leaves the window", () => {
    rateLimit("a", 1, MIN, 0);
    expect(rateLimit("a", 1, MIN, 30_000).ok).toBe(false);
    expect(rateLimit("a", 1, MIN, MIN + 1).ok).toBe(true);
  });

  it("counts each key separately", () => {
    rateLimit("a", 1, MIN, 0);
    expect(rateLimit("b", 1, MIN, 0).ok).toBe(true);
  });

  it("does not count blocked attempts against the caller", () => {
    rateLimit("a", 1, MIN, 0);
    for (let t = 1; t < 10; t++) rateLimit("a", 1, MIN, t * 1000);
    expect(rateLimit("a", 1, MIN, MIN + 1).ok).toBe(true);
  });

  it("max <= 0 turns the limiter off", () => {
    for (let i = 0; i < 20; i++) expect(rateLimit("a", 0, MIN, i).ok).toBe(true);
  });
});
