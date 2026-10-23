import crypto from "node:crypto";
import { CONCERNS, CONCERN_LIST } from "@/lib/concerns";
import { planControl, planRound1, planRound2 } from "@/lib/planner";
import {
  DEFAULT_PARAMS,
  adjustedReduction,
  noiseFor,
  hasDoseHeadroom,
  pickBest,
  buildWeights,
  needsRefinement,
  scoreCandidate,
  severity,
  type ScoreParams,
} from "@/lib/scoring";
import type {
  Analysis,
  Candidate,
  ConcernId,
  EvaluatedCandidate,
  RunEvent,
  RunResult,
  Stage2Result,
  StepId,
} from "@/lib/types";
import { fmt } from "@/lib/format";
import { cfg, isLive } from "./config";
import type { Engine, ImageRef } from "./engine";
import { explainNow, explainReword } from "./explain";
import { centerCrop, displayJpeg, normalizeUpload, sampleFaceLab, sha } from "./imaging";
import { recordRun, unitsLeft } from "./ledger";
import { demoEngine } from "./mock";
import { cacheGet, cacheSet, ensureSession, fileUrl, purgeExpired, readFile, saveFile } from "./store";
import { liveEngine } from "./youcam";

const K = 3;
const MAX_ROUNDS = 2; // hard cap: protects the unit budget and keeps latency sane

export const getEngine = (): Engine => (isLive() ? liveEngine : demoEngine);

export const getParams = (): ScoreParams => ({
  ...DEFAULT_PARAMS,
  noiseBand: cfg.noiseBand,
  // Measured on near-identical photos (re-encode / 4px shift / +3% brightness), raw_score spread: dark circles 0.7,
  // eye bags 0.8, dark spots 0.5, shine 2.4. So shine needs a wider band than the rest. Only valid for raw_score.
  noiseByConcern: isLive() && cfg.scoreField === "raw_score" && process.env.NOISE_BAND === undefined ? { oiliness: 3.5, dark_circle: 1.5, eye_bag: 1.5, age_spot: 1.5 } : undefined,
  coverageTarget: cfg.coverageTarget,
  higherIsBetter: isLive() ? cfg.higherIsBetter : true,
});

/** Units a run can cost, so we can refuse before spending anything. */
export function estimateUnits(refine = false) {
  const base = cfg.cost.skin + (cfg.useToneApi ? cfg.cost.tone : 0);
  const perCandidate = cfg.cost.vto + cfg.cost.skin;
  // K real looks + 1 control (the integrity check) + optional refinement round of 2
  return base + (K + 1) * perCandidate + (refine ? 2 * perCandidate : 0);
}

const ALL_CONCERNS = CONCERN_LIST.map((c) => c.id);

