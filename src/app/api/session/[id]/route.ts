import { clearCache, deleteSession } from "@/server/store";

export const runtime = "nodejs";

/** One-tap "delete my photos": removes the session folder and cached analyses. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await deleteSession(id);
  await clearCache();
  return Response.json({ deleted: ok });
}
