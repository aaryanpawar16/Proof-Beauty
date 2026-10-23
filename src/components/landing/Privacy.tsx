"use client";

import { FileHeart, Fingerprint, Palette, Timer, Trash2, Lock } from "lucide-react";
import { Reveal, SectionHead, SpotlightCard } from "../ui";

const ITEMS = [
  { Icon: Fingerprint, t: "Consent first", d: "Nothing is uploaded until you explicitly agree, and you can see exactly what happens to your photo." },
  { Icon: Timer, t: "Short-lived storage", d: "Photos and renders auto-delete after a short window. Only hashed analysis results are ever cached." },
  { Icon: Trash2, t: "One-tap delete", d: "Delete my photos wipes your session and cached analyses immediately. No account needed." },
  { Icon: Lock, t: "Keys stay server-side", d: "A thin proxy holds the YouCam key, so your browser never sees it." },
  { Icon: FileHeart, t: "Cosmetic, not medical", d: "Results are cosmetic visibility estimates. Never a diagnosis, never dermatological advice." },
  { Icon: Palette, t: "Tested across skin tones", d: "If verification is less reliable on deeper tones, we say so in your results instead of hiding it." },
];

export function Privacy() {
  return (
    <section id="privacy" className="relative px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow="Trust" title={<>Built to be <span className="font-display italic text-gradient">honest</span> with you.</>} sub="Judges, and users, respect limits that are stated over biases that are hidden." />
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((it, i) => (
            <Reveal key={it.t} delay={(i % 3) * 0.08}>
              <SpotlightCard className="h-full p-6">
                <span className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-white/[0.04]"><it.Icon className="h-5 w-5 text-violet" /></span>
                <h3 className="font-semibold text-white">{it.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fog">{it.d}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
