import { CONCERNS } from "@/lib/concerns";
import type { ConcernId, RunEvent } from "@/lib/types";
import { runLoop } from "@/server/orchestrator";
import { limitOrNull } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel rejects request bodies over 4.5 MB before our code runs; the browser shrinks photos to fit (fitForUpload).
const MAX_BYTES = process.env.VERCEL ? 4.4 * 1024 * 1024 : 12 * 1024 * 1024;

/** Streams the loop as NDJSON so the UI can show every step, candidate and unit spend live. */
export async function POST(req: Request) {
  const limited = await limitOrNull(req, "run");
  if (limited) return limited;
  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No image provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: `Image is too large (max ${Math.round(MAX_BYTES / 1048576)} MB).` }, { status: 413 });
  if (form.get("consent") !== "yes") {
    return Response.json({ error: "Consent is required before photo analysis." }, { status: 400 });
  }

  let ranked: ConcernId[] = [];
  try {
    const parsed = JSON.parse(String(form.get("ranked") ?? "[]"));
    ranked = (Array.isArray(parsed) ? parsed : []).filter((id): id is ConcernId => id in CONCERNS).slice(0, 5);
  } catch {
    /* default: rank by severity */
  }

  const rawImage = Buffer.from(await file.arrayBuffer());
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: RunEvent) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client disconnected */
        }
      };
      try {
        await runLoop({ rawImage, ranked, emit });
      } catch (e: any) {
        emit({ type: "error", message: e?.message ?? "Something went wrong.", code: e?.code });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
