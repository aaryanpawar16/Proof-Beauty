import { CONCERNS } from "./concerns";
import { deltaE } from "./color";
import type {
  Analysis,
  ConcernDelta,
  ConcernId,
  Effect,
  Role,
  ScoreBreakdown,
} from "./types";

/**
 * Deterministic scoring. No LLM ever touches these numbers.
 *
 *   J = Σ w_c · reduction_c  −  λ · tone_drift  −  μ · intensity
 */
export interface ScoreParams {
  lambda: number;
  mu: number;
  /** test-retest noise in severity points; smaller deltas count as zero */
  noiseBand: number;
  /** per-concern override: some concerns are measurably noisier than others */
  noiseByConcern?: Partial<Record<ConcernId, number>>;
  /** ignore concerns whose baseline severity is below this (ratios get unstable) */
  minSeverity: number;
  /** top-concern reduction below this triggers a refinement round */
  coverageTarget: number;
  /** partially-addressable concerns count for this fraction of their weight */
  partialDiscount: number;
  /** YouCam ui_score: true if higher = healthier skin */
  higherIsBetter: boolean;
}

/**
 * λ and μ are on the same scale as `reduction` (a fraction of baseline severity). Measured on real renders, a
 * clearly effective look removes ~5-20% of a concern, so penalties must be of that order: λ = 0.15 makes a
 * visible shade mismatch (ΔE ≈ 6) cost ~6 points of reduction, μ = 0.10 makes heavy full-face coverage cost ~5-8.
 * (0.35 / 0.25 made every look net-negative no matter how well it worked.)
 */
export const DEFAULT_PARAMS: ScoreParams = {
  lambda: 0.15,
  mu: 0.1,
  noiseBand: 3,
  minSeverity: 10,
  coverageTarget: 0,
  partialDiscount: 0.5,
  higherIsBetter: true,
};

/** Share of the face each role roughly covers; feeds the intensity penalty. */
export const ROLE_AREA: Record<Role, number> = {
  under_eye_correct: 0.15,
  cheek_nose_correct: 0.3,
  spot_conceal: 0.2,
  base_even: 0.6,
  tzone_powder: 0.25,
  cheek_blush: 0.3,
};

export const severity = (ui: number, higherIsBetter = true) =>
  Math.max(0, Math.min(100, higherIsBetter ? 100 - ui : ui));

/** Rank-based weights: the concern that bothers the user most gets the most weight. */
export function buildWeights(
  ranked: ConcernId[],
  baseline: Analysis,
  params: ScoreParams = DEFAULT_PARAMS,
): Record<string, number> {
  const raw: Record<string, number> = {};
  const usable = ranked.filter((id) => {
    const ui = baseline.scores[id];
    return (
      ui !== undefined &&
      CONCERNS[id].fixability !== "cannot" &&
      severity(ui, params.higherIsBetter) >= params.minSeverity
    );
  });

  if (usable.length) {
    usable.forEach((id, i) => {
      const f = CONCERNS[id].fixability === "partial" ? params.partialDiscount : 1;
      raw[id] = Math.pow(0.62, i) * f;
    });
  } else {
    // nothing ranked / nothing usable: fall back to baseline severity
    for (const [id, ui] of Object.entries(baseline.scores) as [ConcernId, number][]) {
      const sev = severity(ui, params.higherIsBetter);
      if (CONCERNS[id].fixability === "cannot" || sev < params.minSeverity) continue;
      raw[id] = sev * (CONCERNS[id].fixability === "partial" ? params.partialDiscount : 1);
    }
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / total]));
}

export const noiseFor = (id: ConcernId, p: ScoreParams) => p.noiseByConcern?.[id] ?? p.noiseBand;

/** Fraction of baseline severity removed, shrunk toward zero by the test-retest noise band. */
export function adjustedReduction(baselineSev: number, renderSev: number, noiseBand: number): number {
  const raw = baselineSev - renderSev;
  const adj = Math.abs(raw) <= noiseBand ? 0 : raw - Math.sign(raw) * noiseBand;
  return baselineSev > 0 ? Math.max(-1, Math.min(1, adj / baselineSev)) : 0;
}

export function intensityOf(effects: Effect[]): number {
  const total = effects.reduce((s, e) => s + (e.intensity / 100) * ROLE_AREA[e.role], 0);
  return Math.min(1, total / 1.1);
}

export function toneDriftPenaltyOf(dE: number): number {
  // ΔE under ~1.5 is imperceptible; ~12 is a clearly different shade / mask-like finish
  return Math.max(0, Math.min(1, (dE - 1.5) / 10.5));
}

