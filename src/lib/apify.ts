// Apify job scrapers (paid, optional): LinkedIn + Indeed, country by country across his chosen regions
// (Germany, rest of Europe, GCC, Asia, Africa), run at most about once a day.
// Actor output fields aren't documented, so items are mapped tolerantly and anything without a title + link is dropped.
import { htmlToText, isRemote } from "./jobfit";
import { countriesFor, SECTOR_TITLE_TERMS, type Country, type RegionId } from "./regions";
import type { FinderPrefs, FinderSource, FoundJob } from "./types";

type Raw = Omit<FoundJob, "fit" | "status" | "foundAt">;
type Item = Record<string, unknown>;

/** Run the daily paid scrape only if the last one is older than this. */
export const APIFY_EVERY_MS = 20 * 3600_000;
/** Jobs requested per source per daily run, split across countries (~$0.36/1k LinkedIn, ~$0.09/1k Indeed). */
export const APIFY_TOTAL = 400;
const PER_COUNTRY = { min: 15, max: 150 };
const PRICE = { linkedin: 0.00036, indeed: 0.00009, start: 0.0009 };

export function perCountryLimit(countries: number) {
  return Math.max(PER_COUNTRY.min, Math.min(PER_COUNTRY.max, Math.floor(APIFY_TOTAL / Math.max(1, countries))));
}

/** Rough worst-case $ per daily scrape for these regions (shown in the UI). */
export function apifyDailyCost(regions: RegionId[]) {
  const cs = countriesFor(regions);
  const lim = perCountryLimit(cs.length);
  const indeed = cs.filter((c) => c.indeed).length;
  return cs.length * (lim * PRICE.linkedin + PRICE.start) + indeed * (lim * PRICE.indeed + PRICE.start);
}

const ACTORS: Record<"linkedin" | "indeed", string> = {
  linkedin: "valig~linkedin-jobs-scraper",
  indeed: "valig~indeed-jobs-scraper",
};

/** First non-empty string found at any of these paths (dot paths allowed). */
export function pick(it: Item, ...paths: string[]): string {
  for (const p of paths) {
    let v: unknown = it;
    for (const k of p.split(".")) v = v && typeof v === "object" ? (v as Item)[k] : undefined;
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

export function mapApifyItem(it: Item, source: Extract<FinderSource, "linkedin" | "indeed">, where?: { country: string; region: RegionId }): Raw | null {
  const title = pick(it, "title", "jobTitle", "positionName", "name");
  const url = pick(it, "url", "jobUrl", "link", "applyUrl", "applyLink", "jobLink", "externalApplyLink");
  if (!title || !/^https?:\/\//.test(url)) return null;
  const location = pick(it, "location", "formattedLocation", "location.formatted.long", "location.city", "jobLocation", "place") || where?.country || "";
  const html = pick(it, "descriptionHtml", "description.html", "descriptionHTML");
  const text = pick(it, "descriptionText", "description.text", "description", "jobDescription", "snippet");
  const description = (text || htmlToText(html)).slice(0, 5000);
  const salary = pick(it, "salary", "salaryText", "salary.salaryText", "baseSalary.text");
  const posted = pick(it, "postedAt", "postedDate", "datePosted", "datePublished", "publishedAt", "listedAt", "date");
  const postedAt = posted && !Number.isNaN(new Date(posted).getTime()) ? new Date(posted).toISOString() : new Date().toISOString();
  const id = pick(it, "id", "jobId", "jobKey", "key") || url;
  return {
    id: `${source}:${id}`,
    source,
    title: htmlToText(title),
    company: pick(it, "companyName", "company", "company.name", "employer.name", "employerName", "hiringOrganization.name"),
    location,
    remote: isRemote(false, title, location, pick(it, "workplaceType", "workType", "remote"), description.slice(0, 1500)),
    url,
    description,
    postedAt,
    salary,
    region: where?.region,
  };
}

/** One query string for the boards' boolean search: "supply chain" OR logistics OR … */
export function apifyQuery(prefs: FinderPrefs) {
  const kws = prefs.keywords.split(/[,;\n]/).map((k) => k.trim()).filter(Boolean).slice(0, 8);
  return kws.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" OR ");
}

async function runActor(token: string, actor: string, input: object): Promise<Item[]> {
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?clean=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) throw new Error(`Apify ${actor.split("~")[1]} returned ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? (body as Item[]) : [];
}

/** Runs `fn` over `xs` with at most `n` in flight; failures are collected, not thrown. */
async function pool<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<{ ok: R[]; failed: string[] }> {
  const ok: R[] = [];
  const failed: string[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, xs.length) }, async () => {
      while (i < xs.length) {
        const x = xs[i++];
        try {
          ok.push(await fn(x));
        } catch (e) {
          failed.push((e as Error).message);
        }
      }
    }),
  );
  return { ok, failed };
}

type Where = Country & { region: RegionId };

async function scrape(source: "linkedin" | "indeed", prefs: FinderPrefs, token: string, countries: Where[]): Promise<Raw[]> {
  const limit = perCountryLimit(countries.length);
  const query = apifyQuery(prefs);
  const { ok, failed } = await pool(countries, 4, async (c) => {
    const input =
      source === "linkedin"
        ? { keywords: query, location: c.name, datePosted: "r604800", limit, titleInclude: SECTOR_TITLE_TERMS }
        : { country: c.indeed, title: query, location: prefs.remoteOnly ? "remote" : "", datePosted: "7", limit };
    const items = await runActor(token, ACTORS[source], input);
    return items.map((i) => mapApifyItem(i, source, { country: c.name, region: c.region })).filter((x): x is Raw => !!x);
  });
  if (!ok.length && failed.length) throw new Error(failed[0]);
  return ok.flat();
}

export function apifyLinkedIn(prefs: FinderPrefs, token: string) {
  return scrape("linkedin", prefs, token, countriesFor(prefs.regions));
}

export function apifyIndeed(prefs: FinderPrefs, token: string) {
  return scrape("indeed", prefs, token, countriesFor(prefs.regions).filter((c) => c.indeed));
}
