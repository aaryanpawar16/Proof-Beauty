import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  MAX_ACCEPTABLE_DRIFT_DE,
  adjustedReduction,
  buildWeights,
  hasDoseHeadroom,
  intensityOf,
  isImproved,
  isProven,
  needsRefinement,
  noiseFor,
  pickBest,
  scoreCandidate,
  severity,
  toneDriftPenaltyOf,
  type ScoreParams,
} from "./scoring";
import type { Analysis, ConcernScores, Effect } from "./types";

/* ---------- fixtures ---------- */
const P: ScoreParams = { ...DEFAULT_PARAMS, noiseBand: 2, noiseByConcern: undefined };

/** scores are YouCam-style: higher = healthier, so severity = 100 - score */
const analysis = (scores: ConcernScores, L = 50): Analysis => ({
  scores,
  overlays: {},
  tone: { skinHex: "#000000", lab: [L, 15, 18], source: "local" },
  driftLab: [L, 15, 18],
});

const effect = (intensity = 100, role: Effect["role"] = "under_eye_correct"): Effect => ({
  role,
  category: "concealer",
  color: "#ffffff",
  texture: "satin",
  intensity,
  label: "test",
});

const baseline = analysis({ dark_circle: 40, eye_bag: 50, oiliness: 90, wrinkle: 70, pore: 85 }); // severities 60 / 50 / 10 / 30 / 15

describe("severity", () => {
  it("flips direction and clamps to 0..100", () => {
    expect(severity(40, true)).toBe(60);
    expect(severity(40, false)).toBe(40);
    expect(severity(120, true)).toBe(0);
    expect(severity(-5, true)).toBe(100);
  });
});

describe("adjustedReduction (noise shrink)", () => {
  it("counts nothing inside the noise band", () => {
    expect(adjustedReduction(61, 60, 1.5)).toBe(0);
    expect(adjustedReduction(61, 59.5, 1.5)).toBe(0); // 1.5 points = exactly the band
  });
  it("shrinks real changes by the band, as a fraction of baseline", () => {
    // 61 -> 55 is 6 points; minus 1.5 noise = 4.5; / 61
    expect(adjustedReduction(61, 55, 1.5)).toBeCloseTo(4.5 / 61, 10);
  });
  it("penalises getting worse the same way", () => {
    expect(adjustedReduction(11, 15, 3.5)).toBeCloseTo(-0.5 / 11, 10);
  });
  it("is safe for a zero baseline and clamps to [-1, 1]", () => {
    expect(adjustedReduction(0, 10, 2)).toBe(0);
    expect(adjustedReduction(10, 100, 2)).toBe(-1);
  });
});

describe("noiseFor", () => {
  it("uses the per-concern band when present, else the global one", () => {
    const p = { ...P, noiseBand: 2, noiseByConcern: { oiliness: 3.5 } };
    expect(noiseFor("oiliness", p)).toBe(3.5);
    expect(noiseFor("dark_circle", p)).toBe(2);
  });
});

describe("toneDriftPenaltyOf / intensityOf", () => {
  it("is 0 below the imperceptible threshold and 1 for a clearly different shade", () => {
    expect(toneDriftPenaltyOf(0)).toBe(0);
    expect(toneDriftPenaltyOf(1.5)).toBe(0);
    expect(toneDriftPenaltyOf(12)).toBe(1);
    expect(toneDriftPenaltyOf(50)).toBe(1);
  });
  it("increases monotonically in between", () => {
    expect(toneDriftPenaltyOf(3)).toBeLessThan(toneDriftPenaltyOf(6));
    expect(toneDriftPenaltyOf(6)).toBeLessThan(toneDriftPenaltyOf(9));
  });
  it("intensity is 0 for no effects and never exceeds 1", () => {
    expect(intensityOf([])).toBe(0);
    const heavy: Effect[] = (["under_eye_correct", "base_even", "tzone_powder", "cheek_nose_correct", "spot_conceal"] as const).map((r) => effect(100, r));
    expect(intensityOf(heavy)).toBe(1);
    expect(intensityOf([effect(50)])).toBeLessThan(intensityOf([effect(100)]));
  });
});

