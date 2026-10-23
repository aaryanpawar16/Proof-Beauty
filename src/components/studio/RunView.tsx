"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Loader2, RotateCcw } from "lucide-react";
import { CONCERNS } from "@/lib/concerns";
import { severity } from "@/lib/scoring";
import type { ConcernId, StepId } from "@/lib/types";
import { SessionImage } from "../SessionImage";
import { EASE, Tween } from "../ui";
import { fmt } from "@/lib/format";
import type { RunState } from "./useRun";

const STEPS: { id: StepId; label: string }[] = [
  { id: "baseline", label: "Baseline: concerns + tone" },
  { id: "plan", label: "Plan candidate looks" },
  { id: "render", label: "Render each look" },
  { id: "verify", label: "Verify: re-analyse renders" },
  { id: "score", label: "Score & pick" },
  { id: "refine", label: "Refine (only if weak)" },
  { id: "explain", label: "Explain" },
];

export function RunView({ state, previewUrl, onRetry }: { state: RunState; previewUrl: string; onRetry: () => void }) {
  const baselineRows = state.baseline
    ? (Object.entries(state.baseline.scores) as [ConcernId, number][])
        .map(([id, ui]) => ({ id, sev: severity(ui, state.higherIsBetter) }))
        .sort((a, b) => b.sev - a.sev)
        .slice(0, 6)
    : [];

  if (state.phase === "error") {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card border-bad/30 p-8 text-center">
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-bad/10"><AlertTriangle className="h-7 w-7 text-bad" /></span>
          <h3 className="text-xl font-semibold text-white">The loop stopped</h3>
          <p className="mt-2 text-fog">{state.error?.message}</p>
          {state.error?.code && <p className="mt-2 font-mono text-xs text-fog/60">code: {state.error.code}</p>}
          <button onClick={onRetry} className="btn-ghost mt-6"><RotateCcw className="h-4 w-4" />Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      {/* timeline */}
      <div className="card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Pipeline</h3>
          <span className="font-mono text-xs text-fog">
            <Tween value={state.unitsUsed} className="text-white" /> / ~{state.estimate ?? "…"} credits
          </span>
        </div>
        <ol className="relative space-y-1">
          <div className="absolute bottom-3 left-[0.95rem] top-3 w-px bg-line" />
          {STEPS.map((s) => {
            const st = state.steps[s.id];
            return (
              <li key={s.id} className="relative flex gap-4 py-2">
                <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-500 ${st?.status === "done" ? "border-mint bg-mint text-ink" : st?.status === "active" ? "border-rose bg-ink text-rose shadow-[0_0_24px_-2px_rgb(255_111_165/0.7)]" : "border-line-strong bg-ink text-fog/50"}`}>
                  {st?.status === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : st?.status === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className={`text-sm font-medium transition-colors ${st ? "text-white" : "text-fog/60"}`}>{s.label}</div>
                  <AnimatePresence mode="wait">
                    {st?.detail && (
                      <motion.div key={st.detail} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-0.5 text-xs leading-relaxed text-fog">
                        {st.detail}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ol>
        {state.mode === "demo" && (
          <p className="mt-5 rounded-xl border border-amber/25 bg-amber/[0.07] p-3 text-xs leading-relaxed text-amber">
            Demo mode: analysis and renders are simulated so the loop can run for free. Add a YouCam key for real measurements.
          </p>
        )}
      </div>

      {/* stage */}
      <div className="space-y-6">
        <div className="card grid gap-5 p-5 sm:grid-cols-[14rem_1fr]">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <SessionImage src={state.originalUrl ?? previewUrl} alt="Baseline" className="h-full w-full object-cover" />
            {!state.baseline && <motion.div className="absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-rose/50 to-transparent" animate={{ top: ["-10%", "90%", "-10%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />}
            <span className="absolute left-2.5 top-2.5 rounded-full bg-black/50 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-white/80 backdrop-blur">Baseline</span>
          </div>
          <div className="min-w-0">
            <div className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-fog">Measured concerns</div>
            {baselineRows.length === 0 ? (
              <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-white/[0.04]" style={{ animationDelay: `${i * 0.12}s` }} />)}</div>
            ) : (
              <div className="space-y-3.5">
                {baselineRows.map((r, i) => (
                  <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-mist">{CONCERNS[r.id].label}{CONCERNS[r.id].fixability === "cannot" && <span className="ml-2 text-fog">· not scored</span>}</span>
                      <span className="font-mono tabular-nums text-fog">{Math.round(r.sev)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <motion.div className={`h-full rounded-full ${CONCERNS[r.id].fixability === "cannot" ? "bg-fog/40" : "bg-amber"}`} initial={{ width: 0 }} animate={{ width: `${r.sev}%` }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.08 }} />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            {state.baseline && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5">
                <span className="h-7 w-7 rounded-full ring-2 ring-white/20" style={{ background: state.baseline.tone.skinHex }} />
                <div className="font-mono text-xs text-fog">skin tone <span className="text-white">{state.baseline.tone.skinHex}</span> · via {state.baseline.tone.source === "api" ? "YouCam tone API" : "local LAB sample"}</div>
              </div>
            )}
          </div>
        </div>

        {/* candidates */}
        <div>
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-fog">Candidate looks</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <AnimatePresence>
              {state.planned.map((c) => {
                const ev = state.evaluated.find((e) => e.candidate.id === c.id);
                return (
                  <motion.div key={c.id} layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: EASE }} className="card overflow-hidden">
                    <div className="relative aspect-[4/5] bg-panel-2">
                      {ev ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <motion.div initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="h-full w-full"><SessionImage src={ev.renderUrl} alt={c.name} className="h-full w-full object-cover" /></motion.div>
                      ) : (
                        <div className="grid h-full place-items-center">
                          <div className="text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-rose" />
                            <div className="mt-2 font-mono text-[0.62rem] uppercase tracking-wider text-fog">{state.steps.verify?.status === "active" ? "verifying" : "rendering"}</div>
                          </div>
                        </div>
                      )}
                      {c.round === 2 && <span className="absolute left-2 top-2 rounded-full bg-violet/90 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-ink">refined</span>}
                      {c.control && <span className="absolute left-2 top-2 rounded-full bg-amber/90 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-ink">control</span>}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{c.name}</span>
                        {ev && <motion.span initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className="font-mono text-sm tabular-nums text-mint">J {fmt(ev.score.J)}</motion.span>}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-fog">{c.control ? "integrity check · can't win" : `${c.effects.length} layers · ${c.targets.length} targets`}</div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {state.planned.length === 0 && [0, 1, 2].map((i) => <div key={i} className="aspect-[4/6] animate-pulse rounded-[1.25rem] bg-white/[0.03]" style={{ animationDelay: `${i * 0.15}s` }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
