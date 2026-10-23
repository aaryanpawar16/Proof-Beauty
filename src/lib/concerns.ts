import type { ConcernDef, ConcernId } from "./types";

export const CONCERNS: Record<ConcernId, ConcernDef> = {
  dark_circle: {
    id: "dark_circle",
    label: "Dark circles",
    apiAction: "dark_circle_v2",
    fixability: "addressable",
    region: "Under-eye",
    strategy: "Under-eye correction + concealer",
    // no whole-face base: it adds intensity penalty and brightens the face (measured) without treating the concern
    roles: ["under_eye_correct"],
  },
  redness: {
    id: "redness",
    label: "Redness",
    apiAction: "redness",
    fixability: "addressable",
    region: "Cheeks & nose",
    strategy: "Colour-correcting base on cheeks and nose",
    roles: ["cheek_nose_correct"],
  },
  age_spot: {
    id: "age_spot",
    label: "Dark spots",
    apiAction: "age_spot",
    fixability: "addressable",
    region: "Full face",
    strategy: "Spot concealing + even base",
    roles: ["spot_conceal", "base_even"],
  },
  acne: {
    id: "acne",
    label: "Acne & marks",
    apiAction: "acne",
    fixability: "addressable",
    region: "Full face",
    strategy: "Spot concealing + even base",
    roles: ["spot_conceal", "base_even"],
  },
  oiliness: {
    id: "oiliness",
    label: "Shine",
    apiAction: "oiliness",
    fixability: "addressable",
    region: "T-zone",
    strategy: "Setting powder across the T-zone",
    roles: ["tzone_powder"],
  },
  pore: {
    id: "pore",
    label: "Visible pores",
    apiAction: "pore",
    fixability: "partial",
    region: "Nose & cheeks",
    strategy: "Blurring base can soften the look",
    roles: ["base_even", "tzone_powder"],
    caveat: "Makeup can blur pores optically, but it can't change them.",
  },
  texture: {
    id: "texture",
    label: "Uneven texture",
    apiAction: "texture",
    fixability: "partial",
    region: "Full face",
    strategy: "Smoothing base",
    roles: ["base_even"],
    caveat: "A smoothing base softens the look; heavy layers can emphasise texture.",
  },
  eye_bag: {
    id: "eye_bag",
    label: "Eye bags",
    apiAction: "eye_bag",
    fixability: "partial",
    region: "Under-eye",
    strategy: "Highlight + conceal to flatten shadow",
    roles: ["under_eye_correct"],
    caveat: "Makeup can only reduce the shadow an eye bag casts, not the puffiness.",
  },
  wrinkle: {
    id: "wrinkle",
    label: "Wrinkles",
    apiAction: "wrinkle",
    fixability: "cannot",
    region: "Forehead, eyes, mouth",
    strategy: "Makeup won't fix this",
    roles: [],
    caveat: "Makeup tends to settle into lines. Skincare or a professional is the right lever.",
  },
  droopy_eyelid: {
    id: "droopy_eyelid",
    label: "Eyelid sagging",
    apiAction: "droopy_upper_eyelid",
    fixability: "cannot",
    region: "Eyes",
    strategy: "Makeup won't fix this",
    roles: [],
    caveat: "Eyelid structure isn't something makeup changes.",
  },
};

export const CONCERN_LIST = Object.values(CONCERNS);
export const ADDRESSABLE = CONCERN_LIST.filter((c) => c.fixability !== "cannot");
export const CANNOT_FIX = CONCERN_LIST.filter((c) => c.fixability === "cannot");

export function concernLabel(id: ConcernId) {
  return CONCERNS[id].label;
}
