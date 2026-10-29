import { describe, expect, it } from "vitest";
import { monthIndex, runCvChecks } from "../src/lib/cvchecks";
import type { Resume } from "../src/lib/types";

const base = (over: Partial<Resume["parsed"]> = {}, text = ""): Resume => ({
  id: "cv1",
  version: 1,
  label: "CV v1",
  fileName: "cv.pdf",
  createdAt: "2026-10-01",
  text,
  parsed: {
    name: "Karim",
    headline: "",
    summary: "",
    experience: [],
    education: [],
    skills: [],
    tools: [],
    languages: [],
    certifications: [],
    workPermit: "",
    documentLanguage: "en",
    ...over,
  },
});

const byId = (r: ReturnType<typeof runCvChecks>, id: string) => r.checks.find((c) => c.id === id)!;

describe("monthIndex", () => {
  it("reads common date formats", () => {
    expect(monthIndex("03/2024")).toBe(2024 * 12 + 3);
    expect(monthIndex("2024-03")).toBe(2024 * 12 + 3);
    expect(monthIndex("Mar 2024")).toBe(2024 * 12 + 3);
    expect(monthIndex("März 2024")).toBe(2024 * 12 + 3);
    expect(monthIndex("2024")).toBe(2024 * 12 + 1);
    expect(monthIndex("heute")).toBe(Infinity);
    expect(monthIndex("")).toBeNull();
  });
});

describe("runCvChecks", () => {
  it("flags an empty CV hard", () => {
    const r = runCvChecks(base());
    expect(byId(r, "quantified").status).toBe("fail");
    expect(byId(r, "permit").status).toBe("fail");
    expect(byId(r, "summary").status).toBe("fail");
    expect(r.score).toBeLessThan(40);
  });

  it("passes a strong CV", () => {
    const text =
      "Karim · karim@example.com · +49 151 2345 6789 · linkedin.com/in/karim\n" +
      "Supply-chain analyst with SAP MM and Power BI. ".repeat(20);
    const r = runCvChecks(
      base(
        {
          summary: "Supply-chain analyst with an MSc in Logistics and two years in procurement at a 3PL. Cut supplier lead times by 18% with SAP MM data. Looking for a demand-planning role in Hamburg or Berlin.",
          experience: [
            { title: "Working student, Procurement", company: "DHL", location: "Bonn", start: "04/2025", end: "present", bullets: ["Reduced supplier lead time by 18% using SAP MM data", "Negotiated 12 contracts worth €1.2M", "Built a Power BI dashboard used by 30 buyers"] },
            { title: "Analyst", company: "Agility", location: "Cairo", start: "01/2022", end: "03/2025", bullets: ["Forecasted demand for 400 SKUs with 92% accuracy", "Cut stock-outs by 25% via a Python reorder model"] },
          ],
          skills: ["SAP MM", "Python", "Power BI"],
          languages: [{ language: "German", level: "B2" }, { language: "English", level: "C1" }],
          workPermit: "Allowed to work full-time in Germany",
        },
        text,
      ),
    );
    for (const id of ["quantified", "openers", "pronouns", "summary", "cefr", "permit", "dates", "gaps", "contact", "evidence", "tools"]) {
      expect(byId(r, id).status, id).toBe("pass");
    }
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it("catches duty language, pronouns, mixed dates and gaps", () => {
    const r = runCvChecks(
      base({
        summary: "I am a team player.",
        experience: [
          { title: "Intern", company: "A", location: "", start: "2023", end: "Dec 2023", bullets: ["Responsible for supplier onboarding", "I helped the team with reports"] },
          { title: "Clerk", company: "B", location: "", start: "01/2020", end: "06/2021", bullets: ["Worked on invoices"] },
        ],
        languages: [{ language: "German", level: "good" }],
      }),
    );
    expect(byId(r, "openers").status).toBe("fail");
    expect(byId(r, "pronouns").status).toBe("warn");
    expect(byId(r, "dates").status).not.toBe("pass");
    expect(byId(r, "gaps").status).toBe("warn");
    expect(byId(r, "cefr").status).toBe("warn");
  });
});
