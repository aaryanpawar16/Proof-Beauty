import { CONCERNS, CONCERN_LIST } from "@/lib/concerns";
import { hexToLab } from "@/lib/color";
import type { ConcernId, ConcernScores, Effect, ToneReading } from "@/lib/types";
import { cfg } from "./config";
import { EngineError, type AnalyzeHint, type Engine, type ImageRef, type RenderOut } from "./engine";
import { fetchBuffer } from "./imaging";
import { markExhausted, spend } from "./ledger";

/**
 * YouCam API v2 adapter. All payload shapes live here, so if the docs and reality disagree
 * (run `npm run probe` to see raw responses), this is the only file to touch.
 *
 * Flow per feature: POST /file/{feature} -> PUT bytes -> POST /task/{feature} -> GET /task/{feature}/{id}
 */

type Feature = "skin-analysis" | "skin-tone-analysis" | "makeup-vto";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${cfg.apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok || (typeof json.status === "number" && json.status >= 400)) {
    if (/credit/i.test(String(json.error_code ?? "")) || /enough credits/i.test(String(json.error ?? ""))) await markExhausted();
    throw new EngineError(friendlyError(json, res.status), String(json.error_code ?? json.code ?? res.status), json);
  }
  return json.data ?? json;
}

/** Turn YouCam error codes into something a person can act on. */
export function friendlyError(json: any, status?: number): string {
  const code = String(json?.error_code ?? json?.code ?? json?.error ?? "").toLowerCase();
  const msg = String(json?.error ?? json?.message ?? "");
  if (/face.*(small|far)|too_small/.test(code + msg)) return "YouCam couldn't read your face. It's too small in the frame even after auto-cropping. Try a closer photo.";
  if (/angle|tilt|turn|pose/.test(code + msg)) return "Your head is tilted or turned too far. Face the camera straight on.";
  if (/face.*(large|big|close)|too_large|too_big/.test(code + msg)) return "Your face fills too much of the frame. Step back a little.";
  if (/no_face|face_not_found|no face/.test(code + msg)) return "We couldn't find a face. Face the camera in even light.";
  if (/light|dark|bright|exposure/.test(code + msg)) return "The lighting is off. Face a window, avoid harsh shadows.";
  if (/resolution|size|too_large|too_small_image/.test(code + msg)) return "That image's resolution is outside the allowed range.";
  if (/unit|credit|quota|insufficient/.test(code + msg)) {
    return "Your YouCam account is out of credits. Add credits in the YouCam console, or run with FORCE_DEMO=1 to use the free demo mode.";
  }
  if (status === 401 || status === 403) return "YouCam rejected the API key. Check YOUCAM_API_KEY.";
  if (status === 429) return "YouCam rate limit hit. Wait a moment and retry.";
  return msg || `YouCam request failed${status ? ` (${status})` : ""}.`;
}

const uploads = new Map<string, Promise<string>>();

/** One upload per (feature, image): K parallel candidates share a single file_id. */
function upload(feature: Feature, src: ImageRef): Promise<string> {
  const key = `${feature}:${src.hash}`;
  let p = uploads.get(key);
  if (!p) {
    p = uploadFile(feature, src.buf);
    p.catch(() => uploads.delete(key));
    uploads.set(key, p);
  }
  return p;
}

async function uploadFile(feature: Feature, buf: Buffer): Promise<string> {
  const data = await call(`/file/${feature}`, {
    method: "POST",
    body: JSON.stringify({
      files: [{ content_type: "image/jpeg", file_name: "selfie.jpg", file_size: buf.length }],
    }),
  });
  const file = data.files?.[0];
  const req = file?.requests?.[0];
  if (!file?.file_id || !req?.url) throw new EngineError("Unexpected file API response", "bad_file_response", data);
  const put = await fetch(req.url, {
    method: req.method || "PUT",
    headers: { "Content-Type": "image/jpeg", ...(req.headers ?? {}) },
    body: new Uint8Array(buf),
  });
  if (!put.ok) throw new EngineError(`Upload failed (${put.status})`, "upload_failed");
  return file.file_id as string;
}

