import { toneDepth, hexToLab, labToHex, shade } from "./color";
import { roleShade } from "./planner";
import { CONCERNS } from "./concerns";
import type { Candidate, ConcernDelta, ConcernId, Role, ToneReading } from "./types";

/**
 * "Shoppable products" are product *types* plus a target shade derived from your measured tone.
 * We don't invent brands or fake listings: each row links to a shopping search for that exact spec.
 */
const PRODUCT: Record<Role, { name: string; search: (shade: string) => string }> = {
  under_eye_correct: { name: "Peach colour-correcting concealer", search: (s) => `${s} peach colour corrector concealer dark circles` },
  cheek_nose_correct: { name: "Green colour-correcting primer", search: () => "green colour correcting primer redness" },
  spot_conceal: { name: "Full-coverage spot concealer", search: (s) => `${s} full coverage concealer for blemishes` },
  base_even: { name: "Even-coverage skin-tint foundation", search: (s) => `${s} skin tint foundation natural finish` },
  tzone_powder: { name: "Translucent mattifying powder", search: () => "translucent mattifying setting powder oily t-zone" },
  cheek_blush: { name: "Cream blush", search: (s) => `${s} cream blush` },
};

export function undertone(lab: [number, number, number]): "warm" | "cool" | "neutral" {
  const [, a, b] = lab;
  const ratio = b / Math.max(a, 1);
  if (ratio > 1.9) return "warm";
  if (ratio < 1.35) return "cool";
  return "neutral";
}

/**
 * Without YouCam's tone API (opt-in, 20 credits) we only have the raw face pixels, which read darker than the
 * person in a shadowed photo (measured on one photo: L* 44 raw vs ~61 lighting-corrected). Nudge them up before
 * judging depth or picking a shade to buy. It's an approximation, and it's only used for display / shopping,
 * never for scoring or for the render (those use the observed colour on purpose).
 */
const LOCAL_SHADOW_LIFT = 12;
const liftLocal = (lab: [number, number, number]): [number, number, number] => [Math.min(100, lab[0] + LOCAL_SHADOW_LIFT), lab[1], lab[2]];

export function describeShade(tone: ToneReading, driftLab: [number, number, number]) {
  const lab = tone.source === "api" ? hexToLab(tone.skinHex) : liftLocal(driftLab);
  const depth = toneDepth(lab);
  return { depth, undertone: undertone(lab), label: `${depth} · ${undertone(lab)} undertone` };
}

export interface ShopItem {
  role: Role;
  name: string;
  /** the shade you'd BUY (lighting-corrected tone) */
  shade: string;
  /** the shade the render actually used (matched to this photo's pixels). "Verified" refers to THIS one. */
  renderShade: string;
  why: string;
  href: string;
  /**
   * true  = a concern this product targets measurably improved, measured with `renderShade` (not `shade`)
   * false = none did; null = general-purpose layer
   */
  verified: boolean | null;
}

/**
 * A product shade you'd actually buy. The render uses a much lighter under-eye concealer (+15 L*) because
 * that's what YouCam needs to register an effect; in a shop, one to two shades lighter (~+6 L*) is the norm.
 */
function buyShade(role: Role, skinHex: string) {
  return role === "under_eye_correct" ? shade(skinHex, 6, 3, 6) : roleShade(role, skinHex);
}

export function buildShoppingList(
  c: Candidate,
  tone: ToneReading,
  driftLab: [number, number, number],
  deltas: ConcernDelta[] = [],
): ShopItem[] {
  const { label } = describeShade(tone, driftLab);
  // Products use the lighting-corrected tone (what you'd actually buy); the render used the observed colour.
  const buyHex = tone.source === "api" ? tone.skinHex : labToHex(liftLocal(driftLab));
  // Roles in the same category (e.g. several foundation roles) are merged into one request, which uses the colour of
  // the strongest layer (see buildVtoEffects in src/server/youcam.ts). Report the colour that was really sent.
  const sentColor = (category: string, fallback: string) =>
    [...c.effects].filter((x) => x.category === category).sort((a, b) => b.intensity - a.intensity)[0]?.color ?? fallback;
  return c.effects.map((e) => {
    const targeted = c.targets.filter((t: ConcernId) => CONCERNS[t].roles.includes(e.role));
    const forConcerns = targeted.map((t) => CONCERNS[t].label.toLowerCase());
    const p = PRODUCT[e.role];
    // Only claim a product is "verified" if a concern it targets measurably improved in THIS look.
    const verified = targeted.length === 0 || !deltas.length
      ? null
      : targeted.some((t) => deltas.some((d) => d.concern === t && d.confidence !== "within-noise" && d.reduction > 0));
    return {
      role: e.role,
      name: p.name,
      shade: buyShade(e.role, buyHex),
      renderShade: sentColor(e.category, e.color),
      verified,
      why: forConcerns.length ? `For ${forConcerns.join(" + ")}` : "Blends everything together",
      href: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(p.search(label.split(" · ")[0]))}`,
    };
  });
}
