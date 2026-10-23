"use client";

import { motion } from "framer-motion";
import { Check, ScanFace, Sun, Target, Focus, Sparkles, ShoppingBag } from "lucide-react";
import { SAMPLE_DEFAULTS, scoreSample } from "@/lib/sample";
import { EASE } from "../ui";

/** Small animated mock-ups, one per pipeline step. */

const row = (i: number) => ({ initial: { opacity: 0, x: -14 }, animate: { opacity: 1, x: 0 }, transition: { delay: 0.12 + i * 0.1, duration: 0.6, ease: EASE } });

export function VisualGate() {
  const checks = [
    { icon: ScanFace, label: "Face detected", value: "1 face · centred" },
    { icon: Focus, label: "Sharpness", value: "Laplacian var 148" },
    { icon: Sun, label: "Lighting", value: "mean 128 · 0.4% clipped" },
    { icon: Target, label: "Head pose", value: "yaw 3° · roll 1°" },
  ];
  return (
    <div className="space-y-3">
      {checks.map((c, i) => (
        <motion.div key={c.label} {...row(i)} className="flex items-center gap-4 rounded-2xl border border-line bg-white/[0.03] px-4 py-3.5">
          <c.icon className="h-5 w-5 text-fog" />
          <div className="flex-1">
            <div className="text-sm font-medium text-white">{c.label}</div>
            <div className="font-mono text-xs text-fog">{c.value}</div>
          </div>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.12, type: "spring", stiffness: 400, damping: 18 }} className="grid h-6 w-6 place-items-center rounded-full bg-mint text-ink">
            <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
          </motion.span>
        </motion.div>
      ))}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="px-1 pt-1 font-mono text-xs text-fog">
        Bad photo? Rejected here, before any credit is spent.
      </motion.p>
    </div>
  );
}

