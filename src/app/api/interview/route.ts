import { planSession } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { RUBRIC_VERSION } from "@/lib/metrics";
import { generalJob } from "@/lib/companies";
import { newId, readDb, readSession, updateDb, writeSession } from "@/lib/store";
import type { Difficulty, InterviewLanguage, InterviewType, SessionDetail } from "@/lib/types";

export const maxDuration = 300;

const TYPES: InterviewType[] = ["hr", "manager", "technical", "german", "pressure"];

// Prepares a new interview: plans the questions and returns the opening line.
export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const b = (await req.json()) as {
    jobId?: string;
    general?: { companyId: string; roleId: string };
    resumeId?: string;
    type: InterviewType;
    language: InterviewLanguage;
    difficulty: Difficulty;
    lengthMin: number;
  };
  let db = await readDb(u.id);
  // No restrictions: with neither a job ad nor a company, run a general interview.
  if (!b.jobId && !b.general) b.general = { companyId: "any", roleId: "analyst" };
  if (b.general) {
    // General company interview: reuse (or create) the practice track for this company + role.
    const { companyId, roleId } = b.general;
    const existing = db.jobs.find((j) => j.general?.companyId === companyId && j.general?.roleId === roleId);
    if (existing) b.jobId = existing.id;
    else {
      const track = generalJob(companyId, roleId, newId("job"));
      if (!track) throw new Error("Pick a company and a role.");
      await updateDb(u.id, (d) => {
        d.jobs.push(track);
      });
      b.jobId = track.id;
      db = await readDb(u.id);
    }
  }
  const job = db.jobs.find((j) => j.id === b.jobId);
  const resume = b.resumeId ? (db.resumes.find((r) => r.id === b.resumeId) ?? null) : null; // CV is optional
  if (!job) throw new Error("Pick a job ad or a company first.");
  const type = TYPES.includes(b.type) ? b.type : "hr";
  const language: InterviewLanguage = type === "german" ? "de" : ["en", "de", "mixed"].includes(b.language) ? b.language : "en";
  const difficulty: Difficulty = ["friendly", "realistic", "tough"].includes(b.difficulty) ? b.difficulty : "realistic";
  const lengthMin = [10, 20, 30].includes(Number(b.lengthMin)) ? Number(b.lengthMin) : 20;

  // Practice history on this job track: questions already asked + weak competencies.
  const track = db.sessions.filter((s) => s.jobId === job.id);
  const askedBefore = (await Promise.all(track.map((s) => readSession(u.id, s.id))))
    .flatMap((s) => s?.turns ?? [])
    .filter((t) => t.speaker === "interviewer" && t.kind === "question")
    .map((t) => t.text);
  const compAgg: Record<string, number[]> = {};
  for (const s of track) for (const [k, v] of Object.entries(s.competencyScores ?? {})) (compAgg[k] ??= []).push(v as number);
  const weak = Object.entries(compAgg)
    .map(([k, v]) => [k, v.slice(-2).reduce((a, x) => a + x, 0) / Math.min(2, v.length)] as const)
    .filter(([, v]) => v < 3.5)
    .map(([k]) => k);
  const review = (resume && db.jobReviews.find((r) => r.jobId === job.id && r.resumeId === resume.id)) || null;

  const plan = await planSession({ job, resume, profile: db.profile, review, type, language, difficulty, lengthMin, askedBefore, weakCompetencies: weak, stories: db.stories });
  const first = plan.questions[0];
  const session: SessionDetail = {
    id: newId("ses"),
    jobId: job.id,
    resumeId: resume?.id ?? "",
    type,
    language,
    difficulty,
    lengthMin,
    createdAt: new Date().toISOString(),
    status: "live",
    rubricVersion: RUBRIC_VERSION,
    plan,
    turns: [
      {
        idx: 0,
        speaker: "interviewer",
        text: plan.openingLine,
        lang: first?.lang ?? (language === "de" ? "de" : "en"),
        atMs: 0,
        durationMs: 0,
        kind: "question",
        questionNo: first?.no ?? 1,
        competency: first?.competency ?? "cv_walkthrough",
      },
    ],
    repeatRequests: 0,
  };
  await writeSession(u.id, session);
  return json({ sessionId: session.id });
});
