"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Aurora, Logo, Reveal } from "../ui";

export function CtaFooter() {
  return (
    <>
      <section className="relative isolate overflow-hidden px-5 py-32 sm:py-44">
        <Aurora className="opacity-80" />
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-9 text-center">
          <Reveal>
            <h2 className="text-balance text-5xl font-semibold leading-[1] tracking-tight text-white sm:text-7xl">
              Stop guessing.
              <br />
              <span className="font-display shimmer-text italic">Start proving.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="max-w-xl text-lg text-fog">One selfie, about a minute, a measured before/after for the concerns you actually care about.</p>
          </Reveal>
          <Reveal delay={0.22}>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link href="/studio" className="btn-primary group !px-9 !py-5 text-lg">
                Open the studio
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-line px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <Logo />
          <p className="max-w-xl text-center text-xs leading-relaxed text-fog sm:text-right">
            Results are cosmetic visibility estimates from image analysis, not medical or dermatological advice. Predicted results measure a simulated render; Stage 2 measures real application.
          </p>
        </div>
      </footer>
    </>
  );
}
