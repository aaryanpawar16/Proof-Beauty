import { runStage2 } from "@/server/orchestrator";
import { isValidId } from "@/server/store";
import { limitOrNull } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const limited = await limitOrNull(req, "stage2", 2);
  if (limited) return limited;
  const form = await req.formData();
  const file = form.get("image");
  const sessionId = String(form.get("sessionId") ?? "");
  if (!(file instanceof File) || !isValidId(sessionId)) {
    return Response.json({ error: "Missing photo or session." }, { status: 400 });
  }
  try {
    const result = await runStage2(sessionId, Buffer.from(await file.arrayBuffer()));
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Stage 2 failed." }, { status: 500 });
  }
}
