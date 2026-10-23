"use client";

import { animate, motion, useInView, useMotionValue, useTransform, type HTMLMotionProps } from "framer-motion";
import clsx from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import { fmt } from "@/lib/format";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade/slide in when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  once = true,
  ...rest
}: { children: ReactNode; delay?: number; y?: number; className?: string; once?: boolean } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.85, delay, ease: EASE }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Card with a cursor-follow glow. */
export function SpotlightCard({ children, className, ...rest }: { children: ReactNode; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        ref.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={clsx("card spotlight", className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Number that counts up when it enters the viewport. */
export function CountUp({
  to,
  from = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
  className,
}: {
  to: number;
  from?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const mv = useMotionValue(from);
  const text = useTransform(mv, (v) => `${prefix}${fmt(v, decimals)}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration, ease: EASE });
    return () => c.stop();
  }, [inView, to, mv, duration]);
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/** Smoothly tweens to a new value whenever `value` changes (for live counters). */
export function Tween({ value, decimals = 0, className, prefix = "", suffix = "" }: { value: number; decimals?: number; className?: string; prefix?: string; suffix?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `${prefix}${fmt(v, decimals)}${suffix}`);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: EASE });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={clsx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <motion.div
        className="absolute -top-40 left-[8%] h-[34rem] w-[34rem] rounded-full bg-rose/25 blur-[130px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, 10, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -top-20 right-[4%] h-[38rem] w-[38rem] rounded-full bg-violet/25 blur-[140px]"
        animate={{ x: [0, -70, 20, 0], y: [0, 50, -10, 0], scale: [1, 0.92, 1.12, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[28rem] left-[38%] h-[26rem] w-[26rem] rounded-full bg-peach/15 blur-[130px]"
        animate={{ x: [0, 40, -40, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-rose via-violet to-peach">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-ink" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <span className="absolute inset-0 rounded-xl ring-1 ring-white/30" />
      </span>
      <span className="text-[1.05rem] font-semibold tracking-tight text-white">
        Proof<span className="font-display text-[1.25rem] italic text-gradient"> Beauty</span>
      </span>
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.04] px-3.5 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-fog", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_10px_2px_rgb(79_240_189/0.7)]" />
      {children}
    </span>
  );
}

export function SectionHead({ eyebrow, title, sub, align = "center" }: { eyebrow: string; title: ReactNode; sub?: ReactNode; align?: "center" | "left" }) {
  return (
    <div className={clsx("flex flex-col gap-5", align === "center" ? "items-center text-center" : "items-start text-left")}>
      <Reveal><Eyebrow>{eyebrow}</Eyebrow></Reveal>
      <Reveal delay={0.08}>
        <h2 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">{title}</h2>
      </Reveal>
      {sub && (
        <Reveal delay={0.16}>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-fog sm:text-lg">{sub}</p>
        </Reveal>
      )}
    </div>
  );
}
