"use client";

import { motion } from "framer-motion";
import { Ban, Crown, ExternalLink, Info, ShoppingBag, Sparkles, Trash2, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { CONCERNS } from "@/lib/concerns";
import { isImproved, isProven } from "@/lib/scoring";
import { fmt, fmtPenalty } from "@/lib/format";
import { buildShoppingList, describeShade } from "@/lib/products";
import type { ConcernDelta, EvaluatedCandidate, RunResult } from "@/lib/types";
import { EASE, Reveal, Tween } from "../ui";
import { BeforeAfter } from "./BeforeAfter";
import { IntegrityCard } from "./IntegrityCard";
import { Stage2Panel } from "./Stage2Panel";

const CONF = {
  clear: { t: "Clear change", cls: "border-mint/30 bg-mint/10 text-mint" },
  likely: { t: "Likely", cls: "border-violet/30 bg-violet/10 text-violet" },
  "within-noise": { t: "Within noise", cls: "border-line-strong bg-white/[0.04] text-fog" },
} as const;

function DeltaRow({ d, i }: { d: ConcernDelta; i: number }) {
  const pct = Math.round(d.reduction * 100);
  const conf = CONF[d.confidence];
  const improved = d.confidence !== "within-noise" && d.reduction > 0;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.6, ease: EASE }} className="rounded-2xl border border-line bg-white/[0.025] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-white">{CONCERNS[d.concern].label}</span>
          {d.fixability === "partial" && <span className="rounded-full border border-amber/25 bg-amber/10 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-amber">partly fixable</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider ${conf.cls}`}>{conf.t}</span>
          <span className={`font-mono text-lg font-semibold tabular-nums ${improved ? "text-mint" : d.reduction < 0 ? "text-bad" : "text-fog"}`}>
            {d.confidence === "within-noise" ? "±0%" : `${pct > 0 ? "−" : "+"}${Math.abs(pct)}%`}
          </span>
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-amber/45" initial={{ width: 0 }} animate={{ width: `${d.baselineSeverity}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.07, ease: EASE }} />
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-mint to-[#a8ffe6]" initial={{ width: 0 }} animate={{ width: `${d.renderSeverity}%` }} transition={{ duration: 1.1, delay: 0.5 + i * 0.07, ease: EASE }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[0.68rem] text-fog">
        <span>severity {Math.round(d.baselineSeverity)} → <span className="text-white">{Math.round(d.renderSeverity)}</span></span>
        <span>weight {Math.round(d.weight * 100)}% · noise ±{fmt(d.noise, 1)}</span>
      </div>
    </motion.div>
  );
}