async function runTask(feature: Feature, body: Record<string, unknown>, costKey: keyof typeof cfg.cost) {
  const created = await call(`/task/${feature}`, { method: "POST", body: JSON.stringify(body) });
  const taskId: string | undefined = created.task_id ?? created.id;
  if (!taskId) throw new EngineError("No task_id returned", "no_task_id", created);
  await spend(feature, cfg.cost[costKey]);

  const started = Date.now();
  let delay = 1200;
  while (Date.now() - started < 150_000) {
    await sleep(delay);
    delay = Math.min(delay + 400, 3000);
    const r = await call(`/task/${feature}/${encodeURIComponent(taskId)}`, { method: "GET" });
    if (r.task_status === "success") return r;
    if (r.task_status === "error") {
      throw new EngineError(friendlyError(r, undefined), String(r.error_code ?? r.error ?? "task_error"), r);
    }
  }
  throw new EngineError("YouCam task timed out.", "timeout");
}

/* ------------------------------ parsing ------------------------------ */

const ACTION_TO_CONCERN: Record<string, ConcernId> = Object.fromEntries(
  CONCERN_LIST.flatMap((c) => [
    [c.apiAction, c.id],
    [`hd_${c.apiAction}`, c.id],
    [c.apiAction.replace(/_v\d+$/, ""), c.id],
    [c.id, c.id],
  ]),
);
ACTION_TO_CONCERN["droopy_lower_eyelid"] = "droopy_eyelid";
ACTION_TO_CONCERN["dark_circle"] = "dark_circle";

/** The number we score on for one result entry: raw_score by default (see config.scoreField), else ui_score. */
function pickScore(o: Record<string, any>): number | undefined {
  const v = cfg.scoreField === "raw_score" && typeof o.raw_score === "number" ? o.raw_score : (o.ui_score ?? o.score);
  return typeof v === "number" ? Math.max(0, Math.min(100, v)) : undefined;
}

/** Walks any response shape and collects { type, score } entries. */
export function collectScores(node: unknown, acc = { scores: {} as ConcernScores, overlays: {} as Record<string, string[]>, overall: undefined as number | undefined }) {
  if (Array.isArray(node)) node.forEach((n) => collectScores(n, acc));
  else if (node && typeof node === "object") {
    const o = node as Record<string, any>;
    const picked = typeof o.type === "string" ? pickScore(o) : undefined;
    if (picked !== undefined) {
      const score = picked;
      const id = ACTION_TO_CONCERN[o.type];
      if (id) {
        // droopy lids appear twice; keep the worse (lower) healthy-score
        acc.scores[id] = acc.scores[id] === undefined ? score : Math.min(acc.scores[id]!, score);
        const urls = o.mask_urls ?? o.mask_url ?? o.overlay_urls;
        if (urls) acc.overlays[id] = ([] as string[]).concat(urls);
      } else if (/all|overall|total/.test(o.type)) acc.overall = score;
    }
    Object.values(o).forEach((v) => typeof v === "object" && collectScores(v, acc));
  }
  return acc;
}

const HEX_RE = /^#?[0-9a-f]{6}$/i;
function findColor(node: unknown, keyRe: RegExp, notRe?: RegExp): string | undefined {
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (keyRe.test(k) && !(notRe && notRe.test(k))) {
      if (typeof v === "string" && HEX_RE.test(v)) return `#${v.replace("#", "").toUpperCase()}`;
      if (Array.isArray(v) && v.length >= 3 && v.every((n) => typeof n === "number")) {
        return "#" + v.slice(0, 3).map((n) => Math.round(n as number).toString(16).padStart(2, "0")).join("").toUpperCase();
      }
      const nested = findColor(v, /hex|color|colour|value|rgb/i);
      if (nested) return nested;
    }
    if (typeof v === "object") {
      const hit = findColor(v, keyRe, notRe);
      if (hit) return hit;
    }
  }
}

export function parseTone(data: unknown): ToneReading | null {
  const skin = findColor(data, /skin/i);
  if (!skin) return null;
  return {
    skinHex: skin,
    lab: hexToLab(skin),
    source: "api",
    eyeHex: findColor(data, /eye/i, /brow|lash/i),
    eyebrowHex: findColor(data, /brow/i),
    lipHex: findColor(data, /lip/i),
    hairHex: findColor(data, /hair/i),
  };
}

function findUrl(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (typeof v === "string" && /^https?:\/\//.test(v) && /url|output|result/i.test(k)) return v;
    if (typeof v === "object") {
      const hit = findUrl(v);
      if (hit) return hit;
    }
  }
}

