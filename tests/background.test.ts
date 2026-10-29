import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { apifyDailyCost, apifyQuery, mapApifyItem, perCountryLimit } from "@/lib/apify";
import { generalJob } from "@/lib/companies";
import { countriesFor } from "@/lib/regions";
import type { FinderPrefs, FoundJob, Task } from "@/lib/types";

process.env.BUDDY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-bg-"));
delete process.env.DATABASE_URL;

const prefs = (over: Partial<FinderPrefs> = {}): FinderPrefs => ({
  keywords: "supply chain, logistics",
  cities: "",
  includeRemote: true,
  remoteOnly: false,
  entryLevelOnly: true,
  minScore: 40,
  regions: ["germany"],
  ...over,
});

describe("tasks", () => {
  const t = (over: Partial<Task>): Task => ({ id: "t", key: "k", kind: "x", label: "L", status: "running", href: "/", createdAt: new Date().toISOString(), ...over });
  it("times out stuck tasks and hides old or dismissed ones", async () => {
    const { sweepStale, visibleTasks } = await import("@/lib/tasks");
    const now = Date.now();
    const old = new Date(now - 10 * 60_000).toISOString();
    expect(sweepStale([t({ createdAt: old })], now)[0].status).toBe("failed");
    const shown = visibleTasks(
      [
        t({ id: "a" }),
        t({ id: "b", status: "done", finishedAt: new Date(now - 60_000).toISOString() }),
        t({ id: "c", status: "done", finishedAt: new Date(now - 60 * 60_000).toISOString() }),
        t({ id: "d", status: "failed", dismissed: true, finishedAt: new Date(now).toISOString() }),
      ],
      now,
    );
    expect(shown.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });
});

describe("adzunaPlan", () => {
  it("uses every keyword and stays within the call budget", async () => {
    const { adzunaPlan, ADZUNA_CALL_BUDGET } = await import("@/lib/finder");
    const kws = "a, b, c, d, e, f, g, h";
    const plan = adzunaPlan(prefs({ keywords: kws }));
    expect(new Set(plan.map((c) => c.what)).size).toBe(8);
    expect(plan.length).toBeLessThanOrEqual(ADZUNA_CALL_BUDGET);
    // Too many keyword × city combos: falls back to all of Germany.
    const wide = adzunaPlan(prefs({ keywords: kws, cities: "Hamburg, Berlin, Munich" }));
    expect(wide.every((c) => c.where === "")).toBe(true);
    // Few keywords: extra pages.
    expect(Math.max(...adzunaPlan(prefs({ keywords: "a" })).map((c) => c.page))).toBe(3);
  });
});

describe("region filters", () => {
  const job = (over: Partial<FoundJob>) => ({
    id: "x", source: "linkedin" as const, title: "Supply Chain Analyst", company: "Co", location: "Dubai", remote: false, url: "https://x", description: "", postedAt: "", salary: "",
    fit: { score: 70, domain: 0, skills: 0, seniority: "entry" as const, german: "none" as const, matched: [], reasons: [], flags: [] },
    ...over,
  });
  it("keeps abroad jobs only for chosen regions", async () => {
    const { passesFilters } = await import("@/lib/finder");
    expect(passesFilters(job({ region: "gcc" }) as never, prefs({ regions: ["germany", "gcc"] }))).toBe(true);
    expect(passesFilters(job({ region: "gcc" }) as never, prefs({ regions: ["germany"] }))).toBe(false);
    expect(passesFilters(job({ location: "Hamburg", source: "arbeitnow" as never }) as never, prefs({ regions: ["gcc"] }))).toBe(false);
    expect(passesFilters(job({ location: "Hamburg", source: "arbeitnow" as never }) as never, prefs())).toBe(true);
  });
});

describe("apify", () => {
  it("maps varied item shapes and drops unusable ones", () => {
    const a = mapApifyItem({ title: "Logistics Planner", companyName: "Aramex", location: "Dubai, UAE", url: "https://li/1", id: 1, descriptionText: "Plan routes" }, "linkedin", { country: "United Arab Emirates", region: "gcc" });
    expect(a).toMatchObject({ id: "linkedin:1", company: "Aramex", region: "gcc", description: "Plan routes" });
    const b = mapApifyItem({ jobTitle: "Buyer", employer: { name: "Siemens" }, jobUrl: "https://in/2", description: { html: "<p>Buy things</p>" } }, "indeed", { country: "Germany", region: "germany" });
    expect(b).toMatchObject({ company: "Siemens", location: "Germany" });
    expect(mapApifyItem({ title: "No link" }, "linkedin")).toBeNull();
  });
  it("builds a boolean query and bounded per-country limits", () => {
    expect(apifyQuery(prefs())).toBe('"supply chain" OR logistics');
    expect(perCountryLimit(1)).toBe(150);
    expect(perCountryLimit(31)).toBe(15);
    const all = countriesFor(["germany", "europe", "gcc", "asia", "africa"]);
    expect(all.length).toBeGreaterThan(25);
    expect(apifyDailyCost(["germany", "europe", "gcc", "asia", "africa"])).toBeLessThan(0.5);
  });
});

describe("general company interviews", () => {
  it("builds a job-shaped track", () => {
    const j = generalJob("dhl", "planner", "job_1")!;
    expect(j.general).toEqual({ companyId: "dhl", roleId: "planner" });
    expect(j.parsed.company).toBe("DHL Group");
    expect(j.parsed.competencies.length).toBeGreaterThan(3);
    expect(generalJob("nope", "planner", "x")).toBeNull();
    expect(generalJob("any", "analyst", "job_2")?.general?.companyId).toBe("any");
  });
});
