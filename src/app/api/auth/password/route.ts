import { handle, json } from "@/lib/api";
import { apiUser, changePassword, startSession } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const body = (await req.json()) as { current?: string; next?: string };
  await changePassword(u.id, body.current ?? "", body.next ?? "");
  await startSession(u.id);
  return json({ ok: true });
});