export function scoreCandidate(
  baseline: Analysis,
  render: Analysis,
  effects: Effect[],
  weights: Record<string, number>,
  params: ScoreParams = DEFAULT_PARAMS,
): ScoreBreakdown {
  const deltas: ConcernDelta[] = [];
  let coverage = 0;

  for (const [id, w] of Object.entries(weights) as [ConcernId, number][]) {
    const b = baseline.scores[id];
    const r = render.scores[id];
    if (b === undefined || r === undefined) continue;
    const bs = severity(b, params.higherIsBetter);
    const rs = severity(r, params.higherIsBetter);
    const raw = bs - rs;
    const noise = noiseFor(id, params);
    const reduction = adjustedReduction(bs, rs, noise);
    coverage += w * reduction;
    deltas.push({
      concern: id,
      baselineSeverity: bs,
      renderSeverity: rs,
      delta: raw,
      reduction,
      weight: w,
      noise,
      confidence:
        Math.abs(raw) >= noise * 2 ? "clear" : Math.abs(raw) > noise ? "likely" : "within-noise",
      fixability: CONCERNS[id].fixability,
    });
  }

  const dE = deltaE(baseline.driftLab, render.driftLab);
  const driftPenalty = toneDriftPenaltyOf(dE);
  const intensity = intensityOf(effects);
  const J = coverage - params.lambda * driftPenalty - params.mu * intensity;

  const top = [...deltas].sort((a, b) => b.weight - a.weight)[0];
  return {
    J,
    coverage,
    toneDriftDE: dE,
    toneDriftPenalty: driftPenalty,
    intensity,
    intensityPenalty: params.mu * intensity,
    deltas: deltas.sort((a, b) => b.weight - a.weight),
    topConcern: top?.concern ?? null,
    topConcernReduction: top?.reduction ?? 0,
  };
}

/** Above this tone drift the render is a visibly different shade, so a look can't be called a win. */
export const MAX_ACCEPTABLE_DRIFT_DE = 4;

/** At least one concern improved by more than its noise band. */
export const isImproved = (s: ScoreBreakdown) => s.deltas.some((d) => d.confidence !== "within-noise" && d.reduction > 0);

/** Improved beyond noise AND still looks like your skin (not a mask or a shade mismatch). */
export const isProven = (s: ScoreBreakdown) => isImproved(s) && s.toneDriftDE <= MAX_ACCEPTABLE_DRIFT_DE;

/**
 * Pick the winner by J, but a look that is proven beats one that isn't: a big score from a shade mismatch
 * (e.g. brightening the whole face) must not win over a look that genuinely treats the concern.
 */
export function pickBest<T extends { score: ScoreBreakdown }>(candidates: T[]): T {
  const byJ = (a: T, b: T) => b.score.J - a.score.J;
  const proven = candidates.filter((c) => isProven(c.score)).sort(byJ);
  return proven[0] ?? [...candidates].sort(byJ)[0];
}

/**
 * Does more product make a difference? Compares the top concern across the round-1 looks (light → heavy). If they all
 * land within the noise band of each other, the approach has hit its ceiling: a refinement round just spends
 * credits on the same thing (measured on a real photo: redness was 37-38 at 34%, 57% and 99% intensity; a 22-credit
 * refinement round then moved it ~1 point, inside the ±2 noise). Returns true when we can't tell (too few looks).
 */
export function hasDoseHeadroom(looks: ScoreBreakdown[], concern: ConcernId | null, noise: number): boolean {
  if (!concern || looks.length < 2) return true;
  const sev = looks
    .map((s) => s.deltas.find((d) => d.concern === concern)?.renderSeverity)
    .filter((v): v is number => v !== undefined);
  if (sev.length < 2) return true;
  return Math.max(...sev) - Math.min(...sev) > noise;
}

/**
 * Refine (once) only if the best look hasn't clearly improved the top concern: its change is within noise or
 * just "likely". A "clear" change (≥ 2x that concern's noise band) is already a measured win, and a size
 * threshold on the percentage can't tell the difference: real makeup gives 3-7% on a dark circle even when
 * it works, and a refinement round didn't improve on that (round 1: 4.1%, round 2: 3.7%). `coverageTarget`
 * is an optional extra floor (default 0 = off).
 */
export function needsRefinement(best: ScoreBreakdown, params: ScoreParams = DEFAULT_PARAMS) {
  if (best.topConcern === null) return false;
  const top = best.deltas.find((d) => d.concern === best.topConcern);
  if (!top) return false;
  return top.confidence !== "clear" || best.topConcernReduction < params.coverageTarget;
}
