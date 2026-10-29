import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { runDiagnosis } from "@/lib/diagnosis";

export const maxDuration = 300;

export const POST = handle(async () => {
  const u = await apiUser();
  const d = await runDiagnosis(u.id);
  return json({ id: d.id });
});
