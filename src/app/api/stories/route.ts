import { mineStories } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { newId, readDb, updateDb } from "@/lib/store";
import { startTask } from "@/lib/tasks";
import { COMPETENCIES, type Competency, type Story } from "@/lib/types";

export const maxDuration = 300;

const str = (v: unknown, max = 3000) => (typeof v === "string" ? v.slice(0, max) : "");

// { mine: true } drafts stories from the latest CV; { story } creates or updates one.
export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const b = (await req.json()) as { mine?: boolean; story?: Partial<Story> };
  if (b.mine) {
    const db = await readDb(u.id);
    const resume = [...db.resumes].sort((a, c) => c.version - a.version)[0];
    if (!resume) throw new Error("Upload your CV first.");
    const task = await startTask(u.id, { key: "stories:mine", kind: "stories", label: "Drafting stories from your CV", href: "/stories" }, async () => {
      const drafts = await mineStories(resume, db.profile, db.stories);
      const now = new Date().toISOString();
      await updateDb(u.id, (d) => {
        for (const x of drafts) d.stories.push({ ...x, id: newId("sty"), source: "cv", createdAt: now, updatedAt: now });
      });
    });
    return json({ task });
  }
  const x = b.story ?? {};
  if (!str(x.title).trim()) throw new Error("Give the story a title.");
  const comps = (Array.isArray(x.competencies) ? x.competencies : []).filter((c): c is Competency => COMPETENCIES.includes(c as Competency));
  const fields = {
    title: str(x.title, 200),
    situation: str(x.situation),
    task: str(x.task),
    action: str(x.action),
    result: str(x.result),
    metrics: str(x.metrics, 500),
    competencies: comps,
    answersQuestions: (Array.isArray(x.answersQuestions) ? x.answersQuestions : []).map((q) => str(q, 300)).filter(Boolean).slice(0, 8),
  };
  const now = new Date().toISOString();
  const story = await updateDb(u.id, (d) => {
    if (x.id) {
      const s = d.stories.find((y) => y.id === x.id);
      if (!s) throw new Error("Story not found");
      Object.assign(s, fields, { updatedAt: now });
      return s;
    }
    const s: Story = { ...fields, id: newId("sty"), source: "manual", createdAt: now, updatedAt: now };
    d.stories.push(s);
    return s;
  });
  return json({ story });
});

export const DELETE = handle(async (req: Request) => {
  const u = await apiUser();
  const id = new URL(req.url).searchParams.get("id");
  await updateDb(u.id, (d) => {
    d.stories = d.stories.filter((s) => s.id !== id);
  });
  return json({ ok: true });
});
