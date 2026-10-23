"use client";

import { Ban, CircleCheck, CircleDashed } from "lucide-react";
import { CONCERN_LIST } from "@/lib/concerns";
import { Reveal, SectionHead, SpotlightCard } from "../ui";

const STYLE = {
  addressable: { Icon: CircleCheck, tag: "Makeup can help", cls: "text-mint border-mint/25 bg-mint/10" },
  partial: { Icon: CircleDashed, tag: "Partly", cls: "text-amber border-amber/25 bg-amber/10" },
  cannot: { Icon: Ban, tag: "Makeup won't fix this", cls: "text-bad border-bad/25 bg-bad/10" },
} as const;

export function Honesty() {
  return (
    <section id="honesty" className="relative px-5 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-96 max-w-4xl rounded-full bg-bad/[0.07] blur-[140px]" />
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Honesty is a feature"
          title={<>We&apos;ll tell you what makeup <span className="font-display italic text-gradient">can&apos;t</span> do.</>}
          sub="Every concern is mapped to a strategy, or flagged as something makeup won't fix. Wrinkles and eyelid sagging are never scored, so we never pretend a filter solved them."
        />

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONCERN_LIST.map((c, i) => {
            const st = STYLE[c.fixability];
            return (
              <Reveal key={c.id} delay={(i % 3) * 0.08}>
                <SpotlightCard className={`group h-full p-6 ${c.fixability === "cannot" ? "border-bad/15" : ""}`}>
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-lg font-semibold ${c.fixability === "cannot" ? "text-white/70" : "text-white"}`}>{c.label}</h3>
                      <div className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-fog">{c.region}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider ${st.cls}`}>
                      <st.Icon className="h-3 w-3" />
                      {st.tag}
                    </span>
                  </div>
                  <p className="relative text-sm leading-relaxed text-fog">
                    {c.fixability === "cannot" ? (
                      c.caveat
                    ) : (
                      <>
                        <span className="text-mist">{c.strategy}.</span> {c.caveat}
                      </>
                    )}
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
