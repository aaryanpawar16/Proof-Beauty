import fs from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { cfg } from "./config";
import { hasRedis, redis } from "./redis";

/**
 * Short-TTL session storage. Photos are deleted on request or when the TTL lapses.
 *
 * Two backends, picked from the environment:
 *   - Vercel Blob (private store) for photos/results + Redis for the analysis cache. Used on Vercel, where the disk is
 *     ephemeral and per-invocation. Needs BLOB_READ_WRITE_TOKEN (or BLOB_STORE_ID with OIDC) and a Redis REST URL.
 *   - Local disk under .data/ for `npm run dev` or a single VM with a persistent volume.
 */
const ID_RE = /^[a-f0-9]{12,40}$/;
const NAME_RE = /^[a-z0-9_.-]{1,64}$/i;

export const isValidId = (id: string) => ID_RE.test(id);
export const isValidName = (n: string) => NAME_RE.test(n) && !n.includes("..");

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

/** On Vercel the local disk silently loses data between requests, so refuse to run rather than half-work. */
function assertDurable() {
  if (process.env.VERCEL && !(useBlob() && hasRedis())) {
    throw new Error("Storage is not configured: connect a private Vercel Blob store and a Redis (Upstash) database to this project.");
  }
}

const blobPath = (id: string, name: string) => `sessions/${id}/${name}`;
const contentTypeOf = (name: string) => (name.endsWith(".png") ? "image/png" : name.endsWith(".json") ? "application/json" : "image/jpeg");

const sessionsDir = () => path.join(cfg.dataDir, "sessions");
export const sessionDir = (id: string) => path.join(sessionsDir(), id);

export const fileUrl = (id: string, name: string) => `/api/files/${id}/${name}`;

export async function ensureSession(id: string) {
  assertDurable();
  if (useBlob()) return; // blobs carry their own upload time, which is what the TTL purge uses
  await fs.mkdir(sessionDir(id), { recursive: true });
  await fs.writeFile(path.join(sessionDir(id), "meta.json"), JSON.stringify({ created: Date.now() }));
}

export async function saveFile(id: string, name: string, data: Buffer | string) {
  if (!isValidId(id) || !isValidName(name)) throw new Error("bad path");
  if (useBlob()) {
    await put(blobPath(id, name), data, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: contentTypeOf(name), cacheControlMaxAge: 60 });
  } else {
    await fs.writeFile(path.join(sessionDir(id), name), data);
  }
  return fileUrl(id, name);
}

export async function readFile(id: string, name: string): Promise<Buffer | null> {
  if (!isValidId(id) || !isValidName(name)) return null;
  try {
    if (useBlob()) {
      // a file can be overwritten (original.jpg is re-cropped, result.json is rewritten), so skip the CDN cache
      const r = await get(blobPath(id, name), { access: "private", useCache: false });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    }
    return await fs.readFile(path.join(sessionDir(id), name));
  } catch {
    return null;
  }
}

export async function deleteSession(id: string) {
  if (!isValidId(id)) return false;
  if (useBlob()) {
    const urls = await listBlobs(`sessions/${id}/`).then((bs) => bs.map((b) => b.url));
    if (urls.length) await del(urls);
  } else {
    await fs.rm(sessionDir(id), { recursive: true, force: true });
  }
  await clearSessionCache(id);
  return true;
}

async function listBlobs(prefix: string) {
  const out: { url: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export async function purgeExpired() {
  const now = Date.now();
  try {
    if (useBlob()) {
      const old = (await listBlobs("sessions/")).filter((b) => now - new Date(b.uploadedAt).getTime() > cfg.ttlMs).map((b) => b.url);
      for (let i = 0; i < old.length; i += 100) await del(old.slice(i, i + 100));
      return;
    }
    const dirs = await fs.readdir(sessionsDir());
    await Promise.all(
      dirs.map(async (d) => {
        try {
          const meta = JSON.parse(await fs.readFile(path.join(sessionsDir(), d, "meta.json"), "utf8"));
          if (now - meta.created > cfg.ttlMs) await fs.rm(path.join(sessionsDir(), d), { recursive: true, force: true });
        } catch {
          await fs.rm(path.join(sessionsDir(), d), { recursive: true, force: true });
        }
      }),
    );
  } catch {
    /* no sessions yet, or the store is briefly unavailable: the next run will purge */
  }
}

/* ---------------- analysis cache: JSON only, never the photo. Shares the session TTL. ---------------- */
const cacheKeyOf = (key: string) => `pb:cache:${key}`;
const sessionCacheSet = (id: string) => `pb:sesscache:${id}`;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (hasRedis()) {
      const raw = await redis<string | null>("GET", cacheKeyOf(key));
      return raw ? JSON.parse(raw) : null;
    }
    const p = path.join(cfg.dataDir, "cache", `${key}.json`);
    const st = await fs.stat(p);
    if (Date.now() - st.mtimeMs > cfg.ttlMs) {
      await fs.rm(p, { force: true });
      return null;
    }
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

/** `sessionId` ties the entry to the session so "Delete my photos" removes exactly that user's cached analysis. */
export async function cacheSet(key: string, value: unknown, sessionId?: string) {
  try {
    if (hasRedis()) {
      const ttl = Math.max(60, Math.round(cfg.ttlMs / 1000));
      await redis("SET", cacheKeyOf(key), JSON.stringify(value), "EX", ttl);
      if (sessionId) {
        await redis("SADD", sessionCacheSet(sessionId), key);
        await redis("EXPIRE", sessionCacheSet(sessionId), ttl);
      }
      return;
    }
    const dir = path.join(cfg.dataDir, "cache");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify(value));
  } catch {
    /* the cache is an optimisation; a failed write must never fail the run */
  }
}

async function clearSessionCache(id: string) {
  try {
    if (hasRedis()) {
      const keys = await redis<string[]>("SMEMBERS", sessionCacheSet(id));
      await redis("DEL", sessionCacheSet(id), ...keys.map(cacheKeyOf));
      return;
    }
    // local single-user dev: cache files are keyed by image hash, not session, so clear them all
    await fs.rm(path.join(cfg.dataDir, "cache"), { recursive: true, force: true });
  } catch {
    /* nothing cached */
  }
}
