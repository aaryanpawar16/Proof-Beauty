import path from "node:path";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : d;
};

export const cfg = {
  apiKey: process.env.YOUCAM_API_KEY?.trim() || "",
  apiBase: (process.env.YOUCAM_API_BASE || "https://yce-api-01.makeupar.com/s2s/v2.0").replace(/\/$/, ""),
  budget: num(process.env.CREDIT_BUDGET, 1000),
  // YouCam credits per task, MEASURED from a real usage export (not guessed): skin-analysis ~10, skin-tone-analysis 20,
  // makeup-vto 1 per render. (The earlier default of 1 each undercounted a run by ~7x and burned the free pool.)
  cost: {
    skin: num(process.env.UNIT_COST_SKIN_ANALYSIS, 10),
    tone: num(process.env.UNIT_COST_SKIN_TONE, 20),
    vto: num(process.env.UNIT_COST_MAKEUP_VTO, 1),
  },
  // The tone API costs 20 credits (27% of a run), often fails on tilted faces, and we have a free local LAB fallback.
  // So it is opt-in: set USE_TONE_API=1 when you want YouCam's lighting-corrected tone (better shop shades).
  useToneApi: process.env.USE_TONE_API === "1" || process.env.USE_TONE_API === "true",
  higherIsBetter: (process.env.UI_SCORE_HIGHER_IS_BETTER ?? "true") !== "false",
  // Which YouCam field to score on. `ui_score` is a compressed display value (a visible makeup change moved it
  // only ~3 points); `raw_score` moved ~8-11 points for the same change with similar noise. Default: raw_score.
  scoreField: (process.env.SCORE_FIELD === "ui_score" ? "ui_score" : "raw_score") as "ui_score" | "raw_score",
  noiseBand: num(process.env.NOISE_BAND, 2),
  // Optional extra floor for the refinement trigger (0 = off). The main rule is "top concern not clearly improved".
  coverageTarget: num(process.env.COVERAGE_TARGET, 0),
  ttlMs: num(process.env.SESSION_TTL_MINUTES, 60) * 60_000,
  // Optional local LLM for the plain-language explanation. Set OLLAMA_MODEL= (empty) to disable.
  ollamaHost: (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, ""),
  ollamaModel: (process.env.OLLAMA_MODEL ?? "llama2").trim(),
  ollamaTimeoutMs: num(process.env.OLLAMA_TIMEOUT_MS, 60_000),
  dataDir: path.join(process.cwd(), ".data"),
};

/** FORCE_DEMO=1 runs the simulated engine even when a key is set: free UI demos without touching your credits. */
export const isLive = () => Boolean(cfg.apiKey) && process.env.FORCE_DEMO !== "1";
