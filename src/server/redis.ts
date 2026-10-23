/**
 * Minimal Upstash-style Redis client over REST (no dependency). Vercel's Upstash/KV integration injects
 * KV_REST_API_URL + KV_REST_API_TOKEN; a bare Upstash database uses UPSTASH_REDIS_REST_URL / _TOKEN.
 * When neither is set the app falls back to local files (dev, or a single VM with a disk).
 */
/**
 * Vercel lets you give an integration a custom env prefix (e.g. `proofbeauty_KV_REST_API_URL`), so match on the suffix.
 * The read-only token is deliberately skipped: we need to write.
 */
function envBySuffix(suffix: string): string {
  const exact = process.env[suffix];
  if (exact) return exact;
  const key = Object.keys(process.env).find((k) => k.endsWith(`_${suffix}`) && process.env[k]);
  return key ? process.env[key]! : "";
}

const url = () => (envBySuffix("KV_REST_API_URL") || envBySuffix("UPSTASH_REDIS_REST_URL")).replace(/\/$/, "");
const token = () => envBySuffix("KV_REST_API_TOKEN") || envBySuffix("UPSTASH_REDIS_REST_TOKEN");

export const hasRedis = () => Boolean(url() && token());

type Cmd = (string | number)[];

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url() + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Redis ${res.status}: ${json?.error ?? "request failed"}`);
  return json as T;
}

export async function redis<T = unknown>(...cmd: Cmd): Promise<T> {
  const j = await call<{ result: T; error?: string }>("", cmd);
  if (j.error) throw new Error(`Redis: ${j.error}`);
  return j.result;
}

/** Runs the commands atomically (MULTI/EXEC) and returns each result. */
export async function redisTx(cmds: Cmd[]): Promise<unknown[]> {
  const j = await call<{ result?: unknown; error?: string }[]>("/multi-exec", cmds);
  return j.map((r) => {
    if (r.error) throw new Error(`Redis: ${r.error}`);
    return r.result;
  });
}