describe("buildWeights", () => {
  it("weights by rank (decay 0.62) and normalises to 1", () => {
    // two fully-fixable concerns, so only rank decides the ratio
    const w = buildWeights(["dark_circle", "oiliness"], baseline, P);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(w.dark_circle / w.oiliness).toBeCloseTo(1 / 0.62, 6);
  });
  it("a 'partly fixable' concern (eye bags) gets rank decay AND the partial discount", () => {
    const w = buildWeights(["dark_circle", "eye_bag"], baseline, P);
    expect(w.dark_circle / w.eye_bag).toBeCloseTo(1 / (0.62 * P.partialDiscount), 6);
  });
  it("never weights concerns makeup can't fix", () => {
    const w = buildWeights(["wrinkle", "dark_circle"], baseline, P);
    expect(w.wrinkle).toBeUndefined();
    expect(w.dark_circle).toBeCloseTo(1, 10);
  });
  it("drops concerns that are barely visible (unstable ratios)", () => {
    const w = buildWeights(["oiliness", "dark_circle"], analysis({ dark_circle: 40, oiliness: 96 }), P); // oiliness severity 4 < minSeverity
    expect(w.oiliness).toBeUndefined();
  });
  it("counts partially-fixable concerns at a discount", () => {
    const w = buildWeights(["pore", "eye_bag"], baseline, P); // pore is 'partial'
    // rank weights: pore 1 * 0.5 discount, eye_bag 0.62 (eye_bag is also 'partial': 0.62 * 0.5)
    expect(w.pore / w.eye_bag).toBeCloseTo(1 / 0.62, 6);
  });
  it("falls back to severity when nothing usable is ranked", () => {
    const w = buildWeights([], baseline, P);
    expect(Object.keys(w).length).toBeGreaterThan(0);
    expect(w.dark_circle).toBeGreaterThan(w.pore ?? 0);
    expect(w.wrinkle).toBeUndefined();
  });
});

describe("scoreCandidate", () => {
  const weights = buildWeights(["dark_circle", "eye_bag"], baseline, P);

  it("J = coverage - lambda*drift - mu*intensity", () => {
    const render = analysis({ dark_circle: 46, eye_bag: 56 }, 52); // 60->54 and 50->44, tone L 50 -> 52
    const eff = [effect(80)];
    const s = scoreCandidate(baseline, render, eff, weights, P);
    expect(s.J).toBeCloseTo(s.coverage - P.lambda * s.toneDriftPenalty - P.mu * s.intensity, 10);
    expect(s.toneDriftDE).toBeCloseTo(2, 10);
    expect(s.topConcern).toBe("dark_circle");
  });

  it("labels each change against its own noise band", () => {
    const p = { ...P, noiseBand: 2, noiseByConcern: { dark_circle: 1.5 } };
    // dark_circle: 60 -> 56 = 4 points (>= 2*1.5) clear; eye_bag: 50 -> 47 = 3 points (> 2, < 4) likely
    const s = scoreCandidate(baseline, analysis({ dark_circle: 44, eye_bag: 53 }), [effect()], buildWeights(["dark_circle", "eye_bag"], baseline, p), p);
    const by = Object.fromEntries(s.deltas.map((d) => [d.concern, d.confidence]));
    expect(by.dark_circle).toBe("clear");
    expect(by.eye_bag).toBe("likely");
  });

  it("calls a change inside the band 'within-noise' and gives it zero reduction", () => {
    const s = scoreCandidate(baseline, analysis({ dark_circle: 41, eye_bag: 51 }), [effect()], weights, P);
    expect(s.deltas.every((d) => d.confidence === "within-noise" && d.reduction === 0)).toBe(true);
    expect(isImproved(s)).toBe(false);
  });

  it("measures tone drift as the shift in the face-region colour", () => {
    const same = scoreCandidate(baseline, analysis({ dark_circle: 45, eye_bag: 55 }, 50), [effect()], weights, P);
    const shifted = scoreCandidate(baseline, analysis({ dark_circle: 45, eye_bag: 55 }, 57), [effect()], weights, P);
    expect(same.toneDriftDE).toBe(0);
    expect(shifted.toneDriftDE).toBeCloseTo(7, 10);
    expect(shifted.J).toBeLessThan(same.J);
  });
});

