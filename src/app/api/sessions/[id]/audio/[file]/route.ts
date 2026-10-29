import { handle } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { readAudio } from "@/lib/store";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) => {
  const u = await apiUser();
  const { id, file } = await params;
  const buf = await readAudio(u.id, id, file);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" } });
});
