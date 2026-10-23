import { CONCERNS } from "./concerns";
import { labToHex, shade } from "./color";
import { getCatalog } from "./patterns";
import { severity, type ScoreParams, DEFAULT_PARAMS } from "./scoring";
import type { Analysis, Candidate, ConcernId, Effect, EvaluatedCandidate, Role } from "./types";

/**
 * Rule-based planner. Concern -> strategy rules live in concerns.ts; this turns them into
 * K distinct, layered candidate looks. Shades are derived from the measured skin tone.
 */

const ROLE_SHADE: Record<Role, (hex: string) => string> = {
  // Concealer works by being clearly lighter than the (shadowed) skin around it. Measured on a real photo:
  // +5 L* barely moved the score; +15 and +25 both gave the full effect (+3 raw points), so +15 avoids a white patch.
  under_eye_correct: (h) => shade(h, 15, 3, 6),
  // foundation-type roles tint the WHOLE face, so keep their shifts small to avoid a visible colour cast
  cheek_nose_correct: (h) => shade(h, 1, -3, 0), // slightly less red than your skin
  spot_conceal: (h) => shade(h, 3, 0, 1),
  base_even: (h) => shade(h, 0, 0, 0),
  tzone_powder: (h) => shade(h, 2, -1, 0),
  cheek_blush: (h) => shade(h, -6, 12, 3),
};

/** The shade a product for this role should have, given a skin tone (used for the shopping list). */
export const roleShade = (role: Role, skinHex: string) => ROLE_SHADE[role](skinHex);

/**
 * Colour used to RENDER makeup: the skin colour as it appears in this photo (same face-region sample the
 * tone-drift check uses). YouCam's tone API returns a lighting-corrected tone; in a shadowed photo that is
 * lighter than the pixels, so a foundation in that shade brightens the render (measured: +7 L*, Î”E 7).
 */
export const observedSkinHex = (a: Analysis) => labToHex(a.driftLab);

/**
 * The CONTROL look: the shortcut a score-only try-on takes. A whole-face foundation a few shades too light
 * brightens everything, including the under-eye, and the dark-circle score rises without the dark circles being
 * treated (measured on a real photo: +8 raw points at ΔE 7, vs +3-4 for the best real concealer).
 * It is rendered and verified like any other look but is never eligible to win (see pickBest / the orchestrator);
 * it exists so the results page can show a cheat being caught instead of just claiming we guard against one.
 */
export function planControl(baseline: Analysis): Candidate {
  const observed = baseline.driftLab;
  const apiL = baseline.tone.source === "api" ? baseline.tone.lab[0] : observed[0];
  // at least 12 L* lighter than the skin in the photo (or YouCam's lighting-corrected tone if that's lighter)
  const L = Math.min(92, Math.max(apiL, observed[0] + 12));
  return {
    id: "control",
    name: "Brightening control",
    round: 1,
    control: true,
    targets: [],
    rationale: "A whole-face base a few shades too light: the shortcut a score-only try-on takes.",
    effects: [
      {
        role: "base_even",
        category: "foundation",
        color: labToHex([L, observed[1], observed[2]]),
        texture: "satin",
        intensity: 70,
        params: { coverage: 0.7, glow: 35 },
        label: "Brightening base (control)",
        naive: true,
      },
    ],
  };
}

const ROLE_TEXTURE: Record<Role, Effect["texture"]> = {
  under_eye_correct: "satin",
  cheek_nose_correct: "satin",
  spot_conceal: "matte",
  base_even: "satin",
  tzone_powder: "matte",
  cheek_blush: "satin",
};

type Style = "precision" | "balanced" | "full";

const STYLE_META: Record<Style, { name: string; variant: 0 | 1 | 2; intensity: number; breadth: number }> = {
  // The top concern's layer gets (close to) the dose that measurably works; later concerns fall off from it.
  precision: { name: "Precision", variant: 0, intensity: 85, breadth: 2 },
  balanced: { name: "Balanced", variant: 1, intensity: 92, breadth: 3 },
  full: { name: "Full cover", variant: 2, intensity: 100, breadth: 6 },
};