export function ResultsView({ result, onRestart, onDelete, deleting }: { result: RunResult; onRestart: () => void; onDelete: () => void; deleting: boolean }) {
  const best = result.evaluated.find((e) => e.candidate.id === result.bestId)!;
  const [selId, setSelId] = useState(best.candidate.id);
  const sel: EvaluatedCandidate = result.evaluated.find((e) => e.candidate.id === selId) ?? best;
  const s = sel.score;

  const shade = useMemo(() => describeShade(result.baseline.tone, result.baseline.driftLab), [result]);
  const shop = useMemo(() => buildShoppingList(sel.candidate, result.baseline.tone, result.baseline.driftLab, sel.score.deltas), [sel, result]);
  const flat = s.deltas.filter((d) => d.confidence === "within-noise" || d.reduction <= 0);
  // Depth comes from the lighting-corrected tone when we have it. The raw face pixels of a shadowed photo read
  // darker than the person really is, which previously showed "deeper skin tones" next to "medium".
  const deep = shade.depth === "deep";
  // Honesty, three states:
  //  proven  : something improved beyond the noise band AND the render still looks like your skin (ΔE ≤ 4)
  //  mixed   : something really improved, but through a visible shade shift
  //  neither : nothing moved beyond noise
  const improved = isImproved(best.score);
  const proven = isProven(best.score);
  const mixed = improved && !proven;
  // Several looks often land within noise of each other; say so instead of crowning one on a 0.01 difference.
  const ties = result.evaluated.filter((e) => e !== best && isProven(e.score) && best.score.J - e.score.J < 0.015);
  // The headline can say "wins" because other concerns improved clearly while the user's #1 concern barely moved.
  // Never let that hide: say it right under the headline.
  const topDelta = best.score.deltas.find((d) => d.concern === best.score.topConcern);
  const topWeak = !!topDelta && topDelta.confidence !== "clear";
  const clearGains = best.score.deltas
    .filter((d) => d.confidence === "clear" && d.reduction > 0 && d.concern !== topDelta?.concern)
    .map((d) => CONCERNS[d.concern].label.toLowerCase());
  const gained = best.score.deltas.filter((d) => d.confidence !== "within-noise" && d.reduction > 0).map((d) => CONCERNS[d.concern].label.toLowerCase());

  return (
    <div className="space-y-10">
      {/* headline */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {proven ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-mint"><Crown className="h-3 w-3" />Best verified look</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-amber"><Info className="h-3 w-3" />{mixed ? "Mixed result" : "Not proven"}</span>
              )}
              {result.mode === "demo" && <span className="rounded-full border border-amber/30 bg-amber/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-amber">Demo data · simulated</span>}
              {result.refined && <span className="rounded-full border border-violet/30 bg-violet/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-violet">Refined once</span>}
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {proven ? (
                <><span className="font-display italic text-gradient">{best.candidate.name}</span> wins.</>
              ) : mixed ? (
                <>Real change, <span className="font-display italic text-gradient">with a cost.</span></>
              ) : (
                <>No look <span className="font-display italic text-gradient">measurably</span> helped.</>
              )}
            </h2>
            <p className="mt-2 max-w-xl text-fog">
              {proven
                ? best.candidate.rationale
                : mixed
                  ? `${best.candidate.name} measurably improved ${gained.join(" and ")}, but it also shifted your skin shade (ΔE ${best.score.toneDriftDE.toFixed(1)}), so part of that gain may just be a brighter or different-coloured face. Check the shade before you trust this one.`
                  : `The closest attempt was ${best.candidate.name}, but the change is inside the measurement noise. We're not going to call that a result. Try a different concern, or check Stage 2 on a real application.`}
            </p>
            {improved && topWeak && topDelta && (
              <p className="mt-3 max-w-xl text-sm text-amber/90">
                Heads up: your top concern, {CONCERNS[topDelta.concern].label.toLowerCase()}, {topDelta.confidence === "within-noise" ? "didn't measurably move" : `only moved ${Math.round(Math.abs(topDelta.reduction) * 100)}% (not a clear change)`}.
                {clearGains.length > 0 && <> The clear gains are on {clearGains.join(", ")}.</>}
              </p>
            )}
            {proven && ties.length > 0 && (
              <p className="mt-3 max-w-xl text-sm text-amber/90">
                Close call: {ties.map((t) => t.candidate.name).join(", ")} scored within 0.01, which is practically equal. If you&apos;d rather use less product, pick the lightest of them.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {[{ l: "J score", v: best.score.J, d: 2, c: "text-white" }, { l: "Credits used", v: result.unitsUsed, d: 0, c: "text-white" }].map((m) => (
              <div key={m.l} className="card min-w-28 px-5 py-4 text-center">
                <div className={`font-display text-4xl ${m.c}`}><Tween value={m.v} decimals={m.d} /></div>
                <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-wider text-fog">{m.l}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        {/* left: slider + candidate switcher */}
        <div className="space-y-4">
          <BeforeAfter key={sel.candidate.id} before={result.originalUrl} after={sel.renderUrl} afterLabel={sel.candidate.name} />
          <div className="grid grid-cols-3 gap-2">
            {result.evaluated.map((e, i) => {
              const on = e.candidate.id === sel.candidate.id;
              return (
                <button key={e.candidate.id} onClick={() => setSelId(e.candidate.id)} className="relative rounded-2xl border border-line p-3 text-left transition-colors hover:border-line-strong">
                  {on && <motion.span layoutId="selCand" className="absolute inset-0 rounded-2xl border border-rose/60 bg-rose/[0.07]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="relative block">
                    <span className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-white">{e.candidate.name}</span>
                      {i === 0 && <Crown className="h-3.5 w-3.5 shrink-0 text-mint" />}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs tabular-nums text-fog">J {fmt(e.score.J)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* right: measured deltas */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-fog">Measured per-concern change</h3>
            <span className="font-mono text-[0.65rem] text-fog/70">changes inside each concern&apos;s noise band don&apos;t count</span>
          </div>
          <div className="space-y-3">
            {s.deltas.map((d, i) => <DeltaRow key={`${sel.candidate.id}-${d.concern}`} d={d} i={i} />)}
          </div>

          {/* J breakdown */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { l: "Coverage", v: s.coverage >= 0.005 ? `+${fmt(s.coverage)}` : s.coverage <= -0.005 ? `−${fmt(Math.abs(s.coverage))}` : "0.00", c: "text-mint", sub: "Σ w · reduction" },
              { l: "Tone drift", v: fmtPenalty(result.params.lambda * s.toneDriftPenalty), c: "text-amber", sub: `ΔE ${s.toneDriftDE.toFixed(1)}` },
              { l: "Intensity", v: fmtPenalty(s.intensityPenalty), c: "text-bad", sub: `${Math.round(s.intensity * 100)}% applied` },
            ].map((t) => (
              <div key={t.l} className="card px-4 py-3.5">
                <div className="font-mono text-[0.6rem] uppercase tracking-wider text-fog">{t.l}</div>
                <div className={`mt-1 font-mono text-xl font-semibold tabular-nums ${t.c}`}>{t.v}</div>
                <div className="font-mono text-[0.62rem] text-fog/70">{t.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* integrity check: the control look vs our pick */}
      <IntegrityCard result={result} />

      {/* explanation */}
      <Reveal>
        <div className="card p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><Sparkles className="h-5 w-5 text-violet" /><h3 className="text-lg font-semibold text-white">In plain language</h3></div>
            <span className="font-mono text-[0.62rem] uppercase tracking-wider text-fog">{result.explainedBy === "llm" ? "Reworded by a local LLM · numbers verified in code" : "Generated from computed numbers"}</span>
          </div>
          <ul className="space-y-3">
            {result.explanation.map((t, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="flex gap-3 text-[0.95rem] leading-relaxed text-mist">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-rose to-violet" />{t}
              </motion.li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* honesty callouts */}
      <Reveal>
        <div className="grid gap-4 md:grid-cols-2">
          {result.unavailable.length > 0 && (
            <div className="card border-bad/20 p-5">
              <div className="mb-2 flex items-center gap-2 font-medium text-white"><Ban className="h-4 w-4 text-bad" />Makeup won&apos;t fix this</div>
              <p className="text-sm leading-relaxed text-fog">
                {result.unavailable.map((id, i) => (i ? CONCERNS[id].label.toLowerCase() : CONCERNS[id].label)).join(" and ")} {result.unavailable.length > 1 ? "were" : "was"} measured but left out of scoring. {CONCERNS[result.unavailable[0]].caveat}
              </p>
            </div>
          )}
          {flat.length > 0 && (
            <div className="card border-amber/20 p-5">
              <div className="mb-2 flex items-center gap-2 font-medium text-white"><Info className="h-4 w-4 text-amber" />No reliable change</div>
              <p className="text-sm leading-relaxed text-fog">{flat.map((d) => `${CONCERNS[d.concern].label} (±${fmt(d.noise, 1)}pt)`).join(", ")}: {flat.length > 1 ? "these changes are" : "this change is"} inside the concern&apos;s test-retest noise, so we&apos;re not claiming {flat.length > 1 ? "them" : "it"}.</p>
            </div>
          )}
          {deep && (
            <div className="card border-violet/20 p-5">
              <div className="mb-2 flex items-center gap-2 font-medium text-white"><Info className="h-4 w-4 text-violet" />Deeper skin tones</div>
              <p className="text-sm leading-relaxed text-fog">Verification can be less reliable on deeper tones. Treat these numbers as directional and use Stage 2 to confirm.</p>
            </div>
          )}
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-2 font-medium text-white"><Info className="h-4 w-4 text-fog" />What this measures</div>
            <p className="text-sm leading-relaxed text-fog">Cosmetic visibility estimates of a <em className="not-italic text-white">simulated render</em>. Not a medical or dermatological assessment. Stage 2 below measures the real thing.</p>
          </div>
        </div>
      </Reveal>

      {/* shopping */}
      <Reveal>
        <div className="card p-6 sm:p-8">
          <div className="mb-1 flex items-center gap-2.5"><ShoppingBag className="h-5 w-5 text-peach" /><h3 className="text-lg font-semibold text-white">Shop the look</h3></div>
          <p className="mb-6 text-sm text-fog">Shade targets derived from your measured tone ({shade.label}). Each link is a shopping search for that spec. <span className="text-mist">&ldquo;Verified at render shade&rdquo;</span> means we measured the layer using the <em className="not-italic text-mist">tested as</em> shade, which matches this photo&apos;s lighting (and, for concealer, is deliberately lighter than skin so the effect registers). The <em className="not-italic text-mist">buy</em> shade is the lighting-corrected equivalent, so check it in daylight; we haven&apos;t measured that exact product.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {shop.map((p, i) => (
              <motion.a key={p.role} href={p.href} target="_blank" rel="noreferrer" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} whileHover={{ y: -3 }} className="group flex items-center gap-4 rounded-2xl border border-line bg-white/[0.025] p-4 transition-colors hover:border-line-strong">
                <span className="h-11 w-11 shrink-0 rounded-full ring-2 ring-white/20" style={{ background: p.shade }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-white">{p.name}</span>
                  <span className="block text-xs text-fog">
                    {p.why}
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1.5">buy <i className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ background: p.shade }} /><span className="font-mono">{p.shade}</span></span>
                      <span className="inline-flex items-center gap-1.5">tested as <i className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ background: p.renderShade }} /><span className="font-mono">{p.renderShade}</span></span>
                    </span>
                    {p.verified === true && <span title="This layer was measured using the 'tested as' shade, not the 'buy' shade" className="mt-1.5 inline-block rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-mint">verified at render shade</span>}
                    {p.verified === false && <span className="ml-2 rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-amber">not verified</span>}
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-fog transition-colors group-hover:text-white" />
              </motion.a>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal><Stage2Panel result={result} /></Reveal>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
        <button onClick={onRestart} className="btn-ghost"><RotateCcw className="h-4 w-4" />Start over</button>
        <button onClick={onDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-full border border-bad/30 bg-bad/[0.07] px-5 py-3 text-sm font-medium text-bad transition-colors hover:bg-bad/15 disabled:opacity-50">
          <Trash2 className="h-4 w-4" />{deleting ? "Deleting…" : "Delete my photos"}
        </button>
      </div>
    </div>
  );
}
