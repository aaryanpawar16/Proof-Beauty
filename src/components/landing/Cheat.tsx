"use client";

import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { EASE, Reveal, SectionHead } from "../ui";

/**
 * Measured live on one real photo with YouCam's raw skin-analysis score (dark circles, severity 60):
 *  - score-only pick: a whole-face foundation a few shades too light  -> 60 → 54, face shade shifted ΔE 6.2
 *  - our pick (Balanced): a real concealer + matched base            -> 60 → 55, face shade shifted ΔE 3.2
 * Swatches are the face-region colours the app reported for that run.
 */
const NAIVE = { gain: 6, de: 6.2, skin: "#986E59" };
const OURS = { gain: 5, de: 3.2, skin: "#906651" };
const ORIGINAL = "#875F4B";

function Bar({ value, max, color, delay }: { value: number; max: number; color: string; delay: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-white/[0.07]">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        whileInView={{ width: `${(value / max) * 100}%` }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 1.1, delay, ease: EASE }}
      />
    </div>
  );
}

export function Cheat() {
  return (
    <section id="cheat" className="relative px-5 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-96 max-w-4xl rounded-full bg-bad/[0.06] blur-[140px]" />
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="The score can be fooled"
          title={<>A try-on that only watches the number <span className="font-display italic text-gradient">can&apos;t tell the difference.</span></>}
          sub="We tested it on a real photo. A foundation a few shades too light scored about as well as a real concealer on dark circles, because it simply made the whole face lighter. Same number, very different result. So every run includes that shortcut as a control, and the shade check is what tells the two apart."
        />

        <div className="mt-16 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="card h-full border-bad/25 p-7 sm:p-9">
              <div className="mb-6 flex items-center gap-2.5 text-bad">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-mono text-xs uppercase tracking-[0.18em]">Score-only try-on</span>
              </div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-fog">Dark-circle score</span>
                <span className="font-mono text-2xl font-semibold tabular-nums text-bad">+{NAIVE.gain.toFixed(1)}</span>
              </div>
              <Bar value={NAIVE.gain} max={10} color="bg-bad" delay={0.2} />
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <span className="h-10 w-10 rounded-full ring-2 ring-white/20" style={{ background: ORIGINAL }} />
                <span className="text-fog">→</span>
                <span className="h-10 w-10 rounded-full ring-2 ring-bad/50" style={{ background: NAIVE.skin }} />
                <span className="rounded-full border border-bad/30 bg-bad/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-bad">your face got lighter · ΔE {NAIVE.de.toFixed(1)}</span>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-fog">A good score, for the wrong reason. The under-eye wasn&apos;t treated; the whole face was brightened. A number-chasing try-on would happily recommend this.</p>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="card h-full border-mint/25 p-7 sm:p-9">
              <div className="mb-6 flex items-center gap-2.5 text-mint">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-mono text-xs uppercase tracking-[0.18em]">Proof Beauty</span>
              </div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-fog">Dark-circle score</span>
                <span className="font-mono text-2xl font-semibold tabular-nums text-mint">+{OURS.gain.toFixed(1)}</span>
              </div>
              <Bar value={OURS.gain} max={10} color="bg-gradient-to-r from-mint to-[#a8ffe6]" delay={0.35} />
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <span className="h-10 w-10 rounded-full ring-2 ring-white/20" style={{ background: ORIGINAL }} />
                <span className="text-fog">→</span>
                <span className="h-10 w-10 rounded-full ring-2 ring-mint/50" style={{ background: OURS.skin }} />
                <span className="rounded-full border border-mint/30 bg-mint/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-mint">still your skin · ΔE {OURS.de.toFixed(1)}</span>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-fog">Nearly the same score, and we can stand behind it: a real concealer treated the under-eye and the shade stayed close to your skin. We recommend this one, and say plainly that the effect is modest.</p>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-6">
          <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-fog">
            One real photo, one run, YouCam&apos;s raw skin-analysis score. The one-point gap between them is inside the measurement noise, and that is the point: the score can&apos;t separate them. In the app the control runs on <em className="not-italic text-white/80">your</em> photo every time, and we only say it &ldquo;fooled&rdquo; a score when it beats our pick by more than the noise.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
