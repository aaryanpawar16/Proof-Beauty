/**
 * Per-IP rate limit for the routes that spend YouCam credits (a full run is ~54 credits).
 * With Redis configured (required on Vercel) it is a fixed window shared by every instance. Without Redis it falls
 * back to an in-memory sliding window, which is per process: fine for one server or local dev, but on serverless each
 * instance would keep its own counts.
 *
 *   RATE_LIMIT_RUNS=3         runs allowed per IP per window (0 = off; default 3 in production, off in dev)
 *   RATE_LIMIT_WINDOW_MIN=60  window length in minutes
 *   TRUST_PROXY=1             read the client IP from X-Forwarded-For (set only behind a proxy that overwrites it)
 */
import { hasRedis, redisTx } from "./redis";

const hits = new Map<string, number[]>();

export interface RateDecision {
  ok: boolean;
  /** seconds until the oldest counted run falls out of the window (only meaningful when !ok) */
  retryAfterSec: number;
  remaining: number;
}

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): RateDecision {
  if (max <= 0) return { ok: true, retryAfterSec: 0, remaining: Infinity };
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)), remaining: 0 };
  }
  recent.push(now);
  hits.set(key, recent);
  // keep the map from growing forever
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return { ok: true, retryAfterSec: 0, remaining: max - recent.length };
}

export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const fwd = req.headers.get("x-forwarded-for");
    // the proxy appends the real client last; anything before it is client-supplied
    const last = fwd?.split(",").map((s) => s.trim()).filter(Boolean).pop();
    if (last) return last;
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return "local";
}

/** Fixed-window counter in Redis, shared by every serverless instance (the in-memory limiter is per instance). */
async function rateLimitRedis(key: string, max: number, windowMs: number, now = Date.now()): Promise<RateDecision> {
  if (max <= 0) return { ok: true, retryAfterSec: 0, remaining: Infinity };
  const bucket = Math.floor(now / windowMs);
  const k = `pb:rl:${key}:${bucket}`;
  const [count] = (await redisTx([["INCR", k], ["EXPIRE", k, Math.ceil(windowMs / 1000) + 5]])) as [number, unknown];
  if (count > max) return { ok: false, retryAfterSec: Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000)), remaining: 0 };
  return { ok: true, retryAfterSec: 0, remaining: max - count };
}

/** Returns a 429 Response if this caller is over the limit, otherwise null. */
export async function limitOrNull(req: Request, scope: string, weight = 1): Promise<Response | null> {
  // on by default only in production builds, so local dev isn't throttled
  const max = Number(process.env.RATE_LIMIT_RUNS ?? (process.env.NODE_ENV === "production" ? 3 : 0));
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MIN ?? 60) * 60_000;
  const key = `${scope}:${clientIp(req)}`;
  // stage 2 is cheaper (~10 credits) so it is allowed more often than a full run
  const limit = Math.round(max * weight);
  let d: RateDecision;
  try {
    d = hasRedis() ? await rateLimitRedis(key, limit, windowMs) : rateLimit(key, limit, windowMs);
  } catch {
    d = rateLimit(key, limit, windowMs); // Redis hiccup: degrade to the per-instance limiter rather than open the gate
  }
  if (d.ok) return null;
  return Response.json(
    { error: `Rate limit reached to protect the shared credit pool. Try again in ${Math.ceil(d.retryAfterSec / 60)} min.` },
    { status: 429, headers: { "Retry-After": String(d.retryAfterSec) } },
  );
}

/** test helper */
export const _resetRateLimit = () => hits.clear();
