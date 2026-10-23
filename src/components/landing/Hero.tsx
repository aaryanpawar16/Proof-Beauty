"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ChevronDown, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { Aurora, EASE, Eyebrow } from "../ui";
import { FaceScan } from "./FaceScan";

const WORDS = ["Don't", "just", "try", "it", "on."];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const faceY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative isolate flex min-h-dvh items-center overflow-hidden pb-24 pt-32 lg:pt-28">
      <Aurora />
      <div className="grid-bg absolute inset-0 -z-10" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-ink to-transparent" />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-5 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <motion.div style={{ y, opacity }} className="flex flex-col items-start gap-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: EASE }}>
            <Eyebrow>Virtual try-on, with receipts</Eyebrow>
          </motion.div>

          <h1 className="text-balance text-[2.9rem] font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl md:text-7xl">
            <span className="block">
              {WORDS.map((w, i) => (
                <span key={i} className="mr-[0.22em] inline-block overflow-hidden align-bottom">
                  <motion.span className="inline-block" initial={{ y: "110%", rotate: 4 }} animate={{ y: 0, rotate: 0 }} transition={{ delay: 0.3 + i * 0.09, duration: 0.95, ease: EASE }}>
                    {w}
                  </motion.span>
                </span>
              ))}
            </span>
            <span className="block overflow-hidden pb-2">
              <motion.span className="font-display shimmer-text inline-block text-[1.12em] font-normal italic" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ delay: 0.85, duration: 1, ease: EASE }}>
                Prove it works.
              </motion.span>
            </span>
          </h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 0.9, ease: EASE }} className="max-w-xl text-pretty text-lg leading-relaxed text-fog">
            Other try-ons ask <em className="not-italic text-white/80">&ldquo;do you like how this looks?&rdquo;</em> We ask{" "}
            <em className="not-italic text-white">&ldquo;does this look actually do what you need?&rdquo;</em> We analyse your skin, build a look for your specific concerns, then{" "}
            <span className="text-white">re-analyse the result</span> to measure the change.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.9, ease: EASE }} className="flex flex-wrap items-center gap-3">
            <Link href="/studio" className="btn-primary group">
              Start your analysis
              <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#loop" className="btn-ghost">See how it works</a>
          </motion.div>

          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1 }} className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fog">
            {["Measured before/after", "Honest about limits", "Photos auto-deleted"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-mint" />
                {t}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div style={{ y: faceY }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 1.2, ease: EASE }} className="px-6 pb-8 sm:px-12 lg:px-4">
          <FaceScan />
        </motion.div>
      </div>

      <motion.a href="#problem" aria-label="Scroll down" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-fog/60 sm:flex" animate={{ y: [0, 8, 0] }} transition={{ duration: 2.2, repeat: Infinity }}>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em]">Scroll</span>
        <ChevronDown className="h-4 w-4" />
      </motion.a>
    </section>
  );
}
