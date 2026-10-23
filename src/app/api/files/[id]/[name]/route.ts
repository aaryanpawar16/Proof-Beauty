import { readFile, isValidId, isValidName } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await ctx.params;
  if (!isValidId(id) || !isValidName(name) || !/\.(jpg|png)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  const buf = await readFile(id, name);
  if (!buf) return new Response("Gone. Photos are deleted after an hour.", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": name.endsWith(".png") ? "image/png" : "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
