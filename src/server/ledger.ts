import fs from "node:fs/promises";
import path from "node:path";
import { cfg } from "./config";

/**
 * Local task counter. NOTE: this counts tasks (UNIT_COST_* each, default 1). It is NOT YouCam's real credit balance:
 * YouCam charges more than 1 credit per task (the 1000 free credits ran out after ~180 tasks), so this number can
 * say "800 left" while YouCam has none. `exhaustedAt` is the ground truth: set when YouCam itself says
 * CreditInsufficiency, cleared the next time a task is accepted.
 */
interface Ledger {
  used: number;
  tasks: Record<string, number>;
  runs: { at: string; units: number; session: string }[];
  exhaustedAt?: string;
}

const file = () => path.join(cfg.dataDir, "ledger.json");
let chain: Promise<unknown> = Promise.resolve();

async function read(): Promise<Ledger> {
  try {
    return JSON.parse(await fs.readFile(file(), "utf8"));
  } catch {
    return { used: 0, tasks: {}, runs: [] };
  }
}

async function write(l: Ledger) {
  await fs.mkdir(cfg.dataDir, { recursive: true });
  await fs.writeFile(file(), JSON.stringify(l, null, 2));
}

/** serialise read-modify-write so parallel tasks don't clobber each other */
function mutate<T>(fn: (l: Ledger) => T): Promise<T> {
  const next = chain.then(async () => {
    const l = await read();
    const out = fn(l);
    await write(l);
    return out;
  });
  chain = next.catch(() => undefined);
  return next;
}

export async function unitsLeft(): Promise<number> {
  const l = await read();
  return Math.max(0, cfg.budget - l.used);
}

export async function ledgerSummary() {
  const l = await read();
  return { used: l.used, budget: cfg.budget, left: Math.max(0, cfg.budget - l.used), tasks: l.tasks, runs: l.runs.slice(-8), exhaustedAt: l.exhaustedAt ?? null };
}

/** YouCam said the account has no credits left. */
export function markExhausted() {
  return mutate((l) => {
    l.exhaustedAt = new Date().toISOString();
  });
}

export function spend(task: string, units: number) {
  return mutate((l) => {
    l.exhaustedAt = undefined; // a task was just accepted, so credits exist again (top-up / new key)
    l.used += units;
    l.tasks[task] = (l.tasks[task] ?? 0) + units;
    return Math.max(0, cfg.budget - l.used);
  });
}

export function recordRun(session: string, units: number) {
  return mutate((l) => {
    l.runs.push({ at: new Date().toISOString(), units, session });
  });
}
