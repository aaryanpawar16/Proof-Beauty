import fs from "node:fs/promises";
import path from "node:path";
import { cfg } from "./config";
import { hasRedis, redis, redisTx } from "./redis";

/**
 * Local task counter. NOTE: this counts tasks (UNIT_COST_* each, default 1). It is NOT YouCam's real credit balance:
 * YouCam charges more than 1 credit per task (the 1000 free credits ran out after ~180 tasks), so this number can
 * say "800 left" while YouCam has none. `exhaustedAt` is the ground truth: set when YouCam itself says
 * CreditInsufficiency, cleared the next time a task is accepted.
 *
 * Storage: Redis when configured (atomic counters, shared by every serverless instance), else .data/ledger.json.
 * On a fresh Redis the counter starts at 0, so set CREDIT_BUDGET to the credits you actually have left when you deploy.
 */
interface Ledger {
  used: number;
  tasks: Record<string, number>;
  runs: { at: string; units: number; session: string }[];
  exhaustedAt?: string;
}

/* ---------------- Redis backend ---------------- */
const K = { used: "pb:ledger:used", tasks: "pb:ledger:tasks", runs: "pb:ledger:runs", exhausted: "pb:ledger:exhausted" };

async function readRedis(): Promise<Ledger> {
  const [used, tasks, runs, exhausted] = (await redisTx([
    ["GET", K.used],
    ["HGETALL", K.tasks],
    ["LRANGE", K.runs, 0, 7],
    ["GET", K.exhausted],
  ])) as [string | null, string[] | null, string[] | null, string | null];
  const t: Record<string, number> = {};
  for (let i = 0; tasks && i < tasks.length; i += 2) t[tasks[i]] = Number(tasks[i + 1]);
  return {
    used: Number(used ?? 0),
    tasks: t,
    runs: (runs ?? []).map((r) => JSON.parse(r)).reverse(), // stored newest-first
    exhaustedAt: exhausted ?? undefined,
  };
}

/* ---------------- local file backend ---------------- */
const file = () => path.join(cfg.dataDir, "ledger.json");
let chain: Promise<unknown> = Promise.resolve();

async function readFileLedger(): Promise<Ledger> {
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
    const l = await readFileLedger();
    const out = fn(l);
    await write(l);
    return out;
  });
  chain = next.catch(() => undefined);
  return next;
}

const read = () => (hasRedis() ? readRedis() : readFileLedger());

export async function unitsLeft(): Promise<number> {
  const l = await read();
  return Math.max(0, cfg.budget - l.used);
}

export async function ledgerSummary() {
  const l = await read();
  return { used: l.used, budget: cfg.budget, left: Math.max(0, cfg.budget - l.used), tasks: l.tasks, runs: l.runs.slice(-8), exhaustedAt: l.exhaustedAt ?? null };
}

/** YouCam said the account has no credits left. */
export async function markExhausted() {
  if (hasRedis()) {
    await redis("SET", K.exhausted, new Date().toISOString());
    return;
  }
  await mutate((l) => {
    l.exhaustedAt = new Date().toISOString();
  });
}

export async function spend(task: string, units: number): Promise<number> {
  if (hasRedis()) {
    const [, used] = (await redisTx([
      ["DEL", K.exhausted], // a task was just accepted, so credits exist again (top-up / new key)
      ["INCRBY", K.used, units],
      ["HINCRBY", K.tasks, task, units],
    ])) as [unknown, number, unknown];
    return Math.max(0, cfg.budget - used);
  }
  return mutate((l) => {
    l.exhaustedAt = undefined;
    l.used += units;
    l.tasks[task] = (l.tasks[task] ?? 0) + units;
    return Math.max(0, cfg.budget - l.used);
  });
}

export async function recordRun(session: string, units: number) {
  const entry = { at: new Date().toISOString(), units, session };
  if (hasRedis()) {
    await redisTx([
      ["LPUSH", K.runs, JSON.stringify(entry)],
      ["LTRIM", K.runs, 0, 49],
    ]);
    return;
  }
  await mutate((l) => {
    l.runs.push(entry);
  });
}