/* ------------------------- makeup-vto payloads ------------------------- */

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Our roles -> YouCam `effects`, per the published per-category schema (see src/lib/patterns.ts).
 * Roles that map to the same category are merged into ONE effect: the strongest colour/intensity wins,
 * coverage/underEye take the max, and glow takes the min (so a matte role keeps the finish matte).
 */
export function buildVtoEffects(effects: Effect[]): Record<string, unknown>[] {
  const byCat = new Map<string, Effect[]>();
  for (const e of effects) byCat.set(e.category, [...(byCat.get(e.category) ?? []), e]);

  const out: Record<string, unknown>[] = [];
  for (const [category, group] of byCat) {
    const lead = [...group].sort((a, b) => b.intensity - a.intensity)[0];
    const max = (f: (e: Effect) => number) => Math.max(...group.map(f));
    const min = (f: (e: Effect) => number) => Math.min(...group.map(f));

    switch (category) {
      case "concealer":
        out.push({
          category,
          palettes: [{
            color: lead.color,
            colorIntensity: clamp100(max((e) => e.intensity)),
            colorUnderEyeIntensity: clamp100(max((e) => e.intensity * (e.params?.underEye ?? 1))),
            coverageLevel: clamp100(max((e) => e.intensity * (e.params?.coverage ?? 0.8))),
          }],
        });
        break;
      case "foundation":
        out.push({
          category,
          palettes: [{
            color: lead.color,
            colorIntensity: clamp100(max((e) => e.intensity)),
            glowIntensity: clamp100(min((e) => e.params?.glow ?? 30)),
            coverageIntensity: clamp100(max((e) => e.intensity * (e.params?.coverage ?? 0.7))),
          }],
        });
        break;
      case "skin_smooth":
        out.push({
          category,
          skinSmoothStrength: clamp100(max((e) => e.intensity)),
          skinSmoothColorIntensity: clamp100(max((e) => e.intensity * (e.params?.smooth ?? 0.8))),
        });
        break;
      case "blush":
        out.push({
          category,
          pattern: { name: lead.pattern ?? "2colors6" },
          palettes: [{ color: lead.color, texture: lead.texture === "gloss" ? "satin" : lead.texture, colorIntensity: clamp100(lead.intensity) }],
        });
        break;
      default: // pattern-based categories (bronzer, contour, …): pattern + a colour palette
        out.push({
          category,
          pattern: { name: lead.pattern ?? "1" },
          palettes: [{ color: lead.color, colorIntensity: clamp100(lead.intensity) }],
        });
    }
  }
  return out;
}

/* ------------------------------- engine ------------------------------- */

export const liveEngine: Engine = {
  mode: "live",

  async analyze(src: ImageRef, concerns: ConcernId[], _hint?: AnalyzeHint) {
    const actions = [...new Set(concerns.map((c) => CONCERNS[c].apiAction))];
    const base: Record<string, unknown> = {
      dst_actions: actions, // all SD names: HD and SD can't be mixed in one request
      miniserver_args: { enable_mask_overlay: true },
      format: "json",
    };
    // Always upload the bytes (we already have them). Passing the render's URL back as src_file_url fails with
    // `error_download_image`: YouCam's analysis service can't fetch its own presigned S3 render links.
    base.src_file_id = await upload("skin-analysis", src);

    const result = await runTask("skin-analysis", base, "skin");
    const { scores, overlays, overall } = collectScores(result.results ?? result);
    if (!Object.keys(scores).length) {
      throw new EngineError("Skin analysis returned no concern scores.", "empty_analysis", result);
    }
    return { scores, overlays, overall };
  },

  async tone(src: ImageRef) {
    const id = await upload("skin-tone-analysis", src);
    const result = await runTask("skin-tone-analysis", { src_file_id: id, format: "json" }, "tone");
    const t = parseTone(result.results ?? result);
    if (!t) throw new EngineError("Couldn't read skin tone from the response.", "empty_tone", result);
    return t;
  },

  async render(src: ImageRef, effects: Effect[]): Promise<RenderOut> {
    const body: Record<string, unknown> = {
      version: "1.0",
      effects: buildVtoEffects(effects),
    };
    if (src.remoteUrl) body.src_file_url = src.remoteUrl;
    else body.src_file_id = await upload("makeup-vto", src);

    const result = await runTask("makeup-vto", body, "vto");
    const url = findUrl(result.results ?? result);
    if (!url) throw new EngineError("Makeup render returned no image URL.", "empty_render", result);
    return { buf: await fetchBuffer(url), remoteUrl: url };
  },
};
