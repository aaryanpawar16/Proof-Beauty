import { MAX_ACCEPTABLE_DRIFT_DE } from "./scoring";
import type { ConcernId, EvaluatedCandidate, RunResult } from "./types";

/**
 * "Catch the cheat": compares the control look (a score-gaming shortcut) with the look we picked.
 *
 *  caught : the control beat our pick on the top concern by MORE than the noise band, but shifted the skin shade
 *           beyond what's acceptable: a score-only try-on would have been fooled. We rejected it.
 *  tie    : the control scored the same as our pick (gap inside the noise) while shifting the shade. The score
 *           alone can't tell a treatment from a brightening filter; the shade check can.
 *  held   : the control shifted the shade and scored clearly worse; the shortcut didn't pay.
 *  clean  : the control stayed shade-matched, so there was nothing to catch (reported as such, not hidden).
 */
export interface IntegrityReport {
  kind: "caught" | "tie" | "held" | "clean";
  /** severity points the control is ahead of our pick on the top concern (negative = behind) */
  gapPoints: number;
  /** that concern's noise band, in the same points */
  noise: number;
  control: EvaluatedCandidate;
  best: EvaluatedCandidate;
  /** concern the comparison is about */
  concern: ConcernId | null;
  controlReduction: number;
  bestReduction: number;
  controlCoverage: number;
  bestCoverage: number;
  controlDE: number;
  bestDE: number;
}

export function integrityReport(result: RunResult): IntegrityReport | null {
  const control = result.control;
  const best = result.evaluated.find((e) => e.candidate.id === result.bestId);
  if (!control || !best) return null;

  const concern = best.score.topConcern;
  const red = (e: EvaluatedCandidate) => e.score.deltas.find((d) => d.concern === concern)?.reduction ?? 0;
  // Compare on the number the card shows: the user's top concern. A gap only counts if it clears that concern's
  // noise band; a ~1-point lead inside the noise is a tie, not a "catch" (we measured exactly that on a real photo).
  const topDelta = (e: EvaluatedCandidate) => e.score.deltas.find((d) => d.concern === concern);
  const noise = topDelta(best)?.noise ?? 2;
  const gap = (topDelta(best)?.renderSeverity ?? 0) - (topDelta(control)?.renderSeverity ?? 0); // + = control ahead
  const shifted = control.score.toneDriftDE > MAX_ACCEPTABLE_DRIFT_DE;

  return {
    kind: !shifted ? "clean" : gap > noise ? "caught" : gap < -noise ? "held" : "tie",
    gapPoints: gap,
    noise,
    control,
    best,
    concern,
    controlReduction: red(control),
    bestReduction: red(best),
    controlCoverage: control.score.coverage,
    bestCoverage: best.score.coverage,
    controlDE: control.score.toneDriftDE,
    bestDE: best.score.toneDriftDE,
  };
}
