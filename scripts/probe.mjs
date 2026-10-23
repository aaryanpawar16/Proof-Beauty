// Day-one feasibility probe. Spends ~51 YouCam credits (3x skin-analysis @10, 1x tone @20, 1x makeup-vto @1). Usage:
//   npm run probe -- path/to/selfie.jpg --yes
//
// Answers, with your real key:
//   1. Does skin-analysis return sane scores, and which direction is "better"? (UI_SCORE_HIGHER_IS_BETTER)
//   2. Test-retest noise: same photo twice -> how much do scores wander? (NOISE_BAND)
//   3. Does skin-tone-analysis return parseable colours?
//   4. Does makeup-vto accept our payload shape?
//   5. Does skin-analysis accept a makeup-vto render URL and return sane results?
// Raw responses are saved to .data/probe/ so you can fix src/server/youcam.ts if shapes differ.

import fs from "node:fs";
import path from "node:path";

const env = {};
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = env.YOUCAM_API_KEY || process.env.YOUCAM_API_KEY;
const BASE = (env.YOUCAM_API_BASE || "https://yce-api-01.makeupar.com/s2s/v2.0").replace(/\/$/, "");
const photo = process.argv[2];

if (!KEY) { console.error("Set YOUCAM_API_KEY in .env.local first."); process.exit(1); }
if (!photo || !fs.existsSync(photo)) { console.error("Usage: npm run probe -- path/to/selfie.jpg --yes"); process.exit(1); }
if (!process.argv.includes("--yes")) {
  console.error("This spends roughly 51 credits (3x skin-analysis at ~10, 1x tone at 20, 1x makeup-vto at 1). Most of the answers it gives you are already known; only run it on a new account or key.\nRe-run with --yes to proceed.");
  process.exit(1);
}

const out = path.join(".data", "probe");
fs.mkdirSync(out, { recursive: true });
const save = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(p, init = {}) {
  const res = await fetch(BASE + p, { ...init, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(`${p} -> ${res.status}`), { json });
  return json;
}

async function upload(feature, buf) {
  const j = await call(`/file/${feature}`, { method: "POST", body: JSON.stringify({ files: [{ content_type: "image/jpeg", file_name: "probe.jpg", file_size: buf.length }] }) });
  save(`file-${feature}.json`, j);
  const f = (j.data ?? j).files?.[0];
  const r = f?.requests?.[0];
  if (!f?.file_id || !r?.url) throw new Error(`Unexpected file response for ${feature}; see .data/probe/file-${feature}.json`);
  const put = await fetch(r.url, { method: r.method || "PUT", headers: { "Content-Type": "image/jpeg", ...(r.headers ?? {}) }, body: buf });
  if (!put.ok) throw new Error(`upload PUT failed ${put.status}`);
  return f.file_id;
}

async function task(feature, body, label) {
  const c = await call(`/task/${feature}`, { method: "POST", body: JSON.stringify(body) });
  const id = (c.data ?? c).task_id;
  if (!id) { save(`${label}-create.json`, c); throw new Error(`no task_id for ${feature}; see ${label}-create.json`); }
  for (let i = 0; i < 80; i++) {
    await sleep(2000);
    const r = await call(`/task/${feature}/${encodeURIComponent(id)}`);
    const d = r.data ?? r;
    if (d.task_status === "success") { save(`${label}.json`, r); return d; }
    if (d.task_status === "error") { save(`${label}.json`, r); throw new Error(`${feature} task error: ${JSON.stringify(d.error ?? d)}`); }
  }
  throw new Error("timeout");
}

function scores(node, acc = {}) {
  if (Array.isArray(node)) node.forEach((n) => scores(n, acc));
  else if (node && typeof node === "object") {
    // keep both: ui_score is a compressed display value, raw_score is far more sensitive (see SCORE_FIELD)
    if (typeof node.type === "string" && typeof node.ui_score === "number") acc[node.type] = { ui: node.ui_score, raw: typeof node.raw_score === "number" ? +node.raw_score.toFixed(1) : null };
    Object.values(node).forEach((v) => typeof v === "object" && scores(v, acc));
  }
  return acc;
}
function findUrl(node) {
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string" && /^https?:\/\//.test(v) && /url|output|result/i.test(k)) return v;
    if (typeof v === "object") { const h = findUrl(v); if (h) return h; }
  }
}

