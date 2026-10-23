import { CONCERNS } from "@/lib/concerns";
import { intensityOf } from "@/lib/scoring";
import type { ConcernId, ConcernScores, ToneReading } from "@/lib/types";
import type { AnalyzeHint, Engine, ImageRef } from "./engine";
import { mockRender, sampleFaceLab, sha } from "./imaging";

/**
 * DEMO engine. Same interface as the live YouCam engine, but synthetic and free. It exists so the UI
 * and scoring loop can be developed and shown without spending credits, and it is always labelled
 * as demo data in the UI. It must never be mistaken for real measurements.
 */

function rng(seed: string) {
  let a = parseInt(sha(seed, 8), 16) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number) => (r() + r() + r() - 1.5) * 1.6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const EFFICACY = { addressable: 0.62, partial: 0.28, cannot: 0 } as const;

function baselineSeverity(id: ConcernId, r: () => number) {
  const range: Record<ConcernId, [number, number]> = {
    dark_circle: [30, 68],
    redness: [22, 60],
    age_spot: [18, 52],
    acne: [14, 50],
    oiliness: [20, 58],
    pore: [24, 56],
    texture: [20, 50],
    eye_bag: [18, 48],
    wrinkle: [14, 42],
    droopy_eyelid: [10, 34],
  };
  const [lo, hi] = range[id];
  return lo + r() * (hi - lo);
}

export const demoEngine: Engine = {
  mode: "demo",

  async analyze(src: ImageRef, concerns: ConcernId[], hint?: AnalyzeHint) {
    await sleep(650 + Math.random() * 450);
    const scores: ConcernScores = {};
    const base = rng(`base:${src.hash.slice(0, 12)}`);
    const effectKey = hint?.effects ? JSON.stringify(hint.effects) : src.hash;
    const jitter = rng(`render:${src.hash}:${effectKey}`);

    for (const id of concerns) {
      const sev0 = hint?.baseline?.[id] !== undefined ? 100 - hint.baseline[id]! : baselineSeverity(id, base);
      let sev = sev0;
      if (hint?.effects) {
        const roles = new Set(CONCERNS[id].roles);
        let keep = 1;
        for (const e of hint.effects) {
          if (roles.has(e.role)) keep *= 1 - (e.intensity / 100) * EFFICACY[CONCERNS[id].fixability];
        }
        let red = Math.min(0.8, 1 - keep);
        // the control look "cheats": brightening the whole face lifts these scores without treating anything
        if (hint.effects.some((e) => e.naive) && ["dark_circle", "eye_bag", "age_spot"].includes(id)) red = Math.min(0.8, red + 0.7);
        if (hint.realWorld) red *= 0.5 + jitter() * 0.38; // real application never matches the simulation
        sev = sev0 * (1 - red) + gauss(jitter);
      } else if (hint?.realWorld) {
        sev = sev0 + gauss(jitter);
      }
      scores[id] = Math.max(0, Math.min(100, 100 - sev));
    }
    return { scores, overlays: {}, overall: undefined };
  },

  async tone(src: ImageRef): Promise<ToneReading> {
    await sleep(350);
    const { lab, hex } = await sampleFaceLab(src.buf);
    return { skinHex: hex, lab, source: "local" };
  },

  async render(src, effects) {
    await sleep(900 + Math.random() * 700);
    const lift = effects.some((e) => e.naive) ? 0.24 : 0; // the control look visibly brightens the face
    return { buf: await mockRender(src.buf, intensityOf(effects), lift) };
  },
};
