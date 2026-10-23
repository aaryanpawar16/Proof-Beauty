import { purgeExpired } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deletes photos older than SESSION_TTL_MINUTES even when nobody starts a new run (blobs have no built-in expiry).
 * Scheduled in vercel.json. Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await purgeExpired();
  return Response.json({ ok: true });
}