function addressableRanked(ranked: ConcernId[], baseline: Analysis, params: ScoreParams): ConcernId[] {
  const usable = ranked.filter((id) => {
    const ui = baseline.scores[id];
    return ui !== undefined && CONCERNS[id].fixability !== "cannot" && severity(ui, params.higherIsBetter) >= params.minSeverity;
  });
  if (usable.length) return usable;
  // fall back to the most severe concerns makeup can plausibly touch
  return (Object.entries(baseline.scores) as [ConcernId, number][])
    .filter(([id, ui]) => CONCERNS[id].fixability !== "cannot" && severity(ui, params.higherIsBetter) >= params.minSeverity)
    .sort((a, b) => severity(b[1], params.higherIsBetter) - severity(a[1], params.higherIsBetter))
    .map(([id]) => id);
}

function buildEffects(
  concerns: ConcernId[],
  style: Style,
  skinHex: string,
  intensityBoost = 0,
  variantShift = 0,
  withBase = true,
): Effect[] {
  const meta = STYLE_META[style];
  const catalog = getCatalog();
  const roles = new Map<Role, number>(); // role -> intensity
  concerns.slice(0, meta.breadth).forEach((id, i) => {
    for (const role of CONCERNS[id].roles) {
      const falloff = 1 - i * 0.08;
      roles.set(role, Math.max(roles.get(role) ?? 0, meta.intensity * falloff));
    }
  });
  if (withBase && style !== "precision" && !roles.has("base_even")) {
    roles.set("base_even", style === "full" ? meta.intensity - 10 : 38);
  }
  return [...roles.entries()].map(([role, intensity]) => {
    const variants = catalog[role];
    const variant = variants[(meta.variant + variantShift) % variants.length];
    return {
      role,
      category: variant.category,
      pattern: variant.pattern,
      params: variant.params,
      color: ROLE_SHADE[role](skinHex),
      texture: ROLE_TEXTURE[role],
      intensity: Math.min(100, Math.round(intensity + intensityBoost)),
      label: variant.label,
    };
  });
}

export function planRound1(
  baseline: Analysis,
  ranked: ConcernId[],
  k = 3,
  params: ScoreParams = DEFAULT_PARAMS,
): Candidate[] {
  const concerns = addressableRanked(ranked, baseline, params);
  const styles: Style[] = ["precision", "balanced", "full"];
  return styles.slice(0, k).map((style, i) => {
    const meta = STYLE_META[style];
    const effects = buildEffects(concerns, style, observedSkinHex(baseline));
    const targets = concerns.slice(0, meta.breadth);
    return {
      id: `r1-${style}`,
      name: meta.name,
      round: 1 as const,
      targets,
      effects,
      rationale: rationaleFor(style, targets, i),
    };
  });
}

/** One refinement round: different patterns + more coverage where the best look fell short. */
export function planRound2(
  baseline: Analysis,
  ranked: ConcernId[],
  previous: EvaluatedCandidate[],
  params: ScoreParams = DEFAULT_PARAMS,
): Candidate[] {
  const concerns = addressableRanked(ranked, baseline, params);
  const best = [...previous].sort((a, b) => b.score.J - a.score.J)[0];
  const weakest = best?.score.deltas.find((d) => d.concern === best.score.topConcern)?.concern ?? concerns[0];
  const focus = [weakest, ...concerns.filter((c) => c !== weakest)];
  return [
    {
      id: "r2-focus",
      name: "Refined focus",
      round: 2 as const,
      targets: focus.slice(0, 3),
      effects: buildEffects(focus, "balanced", observedSkinHex(baseline), 12, 1),
      rationale: `The first round under-delivered on ${CONCERNS[weakest].label.toLowerCase()}, so this look swaps patterns and adds coverage right there.`,
    },
    {
      id: "r2-layered",
      name: "Layered fix",
      round: 2 as const,
      targets: focus.slice(0, 4),
      effects: buildEffects(focus, "full", observedSkinHex(baseline), 0, 2),
      rationale: `A layered base + targeted correction using alternate patterns, aimed at ${CONCERNS[weakest].label.toLowerCase()} first.`,
    },
  ];
}

function rationaleFor(style: Style, targets: ConcernId[], _i: number) {
  const names = targets.map((t) => CONCERNS[t].label.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "your top concerns";
  switch (style) {
    case "precision":
      return `Light, targeted correction for ${list}, and nothing else. Lowest intensity, least risk of a mask-like finish.`;
    case "balanced":
      return `Targets ${list} and adds a skin-tint base so corrections blend into the rest of your face.`;
    case "full":
      return `Maximum coverage for ${list}. Highest reduction potential, so it pays the biggest intensity penalty.`;
  }
}

