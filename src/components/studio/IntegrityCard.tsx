"use client";

import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { labToHex } from "@/lib/color";
import { CONCERNS } from "@/lib/concerns";
import { fmt } from "@/lib/format";
import { integrityReport } from "@/lib/integrity";
import type { RunResult } from "@/lib/types";
import { SessionImage } from "../SessionImage";
import { EASE, Reveal } from "../ui";

const pct = (r: number) => Math.round(Math.abs(r) * 100);
const signed = (r: number) => (pct(r) === 0 ? "±0%" : `${r > 0 ? "−" : "+"}${pct(r)}%`);

/** Control look vs the look we picked: shows a score-gaming shortcut being caught, with the evidence. */
export function IntegrityCard({ result }: { result: RunResult }) {
  const rep = integrityReport(result);
  if (!rep) return null;

  const concern = rep.concern ? CONCERNS[rep.concern].label.toLowerCase() : "your top concern";
  const base = result.baseline.driftLab;
  const ctrlLab = rep.control.analysis.driftLab;
  const bestLab = rep.best.analysis.driftLab;
  const lighter = ctrlLab[0] - base[0];

  const head =
    rep.kind === "caught"
      ? { Icon: ShieldAlert, tone: "text-bad", ring: "border-bad/25", title: <>We caught a try-on <span className="font-display italic text-gradient">cheating.</span></> }
      : rep.kind === "tie"
        ? { Icon: ShieldAlert, tone: "text-amber", ring: "border-amber/25", title: <>The score <span className="font-display italic text-gradient">couldn&apos;t tell them apart.</span></> }
        : rep.kind === "held"
        ? { Icon: ShieldCheck, tone: "text-amber", ring: "border-amber/25", title: <>We tested a shortcut. <span className="font-display italic text-gradient">It didn&apos;t pay.</span></> }
        : { Icon: ShieldQuestion, tone: "text-fog", ring: "border-line-strong", title: <>We tested a shortcut. <span className="font-display italic text-gradient">Nothing to catch.</span></> };

  const lightWord = `${fmt(Math.abs(lighter), 1)} L* ${lighter >= 0 ? "lighter" : "darker"}`;
  const body =
    rep.kind === "tie"
      ? `The brightening shortcut scored about the same as our pick on ${concern} (${pct(rep.controlReduction)}% vs ${pct(rep.bestReduction)}%, a gap of ${fmt(Math.abs(rep.gapPoints), 1)} point${Math.abs(rep.gapPoints) === 1 ? "" : "s"} against ±${fmt(rep.noise, 1)} of measurement noise). But it got there by making your face ${lightWord} (a shade shift of ΔE ${fmt(rep.controlDE, 1)}), not by treating ${concern}. A try-on that only watches the score can't tell a treatment from a brightening filter. The shade check can, so we rejected it.`
      : rep.kind === "caught"
      ? `A try-on that only watches the score would have recommended the brightening look: it improves ${concern} by ${pct(rep.controlReduction)}% against ${pct(rep.bestReduction)}% for ours. But it got there by making your face ${fmt(Math.abs(lighter), 1)} L* ${lighter >= 0 ? "lighter" : "darker"} (a shade shift of ΔE ${fmt(rep.controlDE, 1)}), not by treating ${concern}. The score went up; your skin didn't improve. We rejected it.`
      : rep.kind === "held"
        ? `The brightening shortcut shifted your shade by ΔE ${fmt(rep.controlDE, 1)} and still didn't beat real treatment of ${concern}, so even a score-only approach wouldn't have been fooled on this photo.`
        : `The brightening shortcut kept your shade within ΔE ${fmt(rep.controlDE, 1)}, so there was no mismatch to flag on this photo. We report that instead of hiding it.`;

  const side = (
    label: string,
    sub: string,
    ev: typeof rep.control,
    reduction: number,
    de: number,
    bad: boolean,
    delay: number,
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={`relative overflow-hidden rounded-2xl border bg-white/[0.02] ${bad ? "border-bad/25" : "border-mint/25"}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-panel-2">
        <SessionImage src={ev.renderUrl} alt={label} className="h-full w-full object-cover" />
        <span className={`absolute left-3 top-3 rounded-full border bg-black/65 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider backdrop-blur ${bad ? "border-bad/40 text-bad" : "border-mint/40 text-mint"}`}>{label}</span>
      </div>
      <div className="p-4">
        <div className="text-xs text-fog">{sub}</div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className={`font-mono text-3xl font-semibold tabular-nums ${bad ? "text-bad" : "text-mint"}`}>{signed(reduction)}</div>
            <div className="font-mono text-[0.6rem] uppercase tracking-wider text-fog">{concern} (measured)</div>
          </div>
          <span className={`rounded-full border px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-wider ${bad ? "border-bad/30 bg-bad/10 text-bad" : "border-mint/30 bg-mint/10 text-mint"}`}>
            {bad ? `shade shifted ΔE ${fmt(de, 1)}` : `shade held ΔE ${fmt(de, 1)}`}
          </span>
        </div>
      </div>
    </motion.div>
  );

  const swatch = (hex: string, label: string, de?: number) => (
    <div className="flex items-center gap-2.5">
      <span className="h-9 w-9 rounded-full ring-2 ring-white/20" style={{ background: hex }} />
      <div>
        <div className="text-xs text-white">{label}</div>
        <div className="font-mono text-[0.62rem] text-fog">{hex}{de !== undefined && ` · ΔE ${fmt(de, 1)}`}</div>
      </div>
    </div>
  );

  return (
    <Reveal>
      <div className={`card p-6 sm:p-8 ${head.ring}`}>
        <div className="mb-2 flex items-center gap-2.5">
          <head.Icon className={`h-5 w-5 ${head.tone}`} />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-fog">Integrity check</span>
        </div>
        <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{head.title}</h3>

        <div className="mt-7 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
          {side(
            "Score-only pick",
            "What a try-on that only watches the number would recommend",
            rep.control,
            rep.controlReduction,
            rep.controlDE,
            rep.kind !== "clean",
            0,
          )}
          <div className="grid place-items-center">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-line-strong bg-ink font-mono text-xs text-fog">VS</span>
          </div>
          {side(`Our pick · ${rep.best.candidate.name}`, "Judged on the score AND on whether it still looks like your skin", rep.best, rep.bestReduction, rep.bestDE, false, 0.12)}
        </div>

        <p className="mt-6 max-w-3xl text-[0.95rem] leading-relaxed text-mist">{body}</p>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-line bg-white/[0.02] px-5 py-4">
          {swatch(labToHex(base), "Your skin in the photo")}
          <span className="text-fog">→</span>
          {swatch(labToHex(ctrlLab), "Score-only pick", rep.controlDE)}
          {swatch(labToHex(bestLab), "Our pick", rep.bestDE)}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-fog">
          The score-only pick is a deliberate control: a whole-face foundation a few shades too light. It is rendered and measured on every run{result.params.lookCost ? ` (${result.params.lookCost} extra credits)` : ""} and can never be recommended.
        </p>
      </div>
    </Reveal>
  );
}