const buf = fs.readFileSync(photo);
const ACTIONS = ["acne", "dark_circle_v2", "redness", "age_spot", "oiliness", "pore", "texture", "wrinkle", "eye_bag"];
const skinBody = (extra) => ({ dst_actions: ACTIONS, miniserver_args: { enable_mask_overlay: true }, format: "json", ...extra });

try {
  console.log("1/5 skin-analysis (run A)…");
  const skinId = await upload("skin-analysis", buf);
  const a = scores((await task("skin-analysis", skinBody({ src_file_id: skinId }), "skin-A")).results);
  console.log("2/5 skin-analysis (run B: near-identical photo, +3% brightness, re-encoded; test-retest)…");
  // Identical bytes give identical scores (no noise to measure), so perturb the photo the way real retakes differ.
  const { createRequire } = await import("node:module");
  const sharp = createRequire(import.meta.url)("sharp");
  const bufB = await sharp(buf).modulate({ brightness: 1.03 }).jpeg({ quality: 88 }).toBuffer();
  const skinIdB = await upload("skin-analysis", bufB);
  const b = scores((await task("skin-analysis", skinBody({ src_file_id: skinIdB }), "skin-B")).results);

  console.log("\nConcern            ui A/B      raw A/B        |Δui|  |Δraw|");
  const dUi = [], dRaw = [];
  for (const k of Object.keys(a)) {
    const x = a[k], y = b[k];
    if (!x || !y) continue;
    const du = Math.abs(x.ui - y.ui), dr = x.raw != null && y.raw != null ? Math.abs(x.raw - y.raw) : NaN;
    dUi.push(du); if (!Number.isNaN(dr)) dRaw.push(dr);
    console.log(`${k.padEnd(18)} ${`${x.ui}/${y.ui}`.padEnd(10)}  ${`${x.raw}/${y.raw}`.padEnd(14)} ${du.toFixed(1).padStart(5)}  ${Number.isNaN(dr) ? "  —" : dr.toFixed(1).padStart(5)}`);
  }
  if (!Object.keys(a).length) console.log("(no scores parsed. Inspect .data/probe/skin-A.json and adjust collectScores in src/server/youcam.ts)");
  if (dRaw.length) {
    const max = Math.max(...dRaw), mean = dRaw.reduce((s, x) => s + x, 0) / dRaw.length;
    console.log(`\nraw_score noise: mean |Δ| = ${mean.toFixed(2)}, max |Δ| = ${max.toFixed(2)}  ->  suggested NOISE_BAND ≈ ${Math.ceil(max)} (with SCORE_FIELD=raw_score)`);
  }
  console.log("Direction check: if this face has visible dark circles/redness, are those scores LOW? (higher = healthier)\n  yes -> UI_SCORE_HIGHER_IS_BETTER=true (default)");

  console.log("\n3/5 skin-tone-analysis…");
  const toneId = await upload("skin-tone-analysis", buf);
  await task("skin-tone-analysis", { src_file_id: toneId, format: "json" }, "tone");
  console.log("   saved .data/probe/tone.json: check it contains skin/eye/lip/hair colours (parseTone in youcam.ts)");

  console.log("4/5 makeup-vto (blush / 2colors6, the docs example)…");
  const vtoId = await upload("makeup-vto", buf);
  const vto = await task("makeup-vto", {
    src_file_id: vtoId,
    version: "1.0",
    effects: [{ category: "blush", pattern: { name: "2colors6" }, palettes: [{ color: "#ff6f91", texture: "matte", colorIntensity: 50 }] }],
  }, "vto");
  const url = findUrl(vto.results ?? vto);
  console.log("   render url:", url ?? "(none found; inspect vto.json)");

  if (url) {
    console.log("5/5 skin-analysis on the render (uploaded as bytes; passing the render URL fails with error_download_image)…");
    const renderBuf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const renderId = await upload("skin-analysis", renderBuf);
    const r = scores((await task("skin-analysis", skinBody({ src_file_id: renderId }), "skin-render")).results);
    console.log(Object.keys(r).length ? "   OK: skin-analysis accepts VTO renders. Scores (ui/raw):" : "   no scores parsed from render", r);
  }

  console.log("\nDone. Set NOISE_BAND from the raw_score noise above. See README for how SCORE_FIELD was chosen.");
} catch (e) {
  console.error("\nProbe stopped:", e.message);
  if (e.json) { save("error.json", e.json); console.error("Response saved to .data/probe/error.json"); }
  process.exit(1);
}
