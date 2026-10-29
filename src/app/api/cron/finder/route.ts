// Daily job-finder refresh for every user (Vercel Cron, see vercel.json).
// Only free public job boards are hit here — no Claude calls.
import { FINDER_STALE_MS, FINDER_TASK, refreshFinder } from "@/lib/finder";
import { readApp, readDb } from "@/lib/store";
import { runTask } from "@/lib/tasks";

export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const refreshed: string[] = [];
  for (const user of (await readApp()).users) {
    const db = await readDb(user.id);
    if (!db.resumes.length) continue;
    // Leave a margin so a run from yesterday's visit still counts as due.
    if (db.finder.lastRun && Date.now() - new Date(db.finder.lastRun).getTime() < FINDER_STALE_MS - 3 * 3600_000) continue;
    await runTask(user.id, { ...FINDER_TASK, label: "Daily job refresh" }, async () => {
      await refreshFinder(user.id);
    });
    refreshed.push(user.id);
  }
  return Response.json({ refreshed: refreshed.length });
}
