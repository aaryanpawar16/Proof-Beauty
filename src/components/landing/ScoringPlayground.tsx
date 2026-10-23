"use client";

import { motion } from "framer-motion";
import { Crown, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { SAMPLE_CONCERNS as CONCERNS, SAMPLE_DEFAULTS as DEFAULTS, scoreSample, type SampleConcern as Cid } from "@/lib/sample";
import { Reveal, SectionHead, Tween } from "../ui";

export function ScoringPlayground() {
  const [top, setTop] = useState<Cid>(DEFAULTS.top);
  const [lambda, setLambda] = useState(DEFAULTS.lambda);
  const [mu, setMu] = useState(DEFAULTS.mu);
  const [noise, setNoise] = useState(DEFAULTS.noise);

  const rows = useMemo(() => scoreSample(top, lambda, mu, noise), [top, lambda, mu, noise]);

  const changed = top !== DEFAULTS.top || lambda !== DEFAULTS.lambda || mu !== DEFAULTS.mu || noise !== DEFAULTS.noise;

  return (
    <section id="scoring" className="relative px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="The scoring engine"
          title={<>Don&apos;t compare one number. <span className="font-display italic text-gradient">Weigh three.</span></>}
          sub="Coverage, tone drift and intensity, with weights from what bothers you most. All deterministic and in code. Drag the controls and watch the winner change. This runs the real scoring function."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          {/* controls */}
          <Reveal>
            <div className="card h-full p-7">
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Controls</span>
                <button onClick={() => { setTop(DEFAULTS.top); setLambda(DEFAULTS.lambda); setMu(DEFAULTS.mu); setNoise(DEFAULTS.noise); }} className={`inline-flex items-center gap-1.5 text-xs text-fog transition-opacity hover:text-white ${changed ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              </div>

              <div className="mb-8">
                <div className="mb-3 text-sm font-medium text-white">What bothers you most?</div>
                <div className="flex flex-wrap gap-2">
                  {CONCERNS.map((c) => (
                    <button key={c.id} onClick={() => setTop(c.id)} className="relative rounded-full px-4 py-2 text-sm transition-colors">
                      {top === c.id && <motion.span layoutId="topPill" className="absolute inset-0 rounded-full bg-gradient-to-r from-rose/90 to-violet/90" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                      <span className={`relative ${top === c.id ? "font-semibold text-ink" : "text-fog hover:text-white"}`}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {[
                { l: "λ · tone-drift penalty", v: lambda, set: setLambda, max: 1, step: 0.05, fill: "#ffc25c", d: "Punishes mismatched shades & mask-like finish" },
                { l: "μ · intensity penalty", v: mu, set: setMu, max: 1, step: 0.05, fill: "#ff5d73", d: "Stops the engine winning by over-covering" },
                { l: "Noise band (points)", v: noise, set: setNoise, max: 8, step: 0.5, fill: "#4ff0bd", d: "Test-retest noise: smaller changes count as zero" },
              ].map((s) => (
                <div key={s.l} className="mb-6 last:mb-0">
                  <div className="mb-2 flex items-baseline justify-between">
                    <label className="text-sm font-medium text-white">{s.l}</label>
                    <span className="font-mono text-sm tabular-nums text-mist">{s.v.toFixed(s.max > 1 ? 1 : 2)}</span>
                  </div>
                  <input type="range" className="rng w-full" min={0} max={s.max} step={s.step} value={s.v} style={{ ["--p" as string]: `${(s.v / s.max) * 100}%`, ["--fill" as string]: s.fill }} onChange={(e) => s.set(Number(e.target.value))} />
                  <p className="mt-2 text-xs text-fog">{s.d}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* leaderboard */}
          <Reveal delay={0.1}>
            <div className="card h-full p-7">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Candidate ranking</span>
                <span className="font-mono text-xs text-fog">J = Σw·r − λ·drift − μ·intensity</span>
              </div>
              <div className="mt-5 space-y-3">
                {rows.map((r, i) => (
                  <motion.div layout key={r.name} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={`relative rounded-2xl border p-5 ${i === 0 ? "border-mint/30 bg-mint/[0.05]" : "border-line bg-white/[0.02]"}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`grid h-8 w-8 place-items-center rounded-full font-mono text-xs ${i === 0 ? "bg-mint text-ink" : "bg-white/10 text-fog"}`}>{i === 0 ? <Crown className="h-4 w-4" /> : i + 1}</span>
                        <div>
                          <div className="font-semibold text-white">{r.name}</div>
                          <div className="text-xs text-fog">{r.note} · top concern −{Math.round(Math.max(0, r.topRed) * 100)}%</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono text-2xl font-semibold tabular-nums ${r.J >= 0 ? "text-white" : "text-bad"}`}>
                          <Tween value={r.J} decimals={2} />
                        </div>
                        <div className="font-mono text-[0.6rem] uppercase tracking-wider text-fog">J score</div>
                      </div>
                    </div>

                    {/* breakdown */}
                    <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[0.68rem]">
                      {[
                        { l: "coverage", v: r.cov, c: "text-mint", s: "+" },
                        { l: "tone drift", v: r.drift, c: "text-amber", s: "−" },
                        { l: "intensity", v: r.inten, c: "text-bad", s: "−" },
                      ].map((p) => (
                        <div key={p.l} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                          <div className="uppercase tracking-wider text-fog">{p.l}</div>
                          <div className={`mt-0.5 text-sm tabular-nums ${p.c}`}>{p.s}{Math.abs(p.v).toFixed(2)}</div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                            <motion.div className={`h-full rounded-full ${p.c.replace("text-", "bg-")}`} animate={{ width: `${Math.min(100, Math.abs(p.v) * 140)}%` }} transition={{ duration: 0.5 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="mt-5 text-xs leading-relaxed text-fog">
                Sample numbers for illustration. In the app, every value comes from analysing your own render. Notice how &ldquo;Full cover&rdquo; reduces the most but loses once you care about shade match.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
