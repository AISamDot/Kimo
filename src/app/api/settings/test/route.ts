import { handle, json } from "@/lib/api";
import { apiAdmin } from "@/lib/auth";
import { testKey } from "@/lib/speech";

export const POST = handle(async (req: Request) => {
  await apiAdmin();
  const { service } = (await req.json()) as { service: string };
  return json(await testKey(service));
});
