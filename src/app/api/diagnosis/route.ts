import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { runDiagnosis } from "@/lib/diagnosis";
import { startTask } from "@/lib/tasks";

export const maxDuration = 300;

export const POST = handle(async () => {
  const u = await apiUser();
  const task = await startTask(u.id, { key: "diagnosis", kind: "diagnosis", label: "Diagnosing why offers aren't coming", href: "/diagnosis" }, async () => {
    await runDiagnosis(u.id);
  });
  return json({ task });
});
