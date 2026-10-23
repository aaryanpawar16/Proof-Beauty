export type RGB = [number, number, number];
export type LAB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const srgbToLin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const linToSrgb = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function rgbToLab([r, g, b]: RGB): LAB {
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb([L, a, b]: LAB): RGB {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const R = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  const G = X * -0.969266 + Y * 1.8760108 + Z * 0.041556;
  const B = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;
  return [linToSrgb(R), linToSrgb(G), linToSrgb(B)];
}

export const hexToLab = (hex: string) => rgbToLab(hexToRgb(hex));
export const labToHex = (lab: LAB) => rgbToHex(labToRgb(lab));

/** CIE76 colour difference. Good enough for a "did the tone move" signal. */
export function deltaE(a: LAB, b: LAB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Shift a skin tone in LAB space: used to derive concealer / corrector / powder shades. */
export function shade(skinHex: string, dL: number, da = 0, db = 0): string {
  const [L, a, b] = hexToLab(skinHex);
  return labToHex([Math.max(0, Math.min(100, L + dL)), a + da, b + db]);
}

/** Perceived lightness band, used to flag depth-of-skin-tone limitations in the write-up. */
export function toneDepth(lab: LAB): "light" | "medium" | "deep" {
  if (lab[0] > 66) return "light";
  if (lab[0] > 45) return "medium";
  return "deep";
}
