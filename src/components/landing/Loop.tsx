"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import { EASE, Reveal, SectionHead } from "../ui";
import { VisualBaseline, VisualExplain, VisualGate, VisualPlan, VisualScore, VisualVerify } from "./LoopVisuals";

const STEPS: { n: string; title: string; body: string; api: string; visual: ReactNode }[] = [
  { n: "01", title: "Selfie + quality gate", body: "Face detection, blur, brightness and head pose run client-side. A bad photo is rejected before it costs a single credit.", api: "client-side · MediaPipe", visual: <VisualGate /> },
  { n: "02", title: "Baseline analysis", body: "Skin-analysis scores every concern, and tone analysis captures your skin, eye, lip and hair colours as the shade reference.", api: "skin-analysis · skin-tone-analysis", visual: <VisualBaseline /> },
  { n: "03", title: "Plan candidate looks", body: "A rule-based planner turns your top concerns into K distinct, layered looks, with shades derived from your measured tone.", api: "planner · concern → strategy rules", visual: <VisualPlan /> },
  { n: "04", title: "Render, then verify", body: "Each look is rendered, then the same analysis runs on the render. Not a guess about the result: a measurement of it.", api: "makeup-vto → skin-analysis", visual: <VisualVerify /> },
  { n: "05", title: "Score, pick, refine once", body: "Deterministic scoring weighs coverage against tone drift and over-application. Weak coverage triggers one refinement round, then it stops.", api: "scoring engine · in code, never in the LLM", visual: <VisualScore /> },
  { n: "06", title: "Explain + shop", body: "An explainer reads the numbers your code computed and turns them into plain language, plus shade-matched products to shop.", api: "explainer · reads numbers, invents none", visual: <VisualExplain /> },
];

export function Loop() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(p * STEPS.length * 0.999))));
  });

  return (
    <section id="loop" className="relative px-5 pt-12">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="The core loop"
          title={<>One selfie. <span className="font-display italic text-gradient">Six steps.</span> A verdict you can check.</>}
          sub="Every YouCam call is async: upload, create a task, poll. The orchestrator chains five of them into a closed loop and caps it at two rounds to protect your budget."
        />

        {/* desktop: pinned, scroll-driven */}
        <div ref={ref} className="relative mt-20 hidden h-[420vh] lg:block">
          <div className="sticky top-24 grid h-[calc(100dvh-8rem)] grid-cols-[0.9fr_1.1fr] items-center gap-16">
            <div className="relative">
              <div className="absolute bottom-0 left-[1.15rem] top-0 w-px bg-line" />
              <motion.div className="absolute left-[1.15rem] top-0 w-px origin-top bg-gradient-to-b from-rose via-violet to-mint" style={{ scaleY: scrollYProgress, height: "100%" }} />
              <ul className="space-y-2">
                {STEPS.map((s, i) => {
                  const on = i === active;
                  return (
                    <li key={s.n}>
                      <button onClick={() => {
                        const el = ref.current; if (!el) return;
                        const top = el.getBoundingClientRect().top + window.scrollY;
                        window.scrollTo({ top: top + ((i + 0.5) / STEPS.length) * (el.offsetHeight - window.innerHeight), behavior: "smooth" });
                      }} className="relative flex w-full gap-5 rounded-2xl py-3 pr-4 text-left">
                        <span className={`relative z-10 grid h-[2.3rem] w-[2.3rem] shrink-0 place-items-center rounded-full border font-mono text-xs transition-all duration-500 ${on ? "border-transparent bg-gradient-to-br from-rose to-violet text-ink shadow-[0_0_30px_-4px_rgb(255_111_165/0.8)]" : i < active ? "border-mint/40 bg-ink text-mint" : "border-line-strong bg-ink text-fog"}`}>
                          {s.n}
                        </span>
                        <span className="flex-1">
                          <span className={`block text-xl font-semibold tracking-tight transition-colors duration-500 ${on ? "text-white" : "text-fog/70"}`}>{s.title}</span>
                          <motion.span initial={false} animate={{ height: on ? "auto" : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.5, ease: EASE }} className="block overflow-hidden">
                            <span className="mt-2 block text-[0.95rem] leading-relaxed text-fog">{s.body}</span>
                            <span className="mt-3 inline-block rounded-full border border-line-strong px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-fog">{s.api}</span>
                          </motion.span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-rose/10 via-violet/10 to-transparent blur-2xl" />
              <div className="glass relative overflow-hidden rounded-[2rem] p-7">
                <div className="mb-6 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Step {STEPS[active].n} / 06</span>
                  <span className="flex gap-1.5">{STEPS.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-6 bg-gradient-to-r from-rose to-violet" : "w-1.5 bg-white/15"}`} />)}</span>
                </div>
                <div className="min-h-[26rem]">
                  <AnimatePresence mode="wait">
                    <motion.div key={active} initial={{ opacity: 0, y: 24, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -16, filter: "blur(6px)" }} transition={{ duration: 0.45, ease: EASE }}>
                      {STEPS[active].visual}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* mobile: stacked */}
        <div className="mt-14 space-y-6 lg:hidden">
          {STEPS.map((s) => (
            <Reveal key={s.n}>
              <div className="card p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-rose to-violet font-mono text-xs text-ink">{s.n}</span>
                  <h3 className="text-xl font-semibold text-white">{s.title}</h3>
                </div>
                <p className="mb-2 text-sm leading-relaxed text-fog">{s.body}</p>
                <span className="mb-5 inline-block rounded-full border border-line-strong px-3 py-1 font-mono text-[0.62rem] uppercase tracking-wider text-fog">{s.api}</span>
                <div>{s.visual}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
