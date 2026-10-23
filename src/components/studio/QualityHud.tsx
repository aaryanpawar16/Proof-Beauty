"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, TriangleAlert, X } from "lucide-react";
import type { QualityCheck, QualityReport } from "@/lib/quality";

const STYLE = {
  ok: { Icon: Check, cls: "bg-mint text-ink", text: "text-mint" },
  warn: { Icon: TriangleAlert, cls: "bg-amber text-ink", text: "text-amber" },
  fail: { Icon: X, cls: "bg-bad text-white", text: "text-bad" },
  pending: { Icon: Loader2, cls: "bg-white/10 text-fog", text: "text-fog" },
} as const;

function Row({ c }: { c: QualityCheck }) {
  const st = STYLE[c.status];
  return (
    <motion.li layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.025] px-3.5 py-2.5">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors duration-300 ${st.cls}`}>
        <st.Icon className={`h-3.5 w-3.5 ${c.status === "pending" ? "animate-spin" : ""}`} strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-white">{c.label}</span>
          <span className="truncate font-mono text-[0.68rem] text-fog">{c.value}</span>
        </div>
        <AnimatePresence initial={false}>
          {(c.status === "fail" || c.status === "warn") && c.tip && (
            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`overflow-hidden text-xs ${st.text}`}>
              {c.tip}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

export function QualityHud({ report }: { report: QualityReport | null }) {
  if (!report || report.checks.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.025] px-4 py-5 text-sm text-fog">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the face detector…
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {report.checks.map((c) => (
        <Row key={c.id} c={c} />
      ))}
    </ul>
  );
}
