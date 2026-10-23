"use client";

import { motion } from "framer-motion";
import { Check, Heart, X } from "lucide-react";
import { CountUp, EASE, Reveal, SectionHead, SpotlightCard } from "../ui";

const MARQUEE = [
  "Quality gate", "Baseline analysis", "Skin-tone check", "Look planner", "Makeup render",
  "Verification", "Deterministic scoring", "One refinement", "Plain-language verdict", "Stage 2 proof",
];

const BARS = [
  { label: "Dark circles", from: 62, to: 31 },
  { label: "Redness", from: 48, to: 29 },
  { label: "Dark spots", from: 37, to: 24 },
];

export function Problem() {
  return (
    <section id="problem" className="relative px-5 py-28 sm:py-36">
      {/* marquee */}
      <div className="absolute inset-x-0 top-0 overflow-hidden border-y border-line bg-white/[0.02] py-4 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-[0.2em] text-fog/70">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="flex items-center gap-10">
              {m}
              <span className="h-1 w-1 rounded-full bg-rose/70" />
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl">
        <SectionHead
          eyebrow="The wrong question"
          title={<>Try-on tells you how it <span className="font-display italic text-gradient">looks</span>. Not whether it <span className="font-display italic text-gradient-mint">works</span>.</>}
          sub="A pretty filter can't tell you if the concealer actually hides your dark circles, or if that foundation just turned you two shades off. We close the loop with measurements."
        />

        <div className="relative mt-20 grid gap-6 md:grid-cols-2">
          {/* typical */}
          <Reveal>
            <SpotlightCard className="h-full p-7 sm:p-9">
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Typical try-on</span>
                <X className="h-5 w-5 text-bad/80" />
              </div>
              <div className="relative mb-7 aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01]">
                <div className="absolute inset-0 grid place-items-center">
                  <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 2.4, repeat: Infinity }}>
                    <Heart className="h-14 w-14 fill-rose/30 text-rose/70" />
                  </motion.div>
                </div>
                <span className="absolute bottom-3 left-3 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">&ldquo;Looks great!&rdquo;</span>
              </div>
              <ul className="space-y-3 text-sm text-fog">
                {["Answers: do I like it?", "No idea if your concern improved", "No shade-drift check", "Buy first, find out later"].map((t) => (
                  <li key={t} className="flex items-start gap-3"><X className="mt-0.5 h-4 w-4 shrink-0 text-bad/70" />{t}</li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>

          {/* proof beauty */}
          <Reveal delay={0.12}>
            <SpotlightCard className="h-full border-mint/20 p-7 sm:p-9">
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-mint">Proof Beauty</span>
                <Check className="h-5 w-5 text-mint" />
              </div>
              <div className="mb-7 space-y-4 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-5">
                {BARS.map((b, i) => (
                  <div key={b.label}>
                    <div className="mb-1.5 flex justify-between font-mono text-xs">
                      <span className="text-mist">{b.label}</span>
                      <span className="tabular-nums text-fog">{b.from} → <span className="text-mint">{b.to}</span> · <span className="text-mint">−{Math.round((1 - b.to / b.from) * 100)}%</span></span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
                      <motion.div className="absolute inset-y-0 left-0 rounded-full bg-amber/50" initial={{ width: 0 }} whileInView={{ width: `${b.from}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 + i * 0.12, ease: EASE }} />
                      <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-mint to-[#a8ffe6]" initial={{ width: 0 }} whileInView={{ width: `${b.to}%` }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.9 + i * 0.12, ease: EASE }} />
                    </div>
                  </div>
                ))}
              </div>
              <ul className="space-y-3 text-sm text-mist">
                {["Answers: does it do what I need?", "Per-concern before/after, measured", "Tone-drift and intensity penalties", "Honest about what makeup can't fix"].map((t) => (
                  <li key={t} className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" />{t}</li>
                ))}
              </ul>
            </SpotlightCard>
          </Reveal>
        </div>

        {/* stats */}
        <div className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
          {[
            { n: 3, s: "+", l: "candidate looks per run" },
            { n: 2, s: "", l: "rounds, hard-capped" },
            { n: 10, s: "", l: "skin concerns measured" },
            { n: 0, s: "", l: "medical claims made" },
          ].map((s) => (
            <div key={s.l} className="bg-ink p-6 text-center sm:p-8">
              <div className="font-display text-5xl text-white sm:text-6xl"><CountUp to={s.n} suffix={s.s} /></div>
              <div className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fog">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
