"use client";

import { useCallback, useReducer, useRef } from "react";
import { fitForUpload } from "@/lib/quality";
import type { Analysis, Candidate, ConcernId, EvaluatedCandidate, RunEvent, RunResult, StepId } from "@/lib/types";

export interface RunState {
  phase: "idle" | "running" | "done" | "error";
  mode?: "live" | "demo";
  higherIsBetter: boolean;
  steps: Partial<Record<StepId, { status: "active" | "done"; detail?: string }>>;
  log: { at: number; step: StepId; text: string }[];
  baseline?: Analysis;
  originalUrl?: string;
  planned: Candidate[];
  evaluated: EvaluatedCandidate[];
  unitsUsed: number;
  unitsLeft?: number;
  estimate?: number;
  result?: RunResult;
  error?: { message: string; code?: string };
}

const init: RunState = { phase: "idle", higherIsBetter: true, steps: {}, log: [], planned: [], evaluated: [], unitsUsed: 0 };

type Action = { type: "reset" } | { type: "begin" } | { type: "event"; e: RunEvent } | { type: "fail"; message: string };

function reducer(s: RunState, a: Action): RunState {
  if (a.type === "reset") return init;
  if (a.type === "begin") return { ...init, phase: "running" };
  if (a.type === "fail") return { ...s, phase: "error", error: { message: a.message } };
  const e = a.e;
  switch (e.type) {
    case "start":
      return { ...s, mode: e.mode, unitsLeft: e.budgetLeft, estimate: e.estimate, higherIsBetter: e.higherIsBetter };
    case "step":
      return {
        ...s,
        steps: { ...s.steps, [e.step]: { status: e.status, detail: e.detail ?? s.steps[e.step]?.detail } },
        log: e.detail ? [...s.log, { at: Date.now(), step: e.step, text: e.detail }] : s.log,
      };
    case "baseline":
      return { ...s, baseline: e.analysis, originalUrl: e.originalUrl };
    case "plan":
      return { ...s, planned: [...s.planned, ...e.candidates] };
    case "candidate":
      return { ...s, evaluated: [...s.evaluated, e.evaluated] };
    case "units":
      return { ...s, unitsUsed: e.used, unitsLeft: e.left };
    case "done":
      return { ...s, phase: "done", result: e.result };
    case "explanation":
      return s.result ? { ...s, result: { ...s.result, explanation: e.lines, explainedBy: e.by } } : s;
    case "error":
      return { ...s, phase: "error", error: { message: e.message, code: e.code } };
  }
}

export function useRun() {
  const [state, dispatch] = useReducer(reducer, init);
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(async (image: Blob, ranked: ConcernId[]) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    dispatch({ type: "begin" });

    const form = new FormData();
    form.set("image", await fitForUpload(image), "selfie.jpg");
    form.set("ranked", JSON.stringify(ranked));
    form.set("consent", "yes");

    try {
      const res = await fetch("/api/run", { method: "POST", body: form, signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        dispatch({ type: "fail", message: j?.error ?? `Request failed (${res.status})` });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) dispatch({ type: "event", e: JSON.parse(line) as RunEvent });
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") dispatch({ type: "fail", message: err?.message ?? "Connection lost." });
    }
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { state, start, reset };
}
