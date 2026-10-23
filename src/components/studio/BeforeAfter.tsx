"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { MoveHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SessionImage } from "../SessionImage";
import { EASE } from "../ui";

type Mode = "before" | "split" | "after";
const TARGET: Record<Mode, number> = { before: 100, split: 50, after: 0 };
/** While dragging, the divider can't reach the edges: neither photo is ever fully hidden or the handle clipped. */
const MIN = 4;
const MAX = 96;

/**
 * Before/after reveal with three ways to see the After render:
 *  - it opens at 50/50 so both photos are visible from the first frame (a small wiggle hints it's draggable),
 *  - drag the divider (clamped to 4-96%, so a drag that ends outside the box can't leave it stuck on an edge,
 *    which is what used to hide one photo and half-clip the handle),
 *  - or tap Before / Split / After to see exactly one photo or the split in a single click.
 */
export function BeforeAfter({ before, after, afterLabel }: { before: string; after: string; afterLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useMotionValue(50);
  const clip = useTransform(pos, (v) => `inset(0 0 0 ${v}%)`);
  const left = useTransform(pos, (v) => `${v}%`);
  // the divider and handle disappear in the single-photo views instead of sitting half-clipped on an edge
  const handleOpacity = useTransform(pos, (v) => (v <= 1.5 || v >= 98.5 ? 0 : 1));
  const dragging = useRef(false);
  const running = useRef<ReturnType<typeof animate> | null>(null);
  const [mode, setMode] = useState<Mode>("split");

  useEffect(() => {
    running.current = animate(pos, [50, 36, 64, 50], { duration: 2, ease: EASE, delay: 0.6 });
    return () => running.current?.stop();
  }, [pos]);

  const move = (x: number) => {
    running.current?.stop(); // user took over: never fight their drag
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    pos.set(Math.max(MIN, Math.min(MAX, ((x - r.left) / r.width) * 100)));
    setMode((m) => (m === "split" ? m : "split"));
  };

  const go = (m: Mode) => {
    running.current?.stop();
    setMode(m);
    running.current = animate(pos, TARGET[m], { duration: 0.5, ease: EASE });
  };

  return (
    <div
      ref={ref}
      className="relative aspect-[3/4] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-[1.75rem] border border-line-strong bg-panel"
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        if (e.buttons === 0) { dragging.current = false; return; } // a button-up we never saw: stop following the mouse
        move(e.clientX);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onLostPointerCapture={() => (dragging.current = false)}
    >
      <SessionImage src={before} alt="Before" fill draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <motion.div className="absolute inset-0" style={{ clipPath: clip }}>
        <SessionImage src={after} alt={afterLabel} draggable={false} className="h-full w-full object-cover" />
      </motion.div>

      <span className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-white/90 backdrop-blur">Before</span>
      <span className="pointer-events-none absolute right-4 top-4 rounded-full border border-mint/40 bg-black/65 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-mint backdrop-blur">{afterLabel}</span>

      <motion.div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_20px_2px_rgb(255_255_255/0.5)]" style={{ left, opacity: handleOpacity }}>
        <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-white text-ink shadow-xl">
          <MoveHorizontal className="h-5 w-5" />
        </span>
      </motion.div>

      {/* one-click views: no dragging needed to see the After render */}
      <div
        className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 cursor-default rounded-full border border-line-strong bg-black/70 p-1 backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(["before", "split", "after"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => go(m)}
            aria-pressed={mode === m}
            className={`rounded-full px-3.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider transition-colors ${mode === m ? "bg-white text-ink" : "text-fog hover:text-white"}`}
          >
            {m === "after" ? "After" : m === "before" ? "Before" : "Split"}
          </button>
        ))}
      </div>
    </div>
  );
}
