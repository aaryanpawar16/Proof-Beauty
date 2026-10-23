import fs from "node:fs/promises";
import path from "node:path";
import { cfg } from "./config";

/** Short-TTL, on-disk session storage. Photos are deleted on request or when the TTL lapses. */
const ID_RE = /^[a-f0-9]{12,40}$/;
const NAME_RE = /^[a-z0-9_.-]{1,64}$/i;

export const isValidId = (id: string) => ID_RE.test(id);
export const isValidName = (n: string) => NAME_RE.test(n) && !n.includes("..");

const sessionsDir = () => path.join(cfg.dataDir, "sessions");
export const sessionDir = (id: string) => path.join(sessionsDir(), id);

export async function ensureSession(id: string) {
  await fs.mkdir(sessionDir(id), { recursive: true });
  await fs.writeFile(path.join(sessionDir(id), "meta.json"), JSON.stringify({ created: Date.now() }));
}

export async function saveFile(id: string, name: string, data: Buffer | string) {
  if (!isValidId(id) || !isValidName(name)) throw new Error("bad path");
  await fs.writeFile(path.join(sessionDir(id), name), data);
  return fileUrl(id, name);
}

export async function readFile(id: string, name: string): Promise<Buffer | null> {
  if (!isValidId(id) || !isValidName(name)) return null;
  try {
    return await fs.readFile(path.join(sessionDir(id), name));
  } catch {
    return null;
  }
}

export const fileUrl = (id: string, name: string) => `/api/files/${id}/${name}`;

export async function deleteSession(id: string) {
  if (!isValidId(id)) return false;
  await fs.rm(sessionDir(id), { recursive: true, force: true });
  return true;
}

export async function purgeExpired() {
  try {
    const dirs = await fs.readdir(sessionsDir());
    const now = Date.now();
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
    /* no sessions yet */
  }
}

/** Analysis cache keyed by image hash (JSON only, never the photo itself). Shares the session TTL. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
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

export async function cacheSet(key: string, value: unknown) {
  const dir = path.join(cfg.dataDir, "cache");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify(value));
}

export async function clearCache() {
  await fs.rm(path.join(cfg.dataDir, "cache"), { recursive: true, force: true });
}
