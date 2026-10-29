import { handle, json } from "@/lib/api";
import { signUp, startSession } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const body = (await req.json()) as { email?: string; password?: string; name?: string };
  const user = await signUp({ email: body.email ?? "", password: body.password ?? "", name: body.name ?? "" });
  await startSession(user.id);
  return json({ user });
});
