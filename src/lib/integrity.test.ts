import { describe, expect, it } from "vitest";
import { integrityReport } from "./integrity";
import { DEFAULT_PARAMS, buildWeights, scoreCandidate, type ScoreParams } from "./scoring";
import type { Analysis, ConcernScores, EvaluatedCandidate, Effect, RunResult } from "./types";

const P: ScoreParams = { ...DEFAULT_PARAMS, noiseBand: 2, noiseByConcern: { dark_circle: 1.5 } };

const analysis = (scores: ConcernScores, L = 50): Analysis => ({
  scores,
  overlays: {},
  tone: { skinHex: "#000000", lab: [L, 15, 18], source: "local" },
  driftLab: [L, 15, 18],
});
const effect: Effect = { role: "under_eye_correct", category: "concealer", color: "#fff", texture: "satin", intensity: 80, label: "t" };

const baseline = analysis({ dark_circle: 40, eye_bag: 50 }); // dark_circle severity 60 (the top concern)
const weights = buildWeights(["dark_circle", "eye_bag"], baseline, P);

/** a candidate whose dark-circle severity ends at `severity` and whose face colour moves by `dL` */
function look(id: string, severity: number, dL: number): EvaluatedCandidate {
  const render = analysis({ dark_circle: 100 - severity, eye_bag: 55 }, 50 + dL);
  return {
    candidate: { id, name: id, round: 1, rationale: "", targets: ["dark_circle"], effects: [effect] },
    renderUrl: `/x/${id}.jpg`,
    analysis: render,
    score: scoreCandidate(baseline, render, [effect], weights, P),
  };
}

const run = (best: EvaluatedCandidate, control?: EvaluatedCandidate) =>
  ({ evaluated: [best], bestId: best.candidate.id, control }) as unknown as RunResult;

describe("integrityReport", () => {
  it("returns null when there is no control look", () => {
    expect(integrityReport(run(look("best", 55, 1)))).toBeNull();
  });

  it("clean: the control kept the shade, so there is nothing to catch", () => {
    const r = integrityReport(run(look("best", 55, 1), look("control", 54, 2)))!;
    expect(r.kind).toBe("clean");
  });

  it("tie: scored the same (gap inside the noise) but shifted the shade", () => {
    // best 55, control 54 -> control ahead by 1.0 point; noise 1.5; control moved the shade ~6.5
    const r = integrityReport(run(look("best", 55, 1), look("control", 54, 6.5)))!;
    expect(r.kind).toBe("tie");
    expect(r.gapPoints).toBeCloseTo(1, 10);
    expect(r.noise).toBe(1.5);
    expect(r.controlDE).toBeGreaterThan(4);
  });

  it("caught: the control beat us by MORE than the noise while shifting the shade", () => {
    const r = integrityReport(run(look("best", 57, 1), look("control", 50, 7)))!;
    expect(r.kind).toBe("caught");
    expect(r.gapPoints).toBeGreaterThan(r.noise);
  });

  it("held: the shortcut shifted the shade and scored clearly worse", () => {
    const r = integrityReport(run(look("best", 55, 1), look("control", 60, 6)))!;
    expect(r.kind).toBe("held");
    expect(r.gapPoints).toBeLessThan(-r.noise);
  });

  it("never calls a lead inside the noise band a catch, even if the control is slightly ahead", () => {
    const r = integrityReport(run(look("best", 55, 1), look("control", 53.6, 6)))!; // ahead by 1.4 < 1.5
    expect(r.kind).not.toBe("caught");
  });

  it("reports both reductions on the top concern for the card", () => {
    const r = integrityReport(run(look("best", 55, 1), look("control", 52, 6.5)))!;
    expect(r.concern).toBe("dark_circle");
    expect(r.controlReduction).toBeGreaterThan(r.bestReduction);
    expect(r.bestDE).toBeLessThan(r.controlDE);
  });
});
