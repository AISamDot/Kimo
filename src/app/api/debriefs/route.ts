import { assessDebrief } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { newId, readDb, updateDb } from "@/lib/store";
import { startTask } from "@/lib/tasks";
import { STAGES, type Debrief, type Stage } from "@/lib/types";

export const maxDuration = 300;

const str = (v: unknown, max = 3000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const b = (await req.json()) as Partial<Debrief>;
  const questions = (Array.isArray(b.questions) ? b.questions : [])
    .map((q) => ({ q: str(q?.q, 600), myAnswer: str(q?.myAnswer) }))
    .filter((q) => q.q)
    .slice(0, 20);
  if (!questions.length) throw new Error("Add at least one question you were asked.");
  const input = {
    applicationId: str(b.applicationId, 40),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(b.date)) ? str(b.date) : new Date().toISOString().slice(0, 10),
    stage: (STAGES.includes(b.stage as Stage) ? b.stage : "interview1") as Stage,
    language: (["en", "de", "mixed"].includes(b.language as string) ? b.language : "en") as Debrief["language"],
    interviewers: str(b.interviewers, 300),
    feeling: Math.min(5, Math.max(1, Math.round(Number(b.feeling) || 3))),
    notes: str(b.notes),
    questions,
  };
  const db = await readDb(u.id);
  const app = db.applications.find((a) => a.id === input.applicationId);
  const job = app && db.jobs.find((j) => j.id === app.jobId);
  const resume = (app && db.resumes.find((r) => r.id === app.resumeId)) ?? [...db.resumes].sort((a, c) => c.version - a.version)[0];
  const id = newId("dbf");
  const task = await startTask(u.id, { key: `debrief:${id}`, kind: "debrief", label: `Analysing your ${job?.parsed.company || ""} interview`.replace("  ", " "), href: "/debrief" }, async () => {
    const result = await assessDebrief({ debrief: input, app, job, resume, stories: db.stories });
    const debrief: Debrief = { ...input, id, createdAt: new Date().toISOString(), result };
    await updateDb(u.id, (d) => {
      d.debriefs.push(debrief);
      // Keep the application's stage in step with what he logged.
      const a = d.applications.find((x) => x.id === input.applicationId);
      if (a && STAGES.indexOf(input.stage) > STAGES.indexOf(a.stage)) a.stage = input.stage;
    });
  });
  return json({ task });
});

export const DELETE = handle(async (req: Request) => {
  const u = await apiUser();
  const id = new URL(req.url).searchParams.get("id");
  await updateDb(u.id, (d) => {
    d.debriefs = d.debriefs.filter((x) => x.id !== id);
  });
  return json({ ok: true });
});
