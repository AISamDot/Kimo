import { parseJob } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { aiFitCheck, runFinder } from "@/lib/finder";
import { newId, readDb, updateDb } from "@/lib/store";
import type { FinderPrefs, FoundJob, Job } from "@/lib/types";

export const maxDuration = 300;

type Body =
  | { action: "run" }
  | { action: "prefs"; prefs: Partial<FinderPrefs> }
  | { action: "status"; id: string; status: FoundJob["status"] }
  | { action: "ai"; id: string }
  | { action: "import"; id: string };

export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const b = (await req.json()) as Body;
  const db = await readDb(u.id);
  const latestCv = [...db.resumes].sort((a, c) => c.version - a.version)[0] ?? null;

  if (b.action === "prefs") {
    const p = b.prefs;
    await updateDb(u.id, (d) => {
      const cur = d.finder.prefs;
      d.finder.prefs = {
        keywords: typeof p.keywords === "string" ? p.keywords.slice(0, 500) : cur.keywords,
        cities: typeof p.cities === "string" ? p.cities.slice(0, 300) : cur.cities,
        includeRemote: typeof p.includeRemote === "boolean" ? p.includeRemote : cur.includeRemote,
        remoteOnly: typeof p.remoteOnly === "boolean" ? p.remoteOnly : cur.remoteOnly,
        entryLevelOnly: typeof p.entryLevelOnly === "boolean" ? p.entryLevelOnly : cur.entryLevelOnly,
        minScore: Number.isFinite(p.minScore) ? Math.min(90, Math.max(0, Math.round(p.minScore!))) : cur.minScore,
      };
    });
    return json({ ok: true });
  }

  if (b.action === "run") {
    const { results, note } = await runFinder({ prefs: db.finder.prefs, existing: db.finder.results, resume: latestCv, profile: db.profile });
    await updateDb(u.id, (d) => {
      d.finder.results = results;
      d.finder.lastRun = new Date().toISOString();
      d.finder.lastRunNote = note;
    });
    return json({ note });
  }

  const found = db.finder.results.find((j) => j.id === b.id);
  if (!found) throw new Error("That opening is no longer in your list. Search again.");

  if (b.action === "status") {
    if (!["new", "saved", "dismissed"].includes(b.status)) throw new Error("Bad status");
    await updateDb(u.id, (d) => {
      const j = d.finder.results.find((x) => x.id === b.id);
      if (j && j.status !== "imported") j.status = b.status;
    });
    return json({ ok: true });
  }

  if (b.action === "ai") {
    if (!latestCv) throw new Error("Upload your CV first.");
    const ai = await aiFitCheck(found, latestCv, db.profile);
    await updateDb(u.id, (d) => {
      const j = d.finder.results.find((x) => x.id === b.id);
      if (j) j.ai = ai;
    });
    return json({ ai });
  }

  if (b.action === "import") {
    if (found.jobId && db.jobs.some((j) => j.id === found.jobId)) return json({ jobId: found.jobId });
    const { parsed, text } = await parseJob({ text: `${found.title}\n${found.company} · ${found.location}\n\n${found.description}` });
    const job: Job = { id: newId("job"), createdAt: new Date().toISOString(), source: "url", url: found.url, rawText: text, parsed };
    await updateDb(u.id, (d) => {
      d.jobs.push(job);
      const j = d.finder.results.find((x) => x.id === b.id);
      if (j) {
        j.status = "imported";
        j.jobId = job.id;
      }
    });
    return json({ jobId: job.id });
  }
  throw new Error("Unknown action");
});