export async function runLoop(opts: {
  rawImage: Buffer;
  ranked: ConcernId[];
  emit: (e: RunEvent) => void;
}): Promise<void> {
  const { emit } = opts;
  const engine = getEngine();
  const params = getParams();
  const live = engine.mode === "live";
  let used = 0;

  const step = (s: StepId, status: "active" | "done", detail?: string) => emit({ type: "step", step: s, status, detail });
  const bump = async (n: number) => {
    used += n;
    emit({ type: "units", used, left: live ? await unitsLeft() : cfg.budget });
  };

  await purgeExpired();

  const left = live ? await unitsLeft() : cfg.budget;
  const estimate = estimateUnits(true);
  emit({ type: "start", mode: engine.mode, budgetLeft: left, estimate, higherIsBetter: params.higherIsBetter });
  if (live && left < estimateUnits(false)) {
    emit({ type: "error", code: "budget", message: `Not enough credits left by the app's count (${left}) for a full run (~${estimateUnits(false)}). If you've added credits on YouCam, raise CREDIT_BUDGET in .env by that amount.` });
    return;
  }

  const norm = await normalizeUpload(opts.rawImage);
  const sessionId = crypto.randomBytes(8).toString("hex");
  await ensureSession(sessionId);
  const originalUrl = await saveFile(sessionId, "original.jpg", norm.buf);
  // `src` is the image actually analysed; it can be re-framed below if YouCam says the face is too small
  let src: ImageRef = { buf: norm.buf, hash: norm.hash };

  /* ---------- 1. baseline: skin concerns + tone ---------- */
  step("baseline", "active", "Measuring your skin concerns and tone");
  let drift = await sampleFaceLab(norm.buf);
  // the scoring field is part of the key so switching ui_score/raw_score never reuses a stale analysis
  const cacheKey = `base-${live ? `live-${cfg.scoreField}` : "demo"}-${norm.hash}`;
  type CachedBase = Pick<Analysis, "scores" | "overlays" | "tone" | "overall">;
  let base = await cacheGet<CachedBase>(cacheKey);
  if (base) {
    step("baseline", "active", "Reused a cached analysis of this exact photo, 0 units");
  } else {
    // YouCam's skin analysis rejects faces that are small in the frame (calibrated: needs roughly 55%+ of the
    // image width). The browser already crops to the face; if the face still isn't big enough (or wasn't
    // detected), retry with tighter centre crops, at most twice, so any face photo can complete the loop.
    const KEEP = [1, 0.72, 0.52];
    for (let i = 0; i < KEEP.length; i++) {
      if (i > 0) {
        step("baseline", "active", `YouCam says the face is too small, retrying with a tighter crop (${i}/${KEEP.length - 1})`);
        const cropped = await centerCrop(norm.buf, KEEP[i]);
        await saveFile(sessionId, "original.jpg", cropped.buf);
        src = { buf: cropped.buf, hash: cropped.hash };
        drift = await sampleFaceLab(cropped.buf);
      }
      try {
        const localTone = { skinHex: drift.hex, lab: drift.lab, source: "local" as const };
        // The tone API is opt-in (20 credits). Without it, tone is the free local LAB sample of the face region.
        const useTone = cfg.useToneApi && live;
        const [an, tone] = await Promise.all([
          engine.analyze(src, ALL_CONCERNS),
          useTone ? engine.tone(src).catch(() => localTone) : Promise.resolve(localTone),
        ]);
        // a tone task is billed when created even if it then fails (e.g. tilted face), so count it whenever attempted
        await bump(cfg.cost.skin + (useTone ? cfg.cost.tone : 0));
        base = { scores: an.scores, overlays: an.overlays, overall: an.overall, tone };
        if (i === 0) await cacheSet(cacheKey, base, sessionId);
        break;
      } catch (e: any) {
        const tooSmall = /face_too_small/i.test(String(e?.code ?? e?.message));
        if (!live || !tooSmall || i === KEEP.length - 1) throw e;
        await bump(cfg.cost.skin); // the rejected task was still created (and billed)
      }
    }
  }
  if (!base) throw new Error("Baseline analysis failed.");
  const baseline: Analysis = { ...base, driftLab: drift.lab };
  emit({ type: "baseline", analysis: baseline, originalUrl });
  step("baseline", "done");

  const unavailable = ALL_CONCERNS.filter((id) => CONCERNS[id].fixability === "cannot" && baseline.scores[id] !== undefined);
  const weights = buildWeights(opts.ranked, baseline, params);
  if (!Object.keys(weights).length) {
    emit({
      type: "error",
      code: "nothing_to_fix",
      message: "Nothing in your baseline is both visible and something makeup can address. Your skin looks even, so there's nothing to prove.",
    });
    return;
  }
  const verifyConcerns = Object.keys(weights) as ConcernId[]; // cheaper verification: only what we score

  /* ---------- 2..5. plan → render → verify → score ---------- */
  const evaluated: EvaluatedCandidate[] = [];

  let controlEv: EvaluatedCandidate | undefined;
  let firstFailure: { message: string; code?: string } | undefined;

  async function round(candidates: Candidate[], n: 1 | 2) {
    step("plan", "done", `${candidates.length} candidate looks planned`);
    emit({ type: "plan", candidates, round: n });
    step("render", "active", `Rendering ${candidates.length} looks`);
    let rendered = 0, verified = 0;

    await Promise.all(
      candidates.map(async (c) => {
        let renderCounted = false;
        const markRendered = () => {
          if (renderCounted) return;
          renderCounted = true;
          if (++rendered === candidates.length) {
            step("render", "done");
            step("verify", "active", "Re-analysing each render");
          }
        };
        try {
          const r = await engine.render(src, c.effects);
          await bump(cfg.cost.vto);
          const renderUrl = await saveFile(sessionId, `render-${c.id}.jpg`, await displayJpeg(r.buf));
          markRendered();
          const ref: ImageRef = { buf: r.buf, hash: sha(r.buf), remoteUrl: r.remoteUrl };
          const [an, lab] = await Promise.all([
            engine.analyze(ref, verifyConcerns, { baseline: baseline.scores, effects: c.effects }),
            sampleFaceLab(r.buf),
          ]);
          await bump(cfg.cost.skin);
          const analysis: Analysis = {
            scores: an.scores,
            overlays: an.overlays,
            overall: an.overall,
            tone: { skinHex: lab.hex, lab: lab.lab, source: "local" },
            driftLab: lab.lab,
          };
          const score = scoreCandidate(baseline, analysis, c.effects, weights, params);
          const ev: EvaluatedCandidate = { candidate: c, renderUrl, analysis, score };
          if (c.control) controlEv = ev; // measured like any look, but never eligible to win
          else evaluated.push(ev);
          emit({ type: "candidate", evaluated: ev });
          if (++verified === candidates.length) step("verify", "done");
        } catch (e: any) {
          // one bad pattern shouldn't kill the loop, but remember WHY so "all failed" can say so
          firstFailure ??= { message: e?.message ?? "unknown error", code: e?.code };
          step("render", "active", `${c.name} failed: ${e?.message ?? "unknown error"}`);
          markRendered();
          if (++verified === candidates.length) step("verify", "done");
        }
      }),
    );
  }

  step("plan", "active", "Choosing looks for your top concerns");
  await round([...planRound1(baseline, opts.ranked, K, params), planControl(baseline)], 1);
  if (!evaluated.length) {
    // Say the real reason (e.g. out of credits) instead of a generic message that sends people to the wrong place.
    emit({
      type: "error",
      code: firstFailure?.code ?? "all_failed",
      message: firstFailure?.message ?? "Every candidate render failed. Check `npm run probe` to verify the makeup payloads.",
    });
    return;
  }

  step("score", "active", "Scoring: coverage − tone drift − intensity");
  let best = pickBest(evaluated);
  step("score", "done", `Best so far: ${best.candidate.name} (J ${fmt(best.score.J)})`);

  /* ---------- 6. refine once if the top concern is weak ---------- */
  let refined = false;
  const canAffordRefine = !live || (await unitsLeft()) >= 2 * (cfg.cost.vto + cfg.cost.skin);
  const wantsRefine = MAX_ROUNDS > 1 && needsRefinement(best.score, params);
  const topId = best.score.topConcern;
  const headroom = hasDoseHeadroom(evaluated.map((e) => e.score), topId, topId ? noiseFor(topId, params) : params.noiseBand);
  if (wantsRefine && !headroom) {
    // lightest and heaviest looks agree within the noise: more of the same can't help, so don't pay for it
    const saved = 2 * (cfg.cost.vto + cfg.cost.skin);
    step("refine", "done", `Skipped: more product didn't help your top concern (every look landed within the noise), so we saved ${saved} credits`);
  } else if (wantsRefine && canAffordRefine) {
    refined = true;
    step("refine", "active", "Top concern under-delivered. One refinement round with new patterns");
    await round(planRound2(baseline, opts.ranked, evaluated, params), 2);
    best = pickBest(evaluated);
    step("refine", "done", `Final pick: ${best.candidate.name} (J ${fmt(best.score.J)})`);
  }

  /* ---------- 7. explain (reads numbers, never invents them) ---------- */
  step("explain", "active", "Writing it up in plain language");
  const explanation = explainNow({ best, baseline, unavailable, refined, control: controlEv });
  step("explain", "done");

  const result: RunResult = {
    sessionId,
    mode: engine.mode,
    originalUrl,
    baseline,
    evaluated: [best, ...evaluated.filter((e) => e !== best).sort((a, b) => b.score.J - a.score.J)],
    control: controlEv,
    bestId: best.candidate.id,
    rounds: refined ? 2 : 1,
    refined,
    unavailable,
    weights,
    params: { lambda: params.lambda, mu: params.mu, noiseBand: params.noiseBand, higherIsBetter: params.higherIsBetter, lookCost: cfg.cost.vto + cfg.cost.skin },
    unitsUsed: used,
    explanation,
    explainedBy: "template",
  };
  await saveFile(sessionId, "result.json", JSON.stringify(result));
  if (live) await recordRun(sessionId, used);
  emit({ type: "done", result }); // results are on screen now; nothing below delays them

  // Optional local-LLM reword. Slow on CPU, so it arrives later as an update (or never).
  const reworded = await explainReword(explanation);
  if (reworded) emit({ type: "explanation", lines: reworded, by: "llm" });
}

