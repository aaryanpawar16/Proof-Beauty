"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import { CONCERNS } from "@/lib/concerns";
import type { RunResult, Stage2Result } from "@/lib/types";
import { SessionImage } from "../SessionImage";
import { EASE } from "../ui";
import { CapturePanel } from "./CapturePanel";

export function Stage2Panel({ result }: { result: RunResult }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Stage2Result | null>(null);

  const submit = async (blob: Blob) => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("image", blob, "applied.jpg");
    form.set("sessionId", result.sessionId);
    try {
      const res = await fetch("/api/stage2", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Stage 2 failed");
      setData(j);
      setOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-2 flex items-center gap-3">
        <span className="rounded-full border border-violet/30 bg-violet/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-violet">Stage 2</span>
        <h3 className="text-xl font-semibold text-white">Did it work on your real face?</h3>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-fog">
        Everything above measures a <em className="not-italic text-white">simulated render</em>. Apply the look for real, take a new selfie in similar light, and we&apos;ll run the same analysis and show predicted vs. measured.
      </p>

      <AnimatePresence mode="wait">
        {!open && !data && (
          <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6">
            <button className="btn-ghost" onClick={() => setOpen(true)}><Camera className="h-4.5 w-4.5" />I&apos;ve applied it, measure it</button>
          </motion.div>
        )}

        {open && (
          <motion.div key="capture" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-8">
            {busy ? (
              <div className="flex items-center justify-center gap-3 py-16 text-fog"><Loader2 className="h-5 w-5 animate-spin text-rose" />Measuring your real result…</div>
            ) : (
              <CapturePanel compact cta="Measure my result" onConfirm={(b) => submit(b)} />
            )}
            {error && <p className="mt-4 flex items-center gap-2 text-sm text-bad"><AlertTriangle className="h-4 w-4" />{error}</p>}
          </motion.div>
        )}

        {data && (
          <motion.div key="data" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line"><SessionImage src={data.measuredUrl} alt="Your applied look" className="h-full w-full object-cover" /></div>
            <div>
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Predicted vs measured reduction</span>
                <span className="flex items-center gap-4 font-mono text-[0.62rem] uppercase tracking-wider text-fog">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet" />Predicted</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-mint" />Measured</span>
                </span>
              </div>
              <div className="space-y-6">
                {data.concerns.map((r, i) => {
                  const p = Math.round(r.predictedReduction * 100), m = Math.round(r.measuredReduction * 100), gap = m - p;
                  return (
                    <div key={r.concern}>
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="font-medium text-white">{CONCERNS[r.concern].label}</span>
                        <span className="font-mono text-xs text-fog">gap <span className={gap < -5 ? "text-amber" : "text-mint"}>{gap > 0 ? "+" : ""}{gap}pt</span></span>
                      </div>
                      {[{ v: p, c: "from-violet to-[#c9b8ff]", t: "text-violet" }, { v: m, c: "from-mint to-[#a8ffe6]", t: "text-mint" }].map((b, j) => (
                        <div key={j} className="mb-1.5 flex items-center gap-3">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.div className={`h-full rounded-full bg-gradient-to-r ${b.c}`} initial={{ width: 0 }} animate={{ width: `${Math.max(2, Math.min(100, b.v * 1.6))}%` }} transition={{ delay: i * 0.12 + j * 0.15, duration: 1, ease: EASE }} />
                          </div>
                          <span className={`w-12 text-right font-mono text-sm tabular-nums ${b.t}`}>{b.v > 0 ? "−" : b.v < 0 ? "+" : ""}{Math.abs(b.v)}%</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <p className="mt-6 rounded-xl border border-line bg-white/[0.03] p-4 text-sm leading-relaxed text-mist">{data.summary}</p>
              <p className="mt-3 text-xs leading-relaxed text-fog">Different lighting between photos adds noise, so small gaps aren&apos;t meaningful. Aggregated over many users, this gap is the calibration signal for improving predictions.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
