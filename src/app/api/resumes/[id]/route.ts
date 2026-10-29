import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { updateDb } from "@/lib/store";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  await updateDb(u.id, (db) => {
    db.resumes = db.resumes.filter((r) => r.id !== id);
    db.jobReviews = db.jobReviews.filter((r) => r.resumeId !== id);
  });
  return json({ ok: true });
});