/* ---------------- Stage 2: measured, post-application ---------------- */

export async function runStage2(sessionId: string, rawImage: Buffer): Promise<Stage2Result> {
  const raw = await readFile(sessionId, "result.json");
  if (!raw) throw new Error("Session expired or not found. Photos are deleted after an hour.");
  const result: RunResult = JSON.parse(raw.toString());
  const engine = getEngine();
  const params = getParams();

  const norm = await normalizeUpload(rawImage);
  const measuredUrl = await saveFile(sessionId, "stage2.jpg", norm.buf);
  const best = result.evaluated.find((e) => e.candidate.id === result.bestId)!;
  const concerns = Object.keys(result.weights) as ConcernId[];

  const an = await engine.analyze(
    { buf: norm.buf, hash: norm.hash },
    concerns,
    { baseline: result.baseline.scores, effects: best.candidate.effects, realWorld: true },
  );

  const rows = concerns.flatMap((concern) => {
    const b = result.baseline.scores[concern];
    const p = best.analysis.scores[concern];
    const m = an.scores[concern];
    if (b === undefined || p === undefined || m === undefined) return [];
    const bs = severity(b, params.higherIsBetter);
    const ps = severity(p, params.higherIsBetter);
    const ms = severity(m, params.higherIsBetter);
    const noise = noiseFor(concern, params);
    const predictedReduction = adjustedReduction(bs, ps, noise);
    const measuredReduction = adjustedReduction(bs, ms, noise);
    return [{ concern, baselineSeverity: bs, predictedSeverity: ps, measuredSeverity: ms, predictedReduction, measuredReduction, gap: measuredReduction - predictedReduction }];
  });

  const meanGap = rows.length ? rows.reduce((s, r) => s + r.gap, 0) / rows.length : 0;
  const summary =
    Math.abs(meanGap) < 0.05
      ? "Your real result landed close to the prediction."
      : meanGap < 0
        ? `Real-world results ran about ${Math.round(Math.abs(meanGap) * 100)} points of reduction below the simulation. That gap is the calibration signal.`
        : `Real-world results beat the simulation by about ${Math.round(meanGap * 100)} points of reduction.`;

  return { concerns: rows, measuredUrl, summary };
}

export { fileUrl };
