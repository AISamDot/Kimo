import { generalCvReview } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/store";

export const maxDuration = 300;

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const db = await readDb(u.id);
  const resume = db.resumes.find((r) => r.id === id);
  if (!resume) throw new Error("CV not found");
  const review = await generalCvReview(resume, db.profile);
  await updateDb(u.id, (d) => {
    const r = d.resumes.find((x) => x.id === id);
    if (r) {
      r.generalReview = review;
      r.generalReviewAt = new Date().toISOString();
    }
  });
  return json({ ok: true });
});