export function VisualBaseline() {
  const items = [
    { l: "Dark circles", v: 62, c: "bg-amber" },
    { l: "Redness", v: 48, c: "bg-amber" },
    { l: "Shine", v: 55, c: "bg-amber" },
    { l: "Dark spots", v: 37, c: "bg-amber" },
    { l: "Wrinkles", v: 24, c: "bg-fog/50", cannot: true },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.03] p-3.5">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="h-9 w-9 rounded-full ring-2 ring-white/20" style={{ background: "#D9A98A" }} />
        <div>
          <div className="text-sm font-medium text-white">Skin tone</div>
          <div className="font-mono text-xs text-fog">#D9A98A · medium · warm undertone</div>
        </div>
      </div>
      {items.map((it, i) => (
        <motion.div key={it.l} {...row(i + 1)}>
          <div className="mb-1.5 flex justify-between font-mono text-xs">
            <span className="text-mist">{it.l}{it.cannot && <span className="ml-2 text-fog">· makeup won&apos;t fix</span>}</span>
            <span className="tabular-nums text-fog">{it.v}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div className={`h-full rounded-full ${it.c}`} initial={{ width: 0 }} animate={{ width: `${it.v}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 1, ease: EASE }} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function VisualPlan() {
  const cands = [
    { n: "Precision", t: ["Under-eye correct"], i: 55 },
    { n: "Balanced", t: ["Under-eye correct", "Cheek corrector", "Skin tint"], i: 62 },
    { n: "Full cover", t: ["Under-eye", "Cheek + nose", "Spot conceal", "Base", "T-zone powder"], i: 78 },
  ];
  return (
    <div className="space-y-3">
      {cands.map((c, i) => (
        <motion.div key={c.n} {...row(i)} className="rounded-2xl border border-line bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{c.n}</span>
            <span className="font-mono text-xs text-fog">intensity {c.i}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.t.map((t) => (
              <span key={t} className="rounded-full border border-rose/25 bg-rose/10 px-2.5 py-1 text-[0.7rem] text-rose">{t}</span>
            ))}
          </div>
        </motion.div>
      ))}
      <p className="px-1 font-mono text-xs text-fog">Rule table: dark circles → under-eye correction · redness → colour-correct · shine → T-zone powder</p>
    </div>
  );
}

export function VisualVerify() {
  return (
    <div>
      <div className="relative aspect-[16/11] overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-white/[0.07] to-white/[0.01]">
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative border-r border-white/10">
            <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-wider text-fog">Before</span>
            {[[34, 52, 22], [62, 70, 26]].map(([x, y, r], i) => (
              <motion.span key={i} className="absolute rounded-full bg-amber/35 blur-md" style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2 }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }} />
            ))}
          </div>
          <div className="relative">
            <span className="absolute right-3 top-3 rounded-full bg-mint/20 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-wider text-mint">Render</span>
            {[[34, 52, 22], [62, 70, 26]].map(([x, y, r], i) => (
              <span key={i} className="absolute rounded-full bg-mint/15 blur-md" style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2 }} />
            ))}
          </div>
        </div>
        <motion.div className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-white to-transparent" animate={{ left: ["0%", "100%", "0%"] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <span className="absolute -left-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-lg">⇆</span>
        </motion.div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[["Dark circles", "62 → 31"], ["Redness", "48 → 29"], ["Tone drift", "ΔE 1.8"]].map(([l, v], i) => (
          <motion.div key={l} {...row(i)} className="rounded-xl border border-line bg-white/[0.03] px-2 py-3">
            <div className="font-mono text-[0.6rem] uppercase tracking-wider text-fog">{l}</div>
            <div className="mt-1 font-mono text-sm font-semibold text-mint">{v}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function VisualScore() {
  // same sample + scoring function as the interactive playground, at its default settings
  const scored = scoreSample(SAMPLE_DEFAULTS.top, SAMPLE_DEFAULTS.lambda, SAMPLE_DEFAULTS.mu, SAMPLE_DEFAULTS.noise);
  const max = Math.max(...scored.map((s) => s.J));
  const rows = scored.map((s) => ({ n: s.name, J: s.J, win: s.J === max }));
  return (
    <div className="space-y-5">
      <motion.div {...row(0)} className="rounded-2xl border border-line bg-white/[0.03] p-4 text-center font-mono text-sm text-mist">
        J = <span className="text-mint">Σ w·reduction</span> − <span className="text-amber">λ·drift</span> − <span className="text-bad">μ·intensity</span>
      </motion.div>
      {rows.map((r, i) => (
        <motion.div key={r.n} {...row(i + 1)}>
          <div className="mb-1.5 flex justify-between font-mono text-xs">
            <span className={r.win ? "text-white" : "text-fog"}>{r.n}{r.win && " ★ best"}</span>
            <span className="tabular-nums text-fog">J {r.J.toFixed(2)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div className={`h-full rounded-full ${r.win ? "bg-gradient-to-r from-rose via-violet to-peach" : "bg-white/25"}`} initial={{ width: 0 }} animate={{ width: `${Math.max(4, (r.J / max) * 92)}%` }} transition={{ delay: 0.4 + i * 0.12, duration: 1, ease: EASE }} />
          </div>
        </motion.div>
      ))}
      <motion.p {...row(5)} className="rounded-xl border border-amber/20 bg-amber/[0.06] px-4 py-3 text-xs leading-relaxed text-amber/90">
        Top-concern reduction under 20%? One refinement round with different patterns, then stop. Capped at two rounds.
      </motion.p>
    </div>
  );
}

export function VisualExplain() {
  return (
    <div className="space-y-3">
      {[
        "Balanced cut visible dark circles by 45% (62 → 31), confidence: clear.",
        "Makeup won't fix wrinkles. We left them out of scoring.",
        "Tone drift ΔE 1.8: it should read as your skin, not a mask.",
      ].map((t, i) => (
        <motion.div key={t} {...row(i)} className="flex gap-3 rounded-2xl border border-line bg-white/[0.03] p-4 text-sm leading-relaxed text-mist">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
          {t}
        </motion.div>
      ))}
      <motion.div {...row(3)} className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.03] p-4">
        <ShoppingBag className="h-5 w-5 text-peach" />
        <div className="flex flex-1 gap-2">
          {["#EDB895", "#E4A98C", "#D9A98A"].map((c) => (
            <span key={c} className="h-6 w-6 rounded-full ring-1 ring-white/20" style={{ background: c }} />
          ))}
        </div>
        <span className="font-mono text-xs text-fog">shade-matched products</span>
      </motion.div>
    </div>
  );
}
