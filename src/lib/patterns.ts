import type { Role } from "./types";

/**
 * Role -> YouCam makeup-vto effect. This is the ONE place that knows what each role renders as.
 *
 * Verified against YouCam's published makeup-vto schema (the MCP tool definition):
 *  - `concealer`  : NO pattern. palettes[{color, colorIntensity, colorUnderEyeIntensity, coverageLevel}] all required.
 *  - `foundation` : NO pattern. palettes[{color, colorIntensity, glowIntensity, coverageIntensity}] all required.
 *  - `skin_smooth`: no palettes. {skinSmoothStrength, skinSmoothColorIntensity}.
 *  - `blush`      : pattern {name} + palettes[{color, texture: matte|satin|shimmer, colorIntensity}] ("2colors6" works).
 *  - There is no powder category, so shine control = a matte foundation (glowIntensity 0).
 *
 * Because concealer/foundation have no patterns, the 3 variants per role differ by `params` instead:
 *   underEye / coverage are multipliers of the effect's intensity; glow is absolute (0 = matte).
 * Roles that share a category (e.g. several foundation roles) are merged into one effect when the
 * request is built (see buildVtoEffects in src/server/youcam.ts).
 */
export interface PatternVariant {
  category: string;
  /** only for categories that take a pattern (blush, contour, …) */
  pattern?: string;
  label: string;
  params?: { underEye?: number; coverage?: number; glow?: number; smooth?: number };
}

export const PATTERN_CATALOG: Record<Role, PatternVariant[]> = {
  under_eye_correct: [
    { category: "concealer", label: "Soft under-eye concealer", params: { underEye: 1, coverage: 0.55 } },
    { category: "concealer", label: "Brightening under-eye correction", params: { underEye: 1, coverage: 0.8 } },
    { category: "concealer", label: "Heavy under-eye cover", params: { underEye: 1, coverage: 1 } },
  ],
  cheek_nose_correct: [
    { category: "foundation", label: "Sheer colour-correcting veil", params: { coverage: 0.5, glow: 25 } },
    { category: "foundation", label: "Medium redness corrector", params: { coverage: 0.7, glow: 20 } },
    { category: "foundation", label: "Full redness corrector", params: { coverage: 0.9, glow: 15 } },
  ],
  spot_conceal: [
    { category: "concealer", label: "Targeted spot concealer", params: { underEye: 0.3, coverage: 0.8 } },
    { category: "concealer", label: "Buildable spot coverage", params: { underEye: 0.3, coverage: 1 } },
    { category: "concealer", label: "High-coverage spot pass", params: { underEye: 0.5, coverage: 1.2 } },
  ],
  base_even: [
    { category: "foundation", label: "Skin-tint base", params: { coverage: 0.5, glow: 35 } },
    { category: "foundation", label: "Even satin base", params: { coverage: 0.7, glow: 30 } },
    { category: "foundation", label: "Full-coverage base", params: { coverage: 0.95, glow: 25 } },
  ],
  tzone_powder: [
    { category: "foundation", label: "Light matte finish", params: { coverage: 0.35, glow: 0 } },
    { category: "foundation", label: "Matte oil-control finish", params: { coverage: 0.5, glow: 0 } },
    { category: "foundation", label: "Full matte finish", params: { coverage: 0.65, glow: 0 } },
  ],
  cheek_blush: [
    { category: "blush", pattern: "2colors6", label: "Soft cheek flush" },
    { category: "blush", pattern: "2colors6", label: "Soft cheek flush" },
    { category: "blush", pattern: "2colors6", label: "Soft cheek flush" },
  ],
};

export function getCatalog(): Record<Role, PatternVariant[]> {
  const raw = typeof process !== "undefined" ? process.env.PATTERN_OVERRIDES : undefined;
  if (!raw) return PATTERN_CATALOG;
  try {
    const o = JSON.parse(raw) as Partial<Record<Role, Partial<PatternVariant> | Partial<PatternVariant>[]>>;
    const merged = { ...PATTERN_CATALOG };
    for (const [role, v] of Object.entries(o) as [Role, Partial<PatternVariant> | Partial<PatternVariant>[]][]) {
      const list = Array.isArray(v) ? v : [v];
      merged[role] = [0, 1, 2].map((i) => ({
        ...PATTERN_CATALOG[role][i],
        ...(list[i] ?? list[0]),
      })) as PatternVariant[];
    }
    return merged;
  } catch {
    return PATTERN_CATALOG;
  }
}
