import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FoundJob } from "@/lib/types";

process.env.BUDDY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-finder-"));
delete process.env.DATABASE_URL;

const ad = (slug: string, title: string, description: string, location = "Hamburg") => ({
  slug,
  company_name: `Co ${slug}`,
  title,
  description: `<p>${description}</p>`,
  remote: false,
  url: `https://example.com/${slug}`,
  tags: [],
  location,
  created_at: Math.floor(Date.now() / 1000) - 3600,
});

describe("runFinder", () => {
  let finder: typeof import("@/lib/finder");
  let store: typeof import("@/lib/store");
  beforeAll(async () => {
    finder = await import("@/lib/finder");
    store = await import("@/lib/store");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("filters, scores and keeps his saved/dismissed choices", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            ad("a", "Junior Supply Chain Planner", "Demand planning with SAP and Excel. English speaking team."),
            ad("b", "Senior Head of Logistics", "Mehrjährige Führungserfahrung, verhandlungssicheres Deutsch."),
            ad("c", "Frontend Developer", "React"),
            ad("d", "Logistics Analyst", "Logistics KPIs, transport, warehouse data in Power BI.", "Berlin"),
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const prefs = { ...store.DEFAULT_FINDER_PREFS, keywords: "supply chain, logistics", minScore: 30 };
    const profile = { ...store.DEFAULT_PROFILE, germanLevel: "B1" };
    const dismissed: FoundJob = {
      id: "arbeitnow:d",
      source: "arbeitnow",
      title: "Logistics Analyst",
      company: "Co d",
      location: "Berlin",
      remote: false,
      url: "",
      description: "",
      postedAt: new Date().toISOString(),
      salary: "",
      fit: { score: 50, domain: 0, skills: 0, seniority: "mid", germanNeeded: "unknown", germanGap: 0, matched: [], reasons: [], flags: [] },
      status: "dismissed",
      foundAt: new Date().toISOString(),
    };
    const { results, note } = await finder.runFinder({ prefs, existing: [dismissed], resume: null, profile });
    const ids = results.map((r) => r.id);
    expect(ids).toContain("arbeitnow:a");
    expect(ids).not.toContain("arbeitnow:b"); // senior roles hidden
    expect(ids).not.toContain("arbeitnow:c"); // no keyword match
    expect(results.find((r) => r.id === "arbeitnow:d")?.status).toBe("dismissed");
    expect(results.find((r) => r.id === "arbeitnow:a")?.description).toContain("Demand planning");
    expect(note).toMatch(/^1 new match/);
    expect(note).toMatch(/Adzuna/);
  });

  it("keeps remote jobs abroad, drops on-site jobs abroad, and supports remote-only", async () => {
    const rows = [
      { ...ad("r1", "Supply Chain Analyst", "Fully remote role, supply chain KPIs", "Remote, Europe (HQ Amsterdam, Netherlands)"), remote: true },
      { ...ad("r5", "Logistics Analyst (Remote in UK)", "Supply chain logistics, remote", "Remote - UK"), remote: true },
      ad("r2", "Logistics Coordinator", "On-site logistics in the warehouse", "Rotterdam, Netherlands"),
      ad("r3", "Junior Logistics Planner", "Logistics planning, Homeoffice möglich", "Hamburg"),
      ad("r4", "Junior Procurement Specialist", "Procurement on site", "Berlin"),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: rows }))));
    const base = { ...store.DEFAULT_FINDER_PREFS, keywords: "supply chain, logistics, procurement", minScore: 0 };
    const all = await finder.runFinder({ prefs: base, existing: [], resume: null, profile: store.DEFAULT_PROFILE });
    expect(all.results.map((r) => r.id).sort()).toEqual(["arbeitnow:r1", "arbeitnow:r3", "arbeitnow:r4"]);
    expect(all.results.find((r) => r.id === "arbeitnow:r3")?.remote).toBe(true);
    const remoteOnly = await finder.runFinder({ prefs: { ...base, remoteOnly: true }, existing: [], resume: null, profile: store.DEFAULT_PROFILE });
    expect(remoteOnly.results.map((r) => r.id).sort()).toEqual(["arbeitnow:r1", "arbeitnow:r3"]);
  });

  it("reports a failing source without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const { results, note } = await finder.runFinder({ prefs: store.DEFAULT_FINDER_PREFS, existing: [], resume: null, profile: store.DEFAULT_PROFILE });
    expect(results).toEqual([]);
    expect(note).toMatch(/arbeitnow failed: Arbeitnow returned 503/);
  });
});
