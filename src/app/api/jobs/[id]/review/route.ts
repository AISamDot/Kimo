import { jobCvReview } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { newId, readDb, updateDb } from "@/lib/store";
import { startTask } from "@/lib/tasks";

export const maxDuration = 300;

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const { resumeId } = (await req.json()) as { resumeId: string };
  const db = await readDb(u.id);
  const job = db.jobs.find((j) => j.id === id);
  const resume = db.resumes.find((r) => r.id === resumeId);
  if (!job || !resume) throw new Error("Job or CV not found");
  const label = `Checking ${resume.label} against ${job.parsed.title || "the job ad"}`;
  const task = await startTask(u.id, { key: `jobreview:${id}:${resumeId}`, kind: "job-review", label, href: `/jobs/${id}?cv=${resumeId}` }, async () => {
    const result = await jobCvReview(resume, job, db.profile);
    await updateDb(u.id, (d) => {
      d.jobReviews = d.jobReviews.filter((r) => !(r.jobId === id && r.resumeId === resumeId));
      d.jobReviews.push({ id: newId("rev"), jobId: id, resumeId, createdAt: new Date().toISOString(), result });
    });
  });
  return json({ task });
});
