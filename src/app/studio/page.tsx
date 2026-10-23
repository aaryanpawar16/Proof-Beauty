"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CapturePanel } from "@/components/studio/CapturePanel";
import { PriorityPicker } from "@/components/studio/PriorityPicker";
import { ResultsView } from "@/components/studio/ResultsView";
import { RunView } from "@/components/studio/RunView";
import { useRun } from "@/components/studio/useRun";
import { clearSessionImages, preloadPhotos } from "@/components/SessionImage";
import { Aurora, EASE, Logo } from "@/components/ui";
import type { ConcernId } from "@/lib/types";

type Phase = "capture" | "priorities" | "run" | "results";
const STEPS: { id: Phase; label: string }[] = [
  { id: "capture", label: "Capture" },
  { id: "priorities", label: "Priorities" },
  { id: "run", label: "Verify" },
  { id: "results", label: "Results" },
];

interface Status { mode: "live" | "demo"; left: number; budget: number; perRun: number; perRunMax: number; runsLeft: number; exhausted?: boolean }

export default function Studio() {
  const [phase, setPhase] = useState<Phase>("capture");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [ranked, setRanked] = useState<ConcernId[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { state, start, reset } = useRun();

  const refreshStatus = useCallback(() => fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {}), []);
  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // Open results only once every photo is already in memory (capped at 6s), so the before/after slider never
  // appears as two empty panels. Keyed on the session so a later reworded explanation doesn't re-run this.
  const sessionId = state.result?.sessionId;
  useEffect(() => {
    const r = state.result;
    if (state.phase !== "done" || !r) return;
    let alive = true;
    const urls = [r.originalUrl, ...r.evaluated.map((e) => e.renderUrl), ...(r.control ? [r.control.renderUrl] : [])];
    preloadPhotos(urls).then(() => {
      if (!alive) return;
      setPhase("results");
      refreshStatus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, sessionId, refreshStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const run = () => {
    if (!photo) return;
    setPhase("run");
    window.scrollTo({ top: 0, behavior: "smooth" });
    start(photo.blob, ranked);
  };

  const restart = () => {
    reset();
    clearSessionImages(); // photos must not linger in browser memory after "Start over" / "Delete my photos"
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setRanked([]);
    setPhase("capture");
    refreshStatus();
  };

  const deletePhotos = async () => {
    const id = state.result?.sessionId;
    if (!id) return;
    setDeleting(true);
    await fetch(`/api/session/${id}`, { method: "DELETE" }).catch(() => {});
    setDeleting(false);
    restart();
    setToast("Your photos and cached analyses were deleted.");
  };

  const idx = STEPS.findIndex((s) => s.id === phase);

  return (
    <div className="relative isolate min-h-dvh">
      <Aurora className="opacity-60" />
      <div className="grid-bg absolute inset-x-0 top-0 -z-10 h-[40rem] opacity-60" />

      <header className="sticky top-0 z-40 border-b border-line bg-ink/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-fog transition-colors hover:text-white"><ChevronLeft className="h-4 w-4" /></Link>
            <Logo />
          </div>

          <ol className="hidden items-center gap-1 md:flex">
            {STEPS.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1">
                <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${i === idx ? "bg-white/10 text-white" : i < idx ? "text-mint" : "text-fog/60"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[0.62rem] ${i < idx ? "bg-mint text-ink" : i === idx ? "bg-gradient-to-br from-rose to-violet text-ink" : "border border-line-strong"}`}>
                    {i < idx ? <Check className="h-3 w-3" strokeWidth={3.5} /> : i + 1}
                  </span>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className={`h-px w-6 ${i < idx ? "bg-mint/50" : "bg-line"}`} />}
              </li>
            ))}
          </ol>

          <div className="flex items-center gap-3">
            {status && (
              <span className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-wider sm:flex ${status.exhausted ? "border-bad/40 bg-bad/10 text-bad" : status.mode === "live" ? "border-mint/30 bg-mint/10 text-mint" : "border-amber/30 bg-amber/10 text-amber"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.exhausted ? "bg-bad" : status.mode === "live" ? "bg-mint" : "bg-amber"}`} />
                {status.exhausted ? "YouCam credits used up" : status.mode === "live" ? `Live · ${status.left} credits` : "Demo mode"}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-28 pt-10 sm:pt-14">
        <AnimatePresence mode="wait">
          <motion.div key={phase} initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -16, filter: "blur(6px)" }} transition={{ duration: 0.5, ease: EASE }}>
            {phase === "capture" && (
              <>
                <div className="mb-10 max-w-2xl">
                  <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Let&apos;s take a <span className="font-display italic text-gradient">good</span> selfie.</h1>
                  <p className="mt-3 text-fog">The quality gate runs on your device and rejects bad photos before they cost a credit.</p>
                </div>
                <CapturePanel onConfirm={(blob, url) => { setPhoto({ blob, url }); setPhase("priorities"); }} />
              </>
            )}
            {phase === "priorities" && photo && <PriorityPicker ranked={ranked} setRanked={setRanked} onRun={run} status={status} previewUrl={photo.url} />}
            {phase === "run" && photo && (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Running the <span className="font-display italic text-gradient">verification loop</span></h1>
                  <p className="mt-2 text-fog">Baseline → plan → render → verify → score. Nothing here is a guess.</p>
                </div>
                <RunView state={state} previewUrl={photo.url} onRetry={() => { reset(); setPhase("priorities"); refreshStatus(); }} />
              </>
            )}
            {phase === "results" && state.result && <ResultsView result={state.result} onRestart={restart} onDelete={deletePhotos} deleting={deleting} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm text-white">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
