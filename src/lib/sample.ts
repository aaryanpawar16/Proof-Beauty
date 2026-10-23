import { adjustedReduction, toneDriftPenaltyOf } from "./scoring";

/** Illustrative sample used by the landing page. Scored with the real scoring functions. */
export type SampleConcern = "dark_circle" | "redness" | "age_spot";

export const SAMPLE_CONCERNS: { id: SampleConcern; label: string; base: number }[] = [
  { id: "dark_circle", label: "Dark circles", base: 62 },
  { id: "redness", label: "Redness", base: 48 },
  { id: "age_spot", label: "Dark spots", base: 37 },
];

export const SAMPLE_CANDIDATES = [
  { name: "Precision", note: "light, targeted", render: { dark_circle: 41, redness: 45, age_spot: 36 }, dE: 1.2, intensity: 0.26 },
  { name: "Balanced", note: "targets + skin tint", render: { dark_circle: 31, redness: 29, age_spot: 30 }, dE: 2.6, intensity: 0.5 },
  { name: "Full cover", note: "max coverage", render: { dark_circle: 22, redness: 20, age_spot: 18 }, dE: 7.4, intensity: 0.88 },
] as const;

export const SAMPLE_DEFAULTS = { top: "dark_circle" as SampleConcern, lambda: 0.35, mu: 0.25, noise: 3 };

export function scoreSample(top: SampleConcern, lambda: number, mu: number, noise: number) {
  const order = [SAMPLE_CONCERNS.find((c) => c.id === top)!, ...SAMPLE_CONCERNS.filter((c) => c.id !== top)];
  const raw = order.map((_, i) => Math.pow(0.62, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  const w = Object.fromEntries(order.map((c, i) => [c.id, raw[i] / sum])) as Record<SampleConcern, number>;
  const topBase = SAMPLE_CONCERNS.find((k) => k.id === top)!.base;

  return SAMPLE_CANDIDATES.map((c) => {
    const cov = SAMPLE_CONCERNS.reduce((s, k) => s + w[k.id] * adjustedReduction(k.base, c.render[k.id], noise), 0);
    const drift = lambda * toneDriftPenaltyOf(c.dE);
    const inten = mu * c.intensity;
    return { ...c, cov, drift, inten, J: cov - drift - inten, topRed: adjustedReduction(topBase, c.render[top], noise) };
  }).sort((a, b) => b.J - a.J);
}
