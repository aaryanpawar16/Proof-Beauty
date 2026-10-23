import { CONCERNS } from "@/lib/concerns";
import { fmt } from "@/lib/format";
import { MAX_ACCEPTABLE_DRIFT_DE } from "@/lib/scoring";
import { describeShade } from "@/lib/products";
import type { ConcernId, EvaluatedCandidate, Analysis } from "@/lib/types";
import { cfg } from "./config";

interface Facts {
  best: EvaluatedCandidate;
  baseline: Analysis;
  unavailable: ConcernId[];
  refined: boolean;
  /** integrity-check control look, if it ran */
  control?: EvaluatedCandidate;
}

const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;
const pts = (x: number) => Math.round(x);
const name = (id: ConcernId) => CONCERNS[id].label.toLowerCase();

/**
 * Code writes every sentence, with every number, from the computed scores. The LLM (if enabled) may
 * only re-word those sentences; see rewrite(). It never gets to choose what is said or which numbers.
 */
function template(f: Facts): string[] {
  const s = f.best.score;
  const out: string[] = [];
  const top = s.deltas[0];
  if (top) {
    out.push(
      top.confidence === "within-noise"
        ? `${f.best.candidate.name} scored best (J ${fmt(s.J)}), but its change on ${name(top.concern)} is inside the measurement noise band, so we're not claiming a win there.`
        : `${f.best.candidate.name} scored best (J ${fmt(s.J)}). It cut visible ${name(top.concern)} by ${pct(top.reduction)} (severity ${pts(top.baselineSeverity)} → ${pts(top.renderSeverity)}), confidence: ${top.confidence}.`,
    );
  }
  const others = s.deltas.slice(1).filter((d) => d.confidence !== "within-noise" && d.reduction > 0);
  if (others.length) {
    out.push(
      `Also improved: ${others.map((d) => `${name(d.concern)} (−${pct(d.reduction)})`).join(", ")}.`,
    );
  }
  const flat = s.deltas.filter((d) => d.confidence === "within-noise" || d.reduction <= 0);
  if (flat.length) {
    out.push(
      `No reliable change on ${flat.map((d) => name(d.concern)).join(", ")}. Treat that as "makeup didn't move it", not as a result.`,
    );
  }
  if (f.unavailable.length) {
    out.push(
      `Makeup won't fix ${f.unavailable.map(name).join(" or ")}. We left it out of scoring rather than pretend otherwise.`,
    );
  }
  out.push(
    s.toneDriftDE < 3
      ? `Shade match is tight (tone drift ΔE ${s.toneDriftDE.toFixed(1)}), so this should read as your skin, not a mask.`
      : `Tone drift is ΔE ${s.toneDriftDE.toFixed(1)}. Worth checking the shade in daylight before buying.`,
  );
  const c = f.control?.score;
  if (c && c.toneDriftDE > MAX_ACCEPTABLE_DRIFT_DE) {
    // same rule as the results card (src/lib/integrity.ts): compare on the top concern, gap must clear the noise
    const cTop = c.deltas.find((d) => d.concern === s.topConcern);
    const bTop = s.deltas.find((d) => d.concern === s.topConcern);
    const gap = (bTop?.renderSeverity ?? 0) - (cTop?.renderSeverity ?? 0); // + = control ahead
    const noise = bTop?.noise ?? 2;
    const concern = s.topConcern ? name(s.topConcern) : "your top concern";
    const dE = c.toneDriftDE.toFixed(1);
    out.push(
      gap > noise
        ? `A score-only try-on would have picked a brightening look, which scores clearly higher on ${concern}. But it shifted your skin shade by ΔE ${dE}, so we rejected it.`
        : gap < -noise
          ? `We also tested a brightening shortcut. It shifted your skin shade by ΔE ${dE} and scored clearly worse than real treatment.`
          : `We also tested a brightening shortcut. It scored about the same on ${concern} but shifted your skin shade by ΔE ${dE}, so the score alone couldn't tell it from real treatment. The shade check did.`,
    );
  }
  if (f.refined) out.push("The first round under-delivered on your top concern, so we ran one refinement round with different patterns.");
  if (describeShade(f.baseline.tone, f.baseline.driftLab).depth === "deep") {
    out.push("Heads up: verification can be less reliable on deeper skin tones. Treat the numbers as directional and use Stage 2 to confirm.");
  }
  return out;
}

const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n))).sort();
const sameNumbers = (a: string, b: string) => {
  const x = nums(a), y = nums(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

function reject(why: string): null {
  console.warn(`[explain] Ollama (${cfg.ollamaModel}) not used, falling back to template: ${why}`);
  return null;
}

/**
 * Ask a local Ollama model to re-word each template sentence in a friendlier voice.
 * Guard: a rewrite is accepted only if it contains exactly the same numbers as its source sentence.
 * Anything else (wrong/extra/missing number, empty, wrong line count) falls back to the original
 * sentence, so a weak model like llama2 can only change tone, never content.
 */
async function rewrite(lines: string[]): Promise<{ lines: string[]; accepted: number } | null> {
  if (!cfg.ollamaModel) return null;
  try {
    const res = await fetch(`${cfg.ollamaHost}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(cfg.ollamaTimeoutMs),
      body: JSON.stringify({
        model: cfg.ollamaModel,
        stream: false,
        format: "json",
        options: { temperature: 0.3, num_predict: 600 },
        messages: [
          {
            role: "system",
            content:
              "You rewrite short notes for a makeup shopper in a warm, plain, friendly voice. " +
              "Rewrite EACH sentence you are given, in the same order, one output sentence per input sentence. " +
              "Keep every number, symbol (like J, ΔE, −, →) and concern name exactly as written. Do not add facts, numbers, advice or claims. " +
              "Never make medical claims. " +
              'Reply with ONLY a JSON object: {"lines": ["...", "..."]} with exactly as many strings as input sentences.',
          },
          { role: "user", content: JSON.stringify({ sentences: lines }) },
        ],
      }),
    });
    if (!res.ok) return reject(`Ollama replied ${res.status} (is "${cfg.ollamaModel}" pulled? try: ollama pull ${cfg.ollamaModel})`);
    const json = await res.json();
    const text: string = json.message?.content ?? "";
    const parsed = JSON.parse(text);
    const arr: unknown = Array.isArray(parsed) ? parsed : parsed?.lines;
    if (!Array.isArray(arr) || arr.length !== lines.length) return reject(`expected ${lines.length} lines, got: ${text.slice(0, 160)}`);

    let accepted = 0;
    const out = lines.map((orig, i) => {
      const cand = arr[i];
      if (typeof cand !== "string" || !cand.trim()) return orig;
      if (!sameNumbers(orig, cand)) {
        console.warn(`[explain] rewrite ${i + 1} dropped (numbers differ): "${cand}"`);
        return orig;
      }
      accepted++;
      return cand.trim();
    });
    return accepted ? { lines: out, accepted } : reject("no rewritten line kept the original numbers");
  } catch (e: any) {
    return reject(e?.name === "TimeoutError" ? `timed out after ${cfg.ollamaTimeoutMs}ms` : (e?.cause?.code ?? e?.message ?? "failed"));
  }
}

/** The explanation, instantly: every sentence and number written by code. */
export const explainNow = (f: Facts): string[] => template(f);

/**
 * Optional local-LLM reword of those sentences. Slow on CPU (llama2 often can't finish in the timeout), so the
 * orchestrator sends results first and streams this later as an "explanation" update, if it ever finishes.
 */
export async function explainReword(lines: string[]): Promise<string[] | null> {
  const rw = await rewrite(lines);
  return rw ? rw.lines : null;
}
