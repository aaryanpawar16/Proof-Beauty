"use client";

import { motion } from "framer-motion";
import { ArrowRight, Camera, Rocket, Sparkles } from "lucide-react";
import { EASE, Reveal, SectionHead } from "../ui";

const ROWS = [
  { l: "Dark circles", p: 49, m: 41 },
  { l: "Redness", p: 40, m: 36 },
  { l: "Dark spots", p: 19, m: 12 },
];

export function Stage2() {
  return (
    <section id="stage2" className="relative px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Closing the loop"
          title={<>Predicted is a promise. <span className="font-display italic text-gradient-mint">Measured</span> is proof.</>}
          sub="Re-analysing a synthetic render measures the render, not your real skin. So there's a second stage: apply the look for real, take a selfie, and we run the same analysis and show predicted vs. actual."
        />

        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal>
            <div className="card h-full p-7 sm:p-9">
              <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Reduction in visible concern</span>
                <span className="flex items-center gap-4 font-mono text-[0.65rem] uppercase tracking-wider text-fog">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet" />Predicted</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-mint" />Measured</span>
                </span>
              </div>
              <div className="space-y-7">
                {ROWS.map((r, i) => (
                  <div key={r.l}>
                    <div className="mb-2.5 flex items-baseline justify-between">
                      <span className="font-medium text-white">{r.l}</span>
                      <span className="font-mono text-xs text-fog">gap <span className="text-amber">{r.m - r.p}pt</span></span>
                    </div>
                    {[{ v: r.p, c: "from-violet to-[#c9b8ff]", t: "text-violet" }, { v: r.m, c: "from-mint to-[#a8ffe6]", t: "text-mint" }].map((b, j) => (
                      <div key={j} className="mb-2 flex items-center gap-3 last:mb-0">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <motion.div className={`h-full rounded-full bg-gradient-to-r ${b.c}`} initial={{ width: 0 }} whileInView={{ width: `${b.v * 1.6}%` }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.15 + j * 0.2, duration: 1.2, ease: EASE }} />
                        </div>
                        <span className={`w-10 text-right font-mono text-sm tabular-nums ${b.t}`}>−{b.v}%</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-fog">Illustrative numbers. In the app, every value is computed from your own photos.</p>
            </div>
          </Reveal>

          <div className="flex flex-col gap-4">
            {[
              { Icon: Camera, t: "Apply it for real", d: "Use the recommended look, take a fresh selfie in similar lighting." },
              { Icon: Sparkles, t: "Same analysis, again", d: "The identical concern set runs on your real face, no simulation." },
              { Icon: Rocket, t: "Calibration, over time", d: "Aggregated across users, the predicted-vs-actual gap becomes a signal that sharpens the model. That's the roadmap." },
            ].map((s, i) => (
              <Reveal key={s.t} delay={0.1 + i * 0.1} className="flex-1">
                <div className="card flex h-full gap-4 p-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line-strong bg-white/[0.04]"><s.Icon className="h-5 w-5 text-rose" /></span>
                  <div>
                    <h3 className="font-semibold text-white">{s.t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-fog">{s.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal className="mt-8 flex justify-center">
          <span className="inline-flex items-center gap-2 font-mono text-xs text-fog">Predicted <ArrowRight className="h-3.5 w-3.5" /> applied <ArrowRight className="h-3.5 w-3.5" /> measured <ArrowRight className="h-3.5 w-3.5" /> calibrated</span>
        </Reveal>
      </div>
    </section>
  );
}
