import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { visibleTasks } from "@/lib/tasks";
import { readDb, updateDb } from "@/lib/store";

export const GET = handle(async () => {
  const u = await apiUser();
  return json({ tasks: visibleTasks((await readDb(u.id)).tasks) });
});

// { dismiss: taskId } hides a finished task from the tray.
export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const { dismiss } = (await req.json()) as { dismiss?: string };
  await updateDb(u.id, (d) => {
    const t = d.tasks.find((x) => x.id === dismiss);
    if (t && t.status !== "running") t.dismissed = true;
  });
  return json({ ok: true });
});
