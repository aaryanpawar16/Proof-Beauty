"use client";

import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Logo } from "../ui";

const LINKS = [
  { href: "#loop", label: "The loop" },
  { href: "#scoring", label: "Scoring" },
  { href: "#cheat", label: "Integrity" },
  { href: "#honesty", label: "Honesty" },
  { href: "#stage2", label: "Stage 2" },
  { href: "#privacy", label: "Privacy" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={`flex w-full max-w-5xl items-center justify-between rounded-full px-4 py-2.5 transition-all duration-500 sm:px-5 ${
          scrolled ? "glass !bg-ink/85 shadow-[0_10px_50px_-12px_rgb(0_0_0/0.8)]" : "border border-transparent"
        }`}
      >
        <Link href="/" aria-label="Proof Beauty home"><Logo /></Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-3.5 py-2 text-sm text-fog transition-colors hover:bg-white/[0.06] hover:text-white">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <Link href="/studio" className="group inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink transition-transform hover:scale-[1.04] active:scale-95">
          Try it
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </nav>
    </motion.header>
  );
}