describe("needsRefinement", () => {
  const w = buildWeights(["dark_circle"], baseline, P);
  const score = (darkCircleUi: number) => scoreCandidate(baseline, analysis({ dark_circle: darkCircleUi }), [effect()], w, P);

  it("does not refine when the top concern clearly improved", () => {
    expect(needsRefinement(score(46), P)).toBe(false); // 60 -> 54: 6 points, clear (>= 4)
  });
  it("refines when the change is only 'likely' or inside the noise", () => {
    expect(needsRefinement(score(43), P)).toBe(true); // 60 -> 57: 3 points, likely
    expect(needsRefinement(score(40), P)).toBe(true); // unchanged
  });
  it("refines nothing when there is no top concern", () => {
    expect(needsRefinement(scoreCandidate(baseline, analysis({}), [effect()], {}, P), P)).toBe(false);
  });
  it("coverageTarget acts as an extra floor even for a clear change", () => {
    expect(needsRefinement(score(46), { ...P, coverageTarget: 0.5 })).toBe(true);
  });
});

describe("hasDoseHeadroom (does more product help?)", () => {
  const w = buildWeights(["dark_circle"], baseline, P);
  const look = (ui: number) => scoreCandidate(baseline, analysis({ dark_circle: ui }), [effect()], w, P);

  it("is false when light and heavy looks land within the noise of each other", () => {
    expect(hasDoseHeadroom([look(46), look(46.5), look(47)], "dark_circle", 2)).toBe(false);
  });
  it("is true when heavier looks do clearly more", () => {
    expect(hasDoseHeadroom([look(43), look(46), look(50)], "dark_circle", 2)).toBe(true);
  });
  it("can't tell with <2 looks or no concern, so it allows refinement", () => {
    expect(hasDoseHeadroom([look(46)], "dark_circle", 2)).toBe(true);
    expect(hasDoseHeadroom([look(46), look(46)], null, 2)).toBe(true);
  });
});

describe("isProven / pickBest", () => {
  const w = buildWeights(["dark_circle"], baseline, P);
  const mk = (ui: number, L: number) => scoreCandidate(baseline, analysis({ dark_circle: ui }, L), [effect()], w, P);

  it("proven = improved beyond noise AND shade held (dE <= limit)", () => {
    expect(isProven(mk(46, 50 + MAX_ACCEPTABLE_DRIFT_DE - 0.5))).toBe(true);
    expect(isProven(mk(46, 50 + MAX_ACCEPTABLE_DRIFT_DE + 3))).toBe(false); // improved but mismatched shade
    expect(isProven(mk(40, 50))).toBe(false); // shade held but nothing improved
  });

  it("a proven look beats a higher-scoring but shade-shifted one (the face-brightening trap)", () => {
    const cheat = { id: "cheat", score: mk(60, 60) }; // big 'improvement', dE 10
    const honest = { id: "honest", score: mk(46, 51) };
    expect(cheat.score.coverage).toBeGreaterThan(honest.score.coverage); // it WOULD win on raw coverage
    expect(pickBest([cheat, honest]).id).toBe("honest");
  });

  it("falls back to the highest J when nothing is proven", () => {
    const a = { id: "a", score: mk(40, 50) };
    const b = { id: "b", score: mk(40, 62) };
    expect(pickBest([b, a]).id).toBe("a"); // same coverage, but b pays a drift penalty
  });
});
