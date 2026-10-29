import { describe, expect, it } from "vitest";
import {
  addDays,
  attemptKey,
  attemptTrend,
  daysUntil,
  duePhrases,
  guessCompetency,
  guessLang,
  mergePhrases,
  nextInterview,
  reviewPhrase,
  storyCoverage,
  storyStrength,
  todayPlan,
} from "@/lib/practice";
import type { AnswerAttempt, Application, Phrase, Story, UserDb } from "@/lib/types";

const phrase = (over: Partial<Phrase> = {}): Phrase => ({ id: "p", de: "Ich habe die Bestellung angepasst.", en: "", note: "", source: "manual", box: 0, due: "2026-10-29", reviews: 0, lapses: 0, createdAt: "", ...over });

describe("spaced repetition", () => {
  it("moves through Leitner boxes", () => {
    const d = "2026-10-29";
    let p = reviewPhrase(phrase(), "good", d);
    expect(p.box).toBe(1);
    expect(p.due).toBe("2026-10-30");
    p = reviewPhrase(p, "easy", d);
    expect(p.box).toBe(3);
    expect(p.due).toBe(addDays(d, 4));
    p = reviewPhrase(p, "again", d);
    expect(p).toMatchObject({ box: 0, due: d, lapses: 1, reviews: 3 });
  });
  it("hard keeps at least box 1 and waits at least a day", () => {
    const p = reviewPhrase(phrase({ box: 4 }), "hard", "2026-10-29");
    expect(p.box).toBe(4);
    expect(p.due).toBe("2026-11-02"); // half of the 7-day box interval, rounded
  });
  it("never goes past the last box", () => {
    expect(reviewPhrase(phrase({ box: 6 }), "easy", "2026-10-29").box).toBe(6);
  });
  it("lists due phrases, lowest box first", () => {
    const list = [phrase({ id: "a", box: 2, due: "2026-10-28" }), phrase({ id: "b", box: 0, due: "2026-10-29" }), phrase({ id: "c", box: 0, due: "2026-11-02" })];
    expect(duePhrases(list, "2026-10-29").map((p) => p.id)).toEqual(["b", "a"]);
  });
  it("dedupes phrases ignoring case and punctuation", () => {
    const deck = [phrase()];
    const n = mergePhrases(deck, [{ id: "x", de: "ich habe die Bestellung angepasst", en: "", note: "", source: "session", createdAt: "" }, { id: "y", de: "Neu hier", en: "", note: "", source: "session", createdAt: "" }], "2026-10-29");
    expect(n).toBe(1);
    expect(deck).toHaveLength(2);
    expect(deck[1]).toMatchObject({ box: 0, due: "2026-10-29" });
  });
});

const story = (over: Partial<Story> = {}): Story => ({ id: "s", title: "t", situation: "s", task: "t", action: "I re-planned fourteen SKUs, called the second supplier, negotiated an expedited slot and updated the MRP parameters myself", result: "OTIF stayed at 96%", metrics: "", competencies: ["problem_solving"], answersQuestions: [], source: "manual", createdAt: "", updatedAt: "", ...over });

describe("stories", () => {
  it("rates strength by action detail and numbers", () => {
    expect(storyStrength(story())).toBe("strong");
    expect(storyStrength(story({ result: "it went well" }))).toBe("ok");
    expect(storyStrength(story({ action: "fixed it", result: "" }))).toBe("weak");
  });
  it("counts coverage and gaps, excluding hygiene/closing", () => {
    const { count, gaps } = storyCoverage([story(), story({ competencies: ["problem_solving", "stakeholder_management"] })]);
    expect(count.problem_solving).toBe(2);
    expect(gaps).not.toContain("problem_solving");
    expect(gaps).toContain("procurement_supplier");
    expect(gaps).not.toContain("hygiene");
  });
});

describe("attempts", () => {
  it("gives the same key regardless of case and punctuation", () => {
    expect(attemptKey("Tell me about yourself!")).toBe(attemptKey("tell me about yourself"));
    expect(attemptKey("Why us?")).not.toBe(attemptKey("Why Germany?"));
  });
  it("computes trend", () => {
    const k = attemptKey("q");
    const a = (content: number, createdAt: string) => ({ key: k, content, createdAt }) as AnswerAttempt;
    expect(attemptTrend([a(50, "1"), a(72, "3"), a(65, "2")], k)).toEqual({ count: 3, first: 50, last: 72, best: 72, delta: 22 });
    expect(attemptTrend([], k).count).toBe(0);
  });
});

describe("question helpers", () => {
  it("guesses competency and language", () => {
    expect(guessCompetency("What is your salary expectation?")).toBe("hygiene");
    expect(guessCompetency("How would you reduce safety stock?")).toBe("supply_chain_planning");
    expect(guessCompetency("Tell me about a conflict with a colleague")).toBe("stakeholder_management");
    expect(guessLang("Warum möchten Sie bei uns arbeiten?")).toBe("de");
    expect(guessLang("Why do you want to work here?")).toBe("en");
  });
});

const app = (over: Partial<Application>): Application => ({ id: "a", company: "DHL", role: "Planner", date: "2026-10-01", resumeId: "", jobId: "job_1", stage: "screen", outcome: "active", interviewLanguage: "", roleType: "", companySize: "", feedback: "", notes: "", ...over });
const emptyDb = (): Pick<UserDb, "applications" | "jobs" | "phrases" | "drills" | "stories" | "attempts" | "sessions"> => ({ applications: [], jobs: [], phrases: [], drills: [], stories: [], attempts: [], sessions: [] });

describe("daily plan", () => {
  it("counts days", () => {
    expect(daysUntil("2026-11-02", "2026-10-29")).toBe(4);
  });
  it("picks the soonest upcoming active interview", () => {
    const db = { applications: [app({ id: "1", nextInterviewDate: "2026-11-10" }), app({ id: "2", nextInterviewDate: "2026-11-01" }), app({ id: "3", nextInterviewDate: "2026-10-20" }), app({ id: "4", nextInterviewDate: "2026-10-30", outcome: "rejected" })] };
    expect(nextInterview(db, "2026-10-29")?.id).toBe("2");
  });
  it("builds a plan around the next interview", () => {
    const db = emptyDb();
    db.applications = [app({ nextInterviewDate: "2026-10-31" })];
    db.jobs = [{ id: "job_1" } as UserDb["jobs"][number]];
    db.phrases = [phrase()];
    const plan = todayPlan(db, "2026-10-29");
    expect(plan.map((p) => p.id)).toEqual(["prep", "mock", "german", "redo", "stories"]);
    expect(plan[1].detail).toBe("2 days to go");
    expect(plan.find((p) => p.id === "german")?.done).toBe(false);
  });
  it("is empty for a brand-new user", () => {
    expect(todayPlan(emptyDb(), "2026-10-29").map((p) => p.id)).toEqual(["stories"]);
  });
});
