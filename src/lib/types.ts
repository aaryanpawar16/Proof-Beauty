export type ConcernId =
  | "dark_circle"
  | "redness"
  | "age_spot"
  | "acne"
  | "oiliness"
  | "pore"
  | "texture"
  | "eye_bag"
  | "wrinkle"
  | "droopy_eyelid";

export type Fixability = "addressable" | "partial" | "cannot";

/** A makeup job. Roles are abstract; src/lib/patterns.ts maps them to real VTO categories/patterns. */
export type Role =
  | "under_eye_correct"
  | "cheek_nose_correct"
  | "spot_conceal"
  | "base_even"
  | "tzone_powder"
  | "cheek_blush";

export interface ConcernDef {
  id: ConcernId;
  label: string;
  /** SD action name sent to YouCam skin-analysis (never mixed with hd_* in one request). */
  apiAction: string;
  fixability: Fixability;
  region: string;
  strategy: string;
  roles: Role[];
  /** Why makeup can't fully handle it (only for partial / cannot). */
  caveat?: string;
}

export interface Effect {
  role: Role;
  category: string;
  /** only for categories that take a pattern */
  pattern?: string;
  /** concealer/foundation tuning: underEye & coverage are multipliers of `intensity`, glow is absolute (0 = matte) */
  params?: { underEye?: number; coverage?: number; glow?: number; smooth?: number };
  color: string;
  texture: "matte" | "satin" | "gloss" | "shimmer";
  /** 0–100 */
  intensity: number;
  label: string;
  /** the control look's deliberately score-gaming layer (demo engine uses it to simulate the cheat) */
  naive?: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  round: 1 | 2;
  rationale: string;
  targets: ConcernId[];
  effects: Effect[];
  /**
   * A control: rendered and verified like any look, but it can never win. It is the shortcut a score-only
   * try-on would take (a whole-face foundation a few shades too light), used to prove the loop can't be gamed.
   */
  control?: boolean;
}

/** Concern -> YouCam score (0–100, raw_score by default; higher = healthier). */
export type ConcernScores = Partial<Record<ConcernId, number>>;

export interface ToneReading {
  skinHex: string;
  lab: [number, number, number];
  /** "api" = YouCam skin-tone-analysis, "local" = LAB sampling of the face region */
  source: "api" | "local";
  eyeHex?: string;
  lipHex?: string;
  hairHex?: string;
  eyebrowHex?: string;
}

export interface Analysis {
  scores: ConcernScores;
  overlays: Partial<Record<ConcernId, string[]>>;
  tone: ToneReading;
  /** Local LAB sample of the face region, measured identically on every image so drift is apples-to-apples */
  driftLab: [number, number, number];
  /** Overall YouCam skin score if returned */
  overall?: number;
}

export interface ConcernDelta {
  concern: ConcernId;
  baselineSeverity: number;
  renderSeverity: number;
  /** points of severity removed (positive = improvement) */
  delta: number;
  /** noise-adjusted fraction of baseline severity removed, −1..1 */
  reduction: number;
  weight: number;
  /** the noise band (score points) this concern was judged against */
  noise: number;
  confidence: "clear" | "likely" | "within-noise";
  fixability: Fixability;
}

export interface ScoreBreakdown {
  J: number;
  coverage: number; // Σ w·reduction
  toneDriftDE: number;
  toneDriftPenalty: number;
  intensity: number;
  intensityPenalty: number;
  deltas: ConcernDelta[];
  topConcern: ConcernId | null;
  topConcernReduction: number;
}

export interface EvaluatedCandidate {
  candidate: Candidate;
  renderUrl: string;
  analysis: Analysis;
  score: ScoreBreakdown;
}

export interface Priorities {
  /** user-selected concerns in priority order, most bothersome first */
  ranked: ConcernId[];
}

export interface RunResult {
  sessionId: string;
  mode: "live" | "demo";
  originalUrl: string;
  baseline: Analysis;
  evaluated: EvaluatedCandidate[];
  /** the integrity-check control look (see Candidate.control); never part of `evaluated` or selection */
  control?: EvaluatedCandidate;
  bestId: string;
  rounds: number;
  refined: boolean;
  unavailable: ConcernId[];
  weights: Record<string, number>;
  params: { lambda: number; mu: number; noiseBand: number; higherIsBetter: boolean; /** credits per look (render + verify) */ lookCost?: number };
  unitsUsed: number;
  explanation: string[];
  explainedBy: "llm" | "template";
}

export type RunEvent =
  | { type: "start"; mode: "live" | "demo"; budgetLeft: number; estimate: number; higherIsBetter: boolean; fellBack?: boolean }
  | { type: "step"; step: StepId; status: "active" | "done"; detail?: string }
  | { type: "baseline"; analysis: Analysis; originalUrl: string }
  | { type: "plan"; candidates: Candidate[]; round: 1 | 2 }
  | { type: "candidate"; evaluated: EvaluatedCandidate }
  | { type: "units"; used: number; left: number }
  | { type: "done"; result: RunResult }
  /** sent after "done" if the optional LLM reword finishes; replaces the explanation text */
  | { type: "explanation"; lines: string[]; by: "llm" | "template" }
  | { type: "error"; message: string; code?: string };

export type StepId = "baseline" | "plan" | "render" | "verify" | "score" | "refine" | "explain";

export interface Stage2Result {
  concerns: {
    concern: ConcernId;
    baselineSeverity: number;
    predictedSeverity: number;
    measuredSeverity: number;
    predictedReduction: number;
    measuredReduction: number;
    gap: number;
  }[];
  measuredUrl: string;
  summary: string;
}
