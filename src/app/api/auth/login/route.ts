import { handle, json } from "@/lib/api";
import { logIn, startSession } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const body = (await req.json()) as { email?: string; password?: string };
  const user = await logIn(body.email ?? "", body.password ?? "");
  await startSession(user.id);
  return json({ user });
});
