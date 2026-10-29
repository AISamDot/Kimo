import { describe, expect, it } from "vitest";
import { germanRequirement, htmlToText, isRemote, localFit, outsideGermany, remoteFromGermany, seniorityOf } from "@/lib/jobfit";
import { DEFAULT_PROFILE } from "@/lib/store";
import type { ResumeParsed } from "@/lib/types";

const cv: ResumeParsed = {
  name: "K",
  headline: "Supply chain graduate",
  summary: "",
  experience: [{ title: "Demand Planning Intern", company: "X", location: "Hamburg", start: "", end: "", bullets: [] }],
  education: [],
  skills: ["Demand planning", "Inventory management"],
  tools: ["SAP MM", "Excel", "Power BI"],
  languages: [],
  certifications: [],
  workPermit: "",
  documentLanguage: "en",
};
const profile = { ...DEFAULT_PROFILE, germanLevel: "B1", targetCities: "Hamburg, Berlin" };

describe("germanRequirement", () => {
  it("reads explicit CEFR levels in German and English ads", () => {
    expect(germanRequirement("Sehr gute Deutschkenntnisse (mindestens C1) erforderlich")).toBe("C1");
    expect(germanRequirement("German skills at B2 level are required")).toBe("B2");
  });
  it("maps common wording to a level", () => {
    expect(germanRequirement("Verhandlungssichere Deutsch- und Englischkenntnisse")).toBe("C1");
    expect(germanRequirement("German is a plus but not required")).toBe("A2");
  });
  it("treats a long ad written in German as needing B2", () => {
    const de = "Wir suchen für unser Team in Hamburg eine engagierte Person, die mit uns die Lieferkette gestaltet und für die Disposition der Ware verantwortlich ist. ".repeat(6);
    expect(germanRequirement(de)).toBe("B2");
  });
  it("returns unknown for an English ad without a language line", () => {
    expect(germanRequirement("We are looking for a logistics analyst to join our team in Berlin. ".repeat(10))).toBe("unknown");
  });
});

describe("seniorityOf", () => {
  it("classifies titles", () => {
    expect(seniorityOf("Junior Supply Chain Planner (m/w/d)", "")).toBe("entry");
    expect(seniorityOf("Werkstudent Einkauf", "")).toBe("entry");
    expect(seniorityOf("Senior Procurement Manager", "")).toBe("senior");
    expect(seniorityOf("Supply Chain Analyst", "You have 5+ years of experience")).toBe("senior");
    expect(seniorityOf("Supply Chain Analyst", "Great team")).toBe("mid");
    expect(seniorityOf("Supply Chain Analyst", "Join our international team and internal projects")).toBe("mid");
    expect(seniorityOf("Praktikum Logistik", "")).toBe("entry");
  });
});

describe("localFit", () => {
  it("ranks a matching junior planning job in his city above a senior German-heavy one", () => {
    const good = localFit({ title: "Junior Demand Planner", description: "Demand planning in SAP MM and Excel, inventory KPIs. English team, German is a plus.", location: "Hamburg", remote: false }, cv, profile);
    const bad = localFit({ title: "Senior Head of Procurement", description: "Verhandlungssichere Deutschkenntnisse. Mehrjährige Führungserfahrung.", location: "München", remote: false }, cv, profile);
    expect(good.score).toBeGreaterThan(70);
    expect(bad.score).toBeLessThan(good.score - 30);
    expect(good.matched).toEqual(expect.arrayContaining(["sap mm", "excel"]));
    expect(bad.flags.join(" ")).toMatch(/Senior/);
    expect(bad.germanGap).toBe(2);
  });
  it("does not treat a tools-only title as a supply-chain role", () => {
    const f = localFit({ title: "Freelance Trainer SAP EWM", description: "Teach SAP courses", location: "Berlin", remote: true }, cv, profile);
    expect(f.reasons).not.toContain("Supply-chain role by title");
  });
  it("flags non supply-chain roles", () => {
    const f = localFit({ title: "Frontend Developer", description: "React and TypeScript", location: "Berlin", remote: true }, cv, profile);
    expect(f.flags).toContain("Not clearly a supply-chain role");
    expect(f.domain).toBe(0);
  });
  it("works without a CV", () => {
    const f = localFit({ title: "Logistics Coordinator", description: "", location: "", remote: true }, null, DEFAULT_PROFILE);
    expect(f.score).toBeGreaterThan(0);
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToText("<p>A &amp; B</p><ul><li>one</li><li>two</li></ul><script>x()</script>")).toBe("A & B\none\ntwo");
  });
});

describe("outsideGermany", () => {
  it("spots foreign locations", () => {
    expect(outsideGermany("De Lier, Zuid-Holland, Netherlands")).toBe(true);
    expect(outsideGermany("Amsterdam")).toBe(true);
    expect(outsideGermany("Gilching, Bayern, Germany")).toBe(false);
    expect(outsideGermany("Hamburg")).toBe(false);
  });
});

describe("isRemote", () => {
  it("detects remote wording in English and German", () => {
    expect(isRemote(false, "Supply Chain Analyst (Remote)")).toBe(true);
    expect(isRemote(false, "Disponent (m/w/d) – 100% Homeoffice möglich")).toBe(true);
    expect(isRemote(false, "Einkäufer", "Mobiles Arbeiten an 3 Tagen")).toBe(true);
    expect(isRemote(true, "Planner")).toBe(true);
    expect(isRemote(false, "Lagerleiter Hamburg", "Vor Ort im Lager")).toBe(false);
  });
});

describe("remoteFromGermany", () => {
  it("keeps remote roles open to Germany/EU and drops ones locked to another country", () => {
    expect(remoteFromGermany("Remote job")).toBe(true);
    expect(remoteFromGermany("Remote, Germany")).toBe(true);
    expect(remoteFromGermany("Remote (EU)")).toBe(true);
    expect(remoteFromGermany("Remote - UK")).toBe(false);
    expect(remoteFromGermany("Amsterdam, Netherlands")).toBe(false);
  });
});
