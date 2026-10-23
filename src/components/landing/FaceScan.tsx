"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

/** The whole pitch in one loop: baseline → plan → render → verify. Pure SVG, no assets. */

const PHASES = [
  { key: "baseline", label: "Baseline", sub: "Measuring concerns" },
  { key: "plan", label: "Plan", sub: "Picking 3 looks" },
  { key: "render", label: "Render", sub: "Applying makeup" },
  { key: "verify", label: "Verify", sub: "Re-analysing result" },
] as const;

const SPOTS = [
  { id: "dcl", cx: 140, cy: 236, r: 21, from: 62, to: 29, label: "Dark circles", chip: { left: "-4%", top: "40%" } },
  { id: "dcr", cx: 260, cy: 236, r: 21, from: 58, to: 27, label: "", chip: null },
  { id: "rdl", cx: 112, cy: 312, r: 27, from: 48, to: 30, label: "Redness", chip: { right: "-8%", top: "58%" } },
  { id: "rdr", cx: 288, cy: 312, r: 27, from: 51, to: 31, label: "", chip: null },
  { id: "shn", cx: 200, cy: 258, r: 19, from: 55, to: 34, label: "Shine", chip: { left: "-10%", top: "22%" } },
];

function facePoints(n = 44) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const s = Math.sin(t);
    const x = 200 + 140 * Math.cos(t) * (s > 0 ? 1 - 0.38 * s * s : 1);
    const y = 258 + 232 * s * (s < 0 ? 0.9 : 1);
    // rounded: full-precision floats serialise differently on server vs client (hydration mismatch)
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as const;
  });
}

const INNER = [
  [140, 205], [170, 200], [110, 207], [200, 205], [200, 250], [192, 292], [208, 292], [165, 372],
  [235, 372], [200, 380], [260, 205], [230, 200], [290, 207], [120, 160], [280, 160], [200, 130],
  [160, 130], [240, 130], [100, 250], [300, 250], [118, 340], [282, 340], [150, 410], [250, 410], [200, 450],
] as const;

