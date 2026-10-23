import { deleteSession } from "@/server/store";

export const runtime = "nodejs";

/** One-tap "delete my photos": removes the session's files and its cached analysis. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return Response.json({ deleted: await deleteSession(id) });
  } catch {
    return Response.json({ deleted: false }, { status: 500 });
  }
}
