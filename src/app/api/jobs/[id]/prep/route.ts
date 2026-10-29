import { buildPrepPack } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { readDb, readSession, updateDb } from "@/lib/store";

export const maxDuration = 300;

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const db = await readDb(u.id);
  const job = db.jobs.find((j) => j.id === id);
  if (!job) throw new Error("Job not found");
  const resume = [...db.resumes].sort((a, b) => b.version - a.version)[0];
  if (!resume) throw new Error("Upload your CV first.");
  const review = db.jobReviews.filter((r) => r.jobId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  // Weak points from his last few scored sessions on this job.
  const recent = db.sessions.filter((s) => s.jobId === id && s.status === "done").slice(-3);
  const weakPoints: string[] = [];
  for (const s of recent) {
    const d = await readSession(u.id, s.id);
    for (const a of d?.analysis?.answers ?? []) if (a.whatWasMissing) weakPoints.push(`${a.question} → missing: ${a.whatWasMissing}`);
    for (const x of d?.analysis?.report.silentRejecters ?? []) weakPoints.push(x);
  }
  const pack = await buildPrepPack({ job, resume, profile: db.profile, stories: db.stories, review, weakPoints: weakPoints.slice(0, 15) });
  await updateDb(u.id, (d) => {
    const j = d.jobs.find((x) => x.id === id);
    if (j) j.prepPack = { ...pack, createdAt: new Date().toISOString(), resumeId: resume.id };
  });
  return json({ ok: true });
});
