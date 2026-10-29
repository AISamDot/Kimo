// Job finder: pulls live openings from free job boards and ranks them against his CV.
import { z } from "zod";
import { htmlToText, isRemote, localFit, outsideGermany, remoteFromGermany } from "./jobfit";
import { llmJson } from "./llm";
import { getSettings } from "./store";
import type { FinderPrefs, FinderSource, FoundJob, Profile, Resume } from "./types";

type Raw = Omit<FoundJob, "fit" | "status" | "foundAt">;

const MAX_DESC = 5000;
const splitList = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

/** Arbeitnow: free, keyless board of jobs in Germany (many English-speaking). */
async function arbeitnow(prefs: FinderPrefs, pages = 4): Promise<Raw[]> {
  const kws = splitList(prefs.keywords).map((k) => k.toLowerCase());
  const out: Raw[] = [];
  for (let page = 1; page <= pages; page++) {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Arbeitnow returned ${res.status}`);
    const body = (await res.json()) as {
      data?: { slug: string; company_name: string; title: string; description: string; remote: boolean; url: string; tags: string[]; location: string; created_at: number }[];
    };
    const rows = body.data ?? [];
    for (const r of rows) {
      const hay = `${r.title} ${r.tags.join(" ")} ${r.description.slice(0, 4000)}`.toLowerCase();
      if (kws.length && !kws.some((k) => hay.includes(k))) continue;
      out.push({
        id: `arbeitnow:${r.slug}`,
        source: "arbeitnow",
        title: r.title,
        company: r.company_name,
        location: r.location,
        remote: isRemote(!!r.remote, r.title, r.location, r.tags.join(" "), r.description.slice(0, 1500)),
        url: r.url,
        description: htmlToText(r.description).slice(0, MAX_DESC),
        postedAt: new Date(r.created_at * 1000).toISOString(),
        salary: "",
      });
    }
    if (rows.length < 50) break;
  }
  return out;
}

/** Adzuna Germany: free developer key, keyword + city search. */
async function adzuna(prefs: FinderPrefs, appId: string, appKey: string): Promise<Raw[]> {
  const kws = splitList(prefs.keywords).slice(0, 5);
  const cities = splitList(prefs.cities).slice(0, 3);
  // Remote-only searches ignore cities and ask Adzuna for remote ads directly.
  const wheres = cities.length && !prefs.remoteOnly ? cities : [""];
  const out: Raw[] = [];
  for (const what of kws) {
    for (const where of wheres) {
      const q = new URLSearchParams({ app_id: appId, app_key: appKey, results_per_page: "40", what: prefs.remoteOnly ? `${what} remote` : what, "content-type": "application/json", max_days_old: "30" });
      if (where) q.set("where", where);
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/de/search/1?${q}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`Adzuna returned ${res.status}`);
      const body = (await res.json()) as {
        results?: { id: string; title: string; description: string; redirect_url: string; created: string; company?: { display_name?: string }; location?: { display_name?: string }; salary_min?: number; salary_max?: number }[];
      };
      for (const r of body.results ?? []) {
        out.push({
          id: `adzuna:${r.id}`,
          source: "adzuna",
          title: htmlToText(r.title),
          company: r.company?.display_name ?? "",
          location: r.location?.display_name ?? "",
          remote: isRemote(false, r.title, r.description, r.location?.display_name ?? ""),
          url: r.redirect_url,
          description: htmlToText(r.description).slice(0, MAX_DESC),
          postedAt: r.created,
          salary: r.salary_min ? `€${Math.round(r.salary_min / 1000)}k${r.salary_max && r.salary_max !== r.salary_min ? `–${Math.round(r.salary_max / 1000)}k` : ""}` : "",
        });
      }
    }
  }
  return out;
}

function passesFilters(j: Raw & { fit: FoundJob["fit"] }, prefs: FinderPrefs) {
  // Remote jobs are fine wherever the employer sits; on-site jobs must be in Germany.
  if (prefs.remoteOnly && !j.remote) return false;
  if (j.remote ? !remoteFromGermany(j.location, j.title) : outsideGermany(j.location)) return false;
  if (prefs.entryLevelOnly && j.fit.seniority === "senior") return false;
  const cities = splitList(prefs.cities).map((c) => c.toLowerCase());
  if (cities.length && !cities.some((c) => j.location.toLowerCase().includes(c)) && !(prefs.includeRemote && j.remote)) return false;
  return j.fit.score >= prefs.minScore;
}

/** Fetch every enabled source, score, and merge with what he already saved or dismissed. */
export async function runFinder(args: { prefs: FinderPrefs; existing: FoundJob[]; resume: Resume | null; profile: Profile }) {
  const keys = (await getSettings()).keys;
  const notes: string[] = [];
  const raws: Raw[] = [];
  const sources: { name: FinderSource; run: () => Promise<Raw[]> }[] = [{ name: "arbeitnow", run: () => arbeitnow(args.prefs) }];
  if (keys.adzunaAppId && keys.adzunaAppKey) sources.push({ name: "adzuna", run: () => adzuna(args.prefs, keys.adzunaAppId, keys.adzunaAppKey) });
  else notes.push("Add a free Adzuna key on Integrations for many more openings.");
  const settled = await Promise.allSettled(sources.map((s) => s.run()));
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      raws.push(...r.value);
      notes.push(`${sources[i].name}: ${r.value.length} matching ads`);
    } else notes.push(`${sources[i].name} failed: ${(r.reason as Error).message}`);
  });

  const now = new Date().toISOString();
  const byId = new Map(args.existing.map((j) => [j.id, j]));
  // Same job posted on two boards: keep one (company + title).
  const seen = new Set(args.existing.filter((j) => j.status !== "new").map((j) => `${j.company}|${j.title}`.toLowerCase()));
  let added = 0;
  for (const r of raws) {
    const fit = localFit(r, args.resume?.parsed ?? null, args.profile);
    const prev = byId.get(r.id);
    if (prev) {
      // Unreviewed ads that no longer pass his (possibly changed) filters drop out.
      if (prev.status === "new" && !passesFilters({ ...r, fit }, args.prefs)) byId.delete(r.id);
      else byId.set(r.id, { ...prev, ...r, fit, status: prev.status, ai: prev.ai, jobId: prev.jobId });
      continue;
    }
    const dupKey = `${r.company}|${r.title}`.toLowerCase();
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);
    if (!passesFilters({ ...r, fit }, args.prefs)) continue;
    byId.set(r.id, { ...r, fit, status: "new", foundAt: now });
    added++;
  }
  // Keep everything he acted on; drop unseen "new" ads older than 45 days; cap the list.
  const cutoff = Date.now() - 45 * 864e5;
  const results = [...byId.values()]
    .filter((j) => j.status !== "new" || new Date(j.postedAt || j.foundAt).getTime() > cutoff)
    .sort((a, b) => b.fit.score - a.fit.score)
    .slice(0, 400);
  notes.unshift(`${added} new match${added === 1 ? "" : "es"}`);
  return { results, note: notes.join(" · ") };
}

const AiFitZ = z.object({
  score: z.number().describe("0-100 realistic chance he gets a recruiter screen for this ad"),
  verdict: z.enum(["apply", "stretch", "skip"]),
  why: z.string().describe("2-3 sentences, specific to his CV"),
  risks: z.array(z.string()).describe("0-3 reasons a recruiter might reject him"),
  angle: z.string().describe("The one thing to lead with in his application for this ad"),
});

export async function aiFitCheck(job: FoundJob, resume: Resume, profile: Profile) {
  const out = await llmJson(AiFitZ, {
    role: "analysis",
    system:
      "You screen applications for supply-chain roles in Germany. The candidate is an Egyptian master's student in Germany (non-EU, needs a work permit) with many interviews and no offer yet. Judge honestly whether he should spend time applying.",
    content: `CANDIDATE PROFILE:\n${JSON.stringify(profile)}\n\nCV:\n${JSON.stringify(resume.parsed)}\n\nJOB AD: ${job.title} at ${job.company} (${job.location}${job.remote ? ", remote possible" : ""})\n${job.description}`,
    maxTokens: 3000,
  });
  return { ...out, checkedAt: new Date().toISOString() };
}
