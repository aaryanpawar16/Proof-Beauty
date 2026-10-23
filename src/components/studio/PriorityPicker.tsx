"use client";

import { AnimatePresence, Reorder, motion } from "framer-motion";
import { ArrowRight, Ban, GripVertical, Plus, X } from "lucide-react";
import { CONCERN_LIST, CONCERNS } from "@/lib/concerns";
import type { ConcernId } from "@/lib/types";

interface Status {
  exhausted?: boolean;
  mode: "live" | "demo";
  left: number;
  budget: number;
  perRun: number;
  perRunMax: number;
  runsLeft: number;
}

export function PriorityPicker({ ranked, setRanked, onRun, status, previewUrl }: {
  ranked: ConcernId[];
  setRanked: (r: ConcernId[]) => void;
  onRun: () => void;
  status: Status | null;
  previewUrl: string;
}) {
  const toggle = (id: ConcernId) => {
    if (CONCERNS[id].fixability === "cannot") return;
    setRanked(ranked.includes(id) ? ranked.filter((x) => x !== id) : ranked.length >= 4 ? ranked : [...ranked, id]);
  };

  // out of credits: the run still works, but on the simulated engine, so say so on the button
  const dry = status?.mode === "live" && (Boolean(status.exhausted) || status.left < status.perRun);
  // (the server decides for real; `exhausted` expires there after 30 min so a top-up is picked up)

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">What bothers you <span className="font-display italic text-gradient">most?</span></h2>
        <p className="mt-3 max-w-xl text-fog">Pick up to four, then drag to rank them. Your top concern gets the most weight when we score each look.</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CONCERN_LIST.map((c, i) => {
            const idx = ranked.indexOf(c.id);
            const on = idx >= 0;
            const cannot = c.fixability === "cannot";
            return (
              <motion.button
                key={c.id}
                onClick={() => toggle(c.id)}
                disabled={cannot}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={cannot ? undefined : { y: -3 }}
                whileTap={cannot ? undefined : { scale: 0.98 }}
                className={`relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${on ? "border-rose/50 bg-rose/[0.08]" : cannot ? "cursor-not-allowed border-line bg-white/[0.01] opacity-60" : "border-line bg-white/[0.025] hover:border-line-strong"}`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-sm transition-colors ${on ? "bg-gradient-to-br from-rose to-violet font-semibold text-ink" : cannot ? "bg-bad/10 text-bad" : "bg-white/[0.06] text-fog"}`}>
                  {on ? idx + 1 : cannot ? <Ban className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-white">{c.label}</span>
                  <span className="block truncate text-xs text-fog">{cannot ? "Makeup won't fix this" : c.fixability === "partial" ? `Partly · ${c.region}` : c.region}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-fog">Wrinkles and eyelid sagging are still measured and reported, but never scored. Makeup can&apos;t honestly change them.</p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Your selfie" className="aspect-[4/3] w-full object-cover" />
        </div>

        <div className="card p-5">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-fog">Your ranking</div>
          {ranked.length === 0 ? (
            <p className="text-sm text-fog">Nothing picked. We&apos;ll rank by what we measure as most visible.</p>
          ) : (
            <Reorder.Group axis="y" values={ranked} onReorder={setRanked} className="space-y-2">
              <AnimatePresence initial={false}>
                {ranked.map((id, i) => (
                  <Reorder.Item key={id} value={id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} whileDrag={{ scale: 1.03, boxShadow: "0 18px 40px -12px rgb(0 0 0 / 0.8)" }} className="flex cursor-grab items-center gap-3 rounded-xl border border-line-strong bg-panel-2 px-3 py-2.5 active:cursor-grabbing">
                    <GripVertical className="h-4 w-4 text-fog" />
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-rose to-violet font-mono text-xs font-semibold text-ink">{i + 1}</span>
                    <span className="flex-1 text-sm text-white">{CONCERNS[id].label}</span>
                    <span className="font-mono text-[0.65rem] text-fog">w {Math.round((Math.pow(0.62, i) / ranked.reduce((s, _, k) => s + Math.pow(0.62, k), 0)) * 100)}%</span>
                    <button onClick={() => toggle(id)} aria-label={`Remove ${CONCERNS[id].label}`} className="text-fog transition-colors hover:text-white"><X className="h-4 w-4" /></button>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Credits</span>
            <span className={`rounded-full border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider ${status?.mode === "live" ? "border-mint/30 bg-mint/10 text-mint" : "border-amber/30 bg-amber/10 text-amber"}`}>{status?.mode === "live" ? "Live · YouCam" : "Demo · simulated"}</span>
          </div>
          {status && (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-4xl text-white">{status.left}</span>
                <span className="text-sm text-fog">of {status.budget} credits left (estimate)</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-rose via-violet to-mint" initial={{ width: 0 }} animate={{ width: `${(status.left / status.budget) * 100}%` }} transition={{ duration: 1 }} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-fog">
                A run costs about <span className="text-white">{status.perRun}</span> credits (up to {status.perRunMax} with a refinement round). {status.mode === "live" ? <>Costs come from your YouCam usage export. The YouCam console has your exact balance. After a top-up, raise <code className="font-mono">CREDIT_BUDGET</code> in .env by the amount you added.</> : "Demo mode spends nothing."}
              </p>
            </>
          )}
        </div>

        {status?.exhausted && (
          <div className="rounded-2xl border border-amber/30 bg-amber/[0.07] p-4 text-sm leading-relaxed text-amber">
            <div className="mb-1 font-medium">The real YouCam credits for this deployment are used up.</div>
            <span className="text-amber/80">Runs now use the simulated engine and are labelled as demo data. After adding credits, runs go back to live YouCam automatically within about 30 minutes.</span>
          </div>
        )}
        <button className="btn-primary group justify-center" onClick={onRun}>
          {dry ? "Run in demo mode (simulated)" : "Run the verification loop"}
          <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
        </button>
        {dry && <p className="-mt-2 text-center text-xs text-amber">The shared YouCam credit pool is used up, so this will use simulated data and say so. The recorded video shows the real run.</p>}
      </div>
    </div>
  );
}
