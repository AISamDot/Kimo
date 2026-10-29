import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { deleteSession, readDb, updateDb } from "@/lib/store";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  for (const s of (await readDb(u.id)).sessions.filter((x) => x.jobId === id)) await deleteSession(u.id, s.id);
  await updateDb(u.id, (db) => {
    db.jobs = db.jobs.filter((j) => j.id !== id);
    db.jobReviews = db.jobReviews.filter((r) => r.jobId !== id);
    db.drills = db.drills.filter((d) => d.jobId !== id);
  });
  return json({ ok: true });
});
