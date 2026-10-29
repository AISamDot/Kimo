import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { newId, updateDb } from "@/lib/store";
import { STAGES, type Application } from "@/lib/types";

const OUTCOMES = ["active", "rejected", "offer", "withdrawn", "ghosted"];

function clean(b: Partial<Application>, base: Application): Application {
  const str = (v: unknown, d: string) => (typeof v === "string" ? v.slice(0, 4000) : d);
  return {
    ...base,
    company: str(b.company, base.company),
    role: str(b.role, base.role),
    date: str(b.date, base.date),
    resumeId: str(b.resumeId, base.resumeId),
    jobId: str(b.jobId, base.jobId),
    stage: STAGES.includes(b.stage as never) ? b.stage! : base.stage,
    outcome: OUTCOMES.includes(b.outcome as string) ? b.outcome! : base.outcome,
    interviewLanguage: ["", "en", "de", "mixed"].includes(b.interviewLanguage as string) ? b.interviewLanguage! : base.interviewLanguage,
    roleType: str(b.roleType, base.roleType),
    companySize: ["", "startup", "mid", "large"].includes(b.companySize as string) ? b.companySize! : base.companySize,
    feedback: str(b.feedback, base.feedback),
    notes: str(b.notes, base.notes),
  };
}

// Create (no id) or update (with id).
export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const b = (await req.json()) as Partial<Application>;
  const app = await updateDb(u.id, (db) => {
    if (b.id) {
      const i = db.applications.findIndex((a) => a.id === b.id);
      if (i < 0) throw new Error("Application not found");
      db.applications[i] = clean(b, db.applications[i]);
      return db.applications[i];
    }
    if (!b.company?.trim() || !b.role?.trim()) throw new Error("Company and role are required.");
    const created = clean(b, {
      id: newId("app"),
      company: "",
      role: "",
      date: new Date().toISOString().slice(0, 10),
      resumeId: "",
      jobId: "",
      stage: "applied",
      outcome: "active",
      interviewLanguage: "",
      roleType: "",
      companySize: "",
      feedback: "",
      notes: "",
    });
    db.applications.push(created);
    return created;
  });
  return json({ application: app });
});

export const DELETE = handle(async (req: Request) => {
  const u = await apiUser();
  const id = new URL(req.url).searchParams.get("id");
  await updateDb(u.id, (db) => {
    db.applications = db.applications.filter((a) => a.id !== id);
  });
  return json({ ok: true });
});