export function FaceScan() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 3200);
    return () => clearInterval(id);
  }, []);

  const outline = useMemo(() => facePoints(), []);
  const mesh = useMemo(() => {
    const lines: string[] = [];
    outline.forEach(([x, y], i) => {
      const a = INNER[i % INNER.length];
      const b = INNER[(i * 3 + 5) % INNER.length];
      lines.push(`M${x.toFixed(1)} ${y.toFixed(1)}L${a[0]} ${a[1]}`);
      if (i % 2 === 0) lines.push(`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`);
    });
    return lines.join("");
  }, [outline]);

  const verified = phase === 3;
  const rendered = phase >= 2;
  const scanning = phase === 0 || phase === 2;

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[26rem] select-none">
      {/* ambient glow */}
      <motion.div
        className="absolute inset-[8%] rounded-full blur-3xl"
        animate={{ background: verified ? "radial-gradient(closest-side, rgba(79,240,189,.28), transparent)" : "radial-gradient(closest-side, rgba(255,111,165,.30), transparent)" }}
        transition={{ duration: 1.2 }}
      />

      <svg viewBox="0 0 400 520" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9ec4" stopOpacity="0" />
            <stop offset=".5" stopColor="#ffd2e6" stopOpacity=".9" />
            <stop offset="1" stopColor="#ff9ec4" stopOpacity="0" />
          </linearGradient>
          <clipPath id="faceClip">
            <path d="M200 28C292 28 342 112 342 222C342 336 292 452 200 494C108 452 58 336 58 222C58 112 108 28 200 28Z" />
          </clipPath>
          <radialGradient id="makeup" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#ffb08a" stopOpacity=".55" />
            <stop offset="1" stopColor="#ff6fa5" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="faceFill" cx=".5" cy=".4" r=".7">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".09" />
            <stop offset="1" stopColor="#ffffff" stopOpacity=".01" />
          </radialGradient>
        </defs>

        {/* silhouette */}
        <path d="M200 28C292 28 342 112 342 222C342 336 292 452 200 494C108 452 58 336 58 222C58 112 108 28 200 28Z" fill="url(#faceFill)" stroke="rgba(255,255,255,.28)" strokeWidth="1.2" />

        <g clipPath="url(#faceClip)">
          <motion.path d={mesh} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth=".6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, ease: "easeOut" }} />

          {/* makeup glow appears during render/verify */}
          {[[140, 238, 38], [260, 238, 38], [112, 314, 52], [288, 314, 52], [200, 262, 30]].map(([x, y, r], i) => (
            <motion.circle key={i} cx={x} cy={y} r={r} fill="url(#makeup)" initial={false} animate={{ opacity: rendered ? 1 : 0, scale: rendered ? 1 : 0.4 }} transition={{ duration: 0.9, delay: i * 0.08 }} style={{ transformOrigin: `${x}px ${y}px` }} />
          ))}

          {/* scan beam */}
          {scanning && (
            <motion.rect key={phase} x="40" width="320" height="90" fill="url(#beam)" initial={{ y: -90 }} animate={{ y: 520 }} transition={{ duration: 2.6, ease: "easeInOut" }} />
          )}
        </g>

        {/* features */}
        <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.3" strokeLinecap="round">
          <path d="M108 206Q140 184 172 206Q140 220 108 206Z" />
          <path d="M228 206Q260 184 292 206Q260 220 228 206Z" />
          <path d="M104 168Q140 148 176 166" />
          <path d="M224 166Q260 148 296 168" />
          <path d="M200 208L191 292Q200 304 209 292" />
          <path d="M164 374Q200 358 236 374Q200 402 164 374Z" />
        </g>

        {/* contour landmarks */}
        {outline.map(([x, y], i) => (
          <motion.circle key={i} cx={x} cy={y} r="2" fill="#fff" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 1, 0.55], scale: 1 }} transition={{ delay: 0.3 + i * 0.03, duration: 0.6 }} />
        ))}

        {/* concern hotspots */}
        {SPOTS.map((s, i) => {
          const color = verified ? "#4ff0bd" : "#ffc25c";
          return (
            <g key={s.id}>
              <motion.circle cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="3 4" animate={{ stroke: color, rotate: 360 }} transition={{ rotate: { duration: 14, repeat: Infinity, ease: "linear" }, stroke: { duration: 0.6 } }} style={{ transformOrigin: `${s.cx}px ${s.cy}px` }} />
              <motion.circle cx={s.cx} cy={s.cy} r={s.r} fill={color} animate={{ opacity: verified ? [0.1, 0.16, 0.1] : [0.12, 0.3, 0.12], scale: [1, 1.18, 1] }} transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.25 }} style={{ transformOrigin: `${s.cx}px ${s.cy}px` }} />
              <circle cx={s.cx} cy={s.cy} r="3" fill={color} />
            </g>
          );
        })}
      </svg>

      {/* floating metric chips */}
      {SPOTS.filter((s) => s.chip).map((s, i) => (
        <motion.div
          key={s.id}
          className="absolute z-10"
          style={s.chip as React.CSSProperties}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1 + i * 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="animate-float" style={{ animationDelay: `${i * 0.9}s` }}>
            <div className="glass flex items-center gap-3 rounded-2xl px-3.5 py-2.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.9)]">
              <div>
                <div className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-fog">{s.label}</div>
                <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-lg font-semibold tabular-nums">
                  <AnimatePresence mode="wait">
                    <motion.span key={verified ? "to" : "from"} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.35 }} className={verified ? "text-mint" : "text-amber"}>
                      {verified ? s.to : s.from}
                    </motion.span>
                  </AnimatePresence>
                  <motion.span animate={{ opacity: verified ? 1 : 0, width: verified ? "auto" : 0 }} className="overflow-hidden whitespace-nowrap text-xs text-mint">
                    −{Math.round((1 - s.to / s.from) * 100)}%
                  </motion.span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}

      {/* phase HUD */}
      <div className="absolute inset-x-0 -bottom-6 z-10 flex justify-center">
        <div className="glass flex items-center gap-1 rounded-full p-1.5">
          {PHASES.map((p, i) => (
            <div key={p.key} className="relative px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em]">
              {phase === i && (
                <motion.span layoutId="phasePill" className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
              <span className={`relative ${phase === i ? "text-white" : "text-fog/60"}`}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* verdict chip */}
      <AnimatePresence>
        {verified && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -right-3 -top-2 z-10 sm:-right-8"
          >
            <div className="flex items-center gap-2.5 rounded-2xl border border-mint/30 bg-mint/10 px-3.5 py-2.5 backdrop-blur-xl">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-mint text-ink">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
              <div>
                <div className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-mint/80">Verified</div>
                <div className="text-sm font-semibold text-white">Measured, not guessed</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
