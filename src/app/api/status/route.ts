import { cfg, isLive } from "@/server/config";
import { ledgerSummary } from "@/server/ledger";
import { creditsRunDry, estimateUnits } from "@/server/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const l = await ledgerSummary();
  return Response.json({
    mode: isLive() ? "live" : "demo",
    budget: cfg.budget,
    used: isLive() ? l.used : 0,
    left: isLive() ? l.left : cfg.budget,
    perRun: estimateUnits(false),
    perRunMax: estimateUnits(true),
    runsLeft: Math.floor((isLive() ? l.left : cfg.budget) / estimateUnits(true)),
    noiseBand: cfg.noiseBand,
    // ground truth from YouCam itself (the counts above are only the app's own task tally)
    // true = the next run will use the simulated engine (our count is empty, or YouCam recently refused for credits)
    exhausted: await creditsRunDry(),
    exhaustedAt: isLive() ? l.exhaustedAt : null,
  });
}
