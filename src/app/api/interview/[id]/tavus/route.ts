import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { tavusEndConversation, tavusStartConversation } from "@/lib/speech";

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await apiUser();
  const { id } = await params;
  return json(await tavusStartConversation(`Mock interview ${id}`));
});

export const DELETE = handle(async (req: Request) => {
  await apiUser();
  const cid = new URL(req.url).searchParams.get("conversationId") ?? "";
  await tavusEndConversation(cid);
  return json({ ok: true });
});
