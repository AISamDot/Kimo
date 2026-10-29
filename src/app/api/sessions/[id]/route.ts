import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { deleteSession, readSession } from "@/lib/store";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const s = await readSession(u.id, id);
  if (!s) throw new Error("Session not found");
  return json({ status: s.status, error: s.error ?? null });
});

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  await deleteSession(u.id, id);
  return json({ ok: true });
});
