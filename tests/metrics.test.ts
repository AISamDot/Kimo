import { describe, expect, it } from "vitest";
import {
  answerContentScore,
  biggestDropOff,
  cefrGap,
  computeDelivery,
  contentScore,
  countFillers,
  drillPassed,
  funnel,
  lowerIsBetter,
  overallScore,
  presenceScore,
  rangeScore,
  readiness,
  wordCount,
} from "@/lib/metrics";
import type { AnswerScore, Application, SessionSummary, Turn } from "@/lib/types";

const answer = (o: Partial<AnswerScore> = {}): AnswerScore => ({
  questionNo: 1,
  question: "q",
  competency: "problem_solving",
  answerSummary: "",
  relevance: 3,
  structure: 3,
  specificity: 3,
  ownership: 3,
  domainDepth: 3,
  concision: 3,
  correctness: null,
  costlyQuote: "",
  whatWasMissing: "",
  modelAnswer: "",
  ...o,
});

const session = (o: Partial<SessionSummary>): SessionSummary => ({
  id: "ses_1",
  jobId: "job_1",
  resumeId: "cv_1",
  type: "hr",
  language: "en",
  difficulty: "realistic",
  lengthMin: 20,
  createdAt: "2026-10-01T10:00:00Z",
  status: "done",
  rubricVersion: "v1",
  ...o,
});

describe("fillers and words", () => {
  it("counts English vocal and verbal fillers", () => {
    const r = countFillers("Um, so I, uh, basically you know handled it. Hmm.", "en");
    expect(r.counts.um).toBe(1);
    expect(r.counts.uh).toBe(1);
    expect(r.counts.basically).toBe(1);
    expect(r.counts["you know"]).toBe(1);
    expect(r.total).toBe(5);
  });
  it("counts German fillers without matching inside words", () => {
    const r = countFillers("Ähm, also ich habe äh sozusagen die Lieferanten gehalten. Hm.", "de");
    expect(r.counts["ähm"]).toBe(1);
    expect(r.counts["äh"]).toBe(1);
    expect(r.counts.sozusagen).toBe(1);
    expect(r.counts.hm).toBe(1);
    expect(r.counts.halt).toBeUndefined(); // "gehalten" must not count
  });
  it("counts words including umlauts", () => {
    expect(wordCount("Ich würde die Bestände prüfen.")).toBe(5);
    expect(wordCount("")).toBe(0);
  });
});

describe("range helpers", () => {
  it("rangeScore is 100 inside and falls off linearly", () => {
    expect(rangeScore(140, 120, 160, 60)).toBe(100);
    expect(rangeScore(90, 120, 160, 60)).toBe(50);
    expect(rangeScore(0, 120, 160, 60)).toBe(0);
  });
  it("lowerIsBetter", () => {
    expect(lowerIsBetter(2, 3, 12)).toBe(100);
    expect(lowerIsBetter(7.5, 3, 12)).toBe(50);
    expect(lowerIsBetter(20, 3, 12)).toBe(0);
  });
});

describe("delivery", () => {
  it("computes pace, fillers and talk ratio from turns", () => {
    const words = Array.from({ length: 140 }, () => "word").join(" ");
    const turns: Turn[] = [
      { idx: 0, speaker: "interviewer", text: "Tell me about a supplier conflict.", lang: "en", atMs: 0, durationMs: 30000, kind: "question", questionNo: 1, competency: "stakeholder_management" },
      {
        idx: 1,
        speaker: "candidate",
        text: `um ${words}`,
        lang: "en",
        atMs: 30000,
        durationMs: 60000,
        acoustic: { durationSec: 60, speechSec: 60, longPauses: 0, longestPauseSec: 1, meanDb: -25, dbSd: 4, pitchMedianHz: 120, pitchSdSemitones: 3, endDropDb: -1, voicedRatio: 0.8 },
      },
    ];
    const d = computeDelivery(turns);
    expect(d.wpm).toBe(141);
    expect(d.fillersPerMin).toBe(1);
    expect(d.talkRatio).toBe(67);
    expect(d.answerLengthOkPct).toBe(100);
    expect(d.subScores.pace).toBe(100);
    expect(d.score).toBe(100);
  });
  it("returns 0 when there are no answers", () => {
    expect(computeDelivery([]).score).toBe(0);
  });
});

describe("content scoring", () => {
  it("maps all-3 answers to 50 and all-5 to 100", () => {
    expect(contentScore([answer()])).toBe(50);
    expect(contentScore([answer({ relevance: 5, structure: 5, specificity: 5, ownership: 5, domainDepth: 5, concision: 5 })])).toBe(100);
  });
  it("includes correctness when present", () => {
    expect(answerContentScore(answer({ correctness: 5 }))).toBeGreaterThan(answerContentScore(answer()));
  });
});

describe("overall + language", () => {
  it("renormalises weights when presence is missing", () => {
    const w = { content: 45, delivery: 20, language: 20, presence: 15 };
    expect(overallScore({ content: 80, delivery: 80, language: 80, presence: null }, w)).toBe(80);
    expect(overallScore({ content: 100, delivery: 0, language: null, presence: null }, w)).toBe(69);
  });
  it("CEFR gap", () => {
    expect(cefrGap("B2", "B2")).toBe("meets");
    expect(cefrGap("B1", "B2")).toBe("one_level");
    expect(cefrGap("A2", "C1")).toBe("two_plus");
    expect(cefrGap("B1", "not stated")).toBe("unknown");
  });
});

describe("presence", () => {
  it("flags low eye contact", () => {
    const p = presenceScore({ frames: 300, facePresentPct: 100, gazeAtCameraPct: 30, smilePct: 20, headMotion: 0.005, brightness: 120, centeredPct: 95 });
    expect(p.notes.some((n) => n.includes("camera"))).toBe(true);
    expect(p.score).toBeLessThan(80);
  });
});

describe("readiness and drills", () => {
  const s = (overall: number, i: number, comp: number) =>
    session({ id: `ses_${i}`, overall, createdAt: `2026-10-0${i}T10:00:00Z`, areaScores: { content: overall, delivery: overall, language: overall, presence: null }, competencyScores: { motivation_fit: comp } });
  it("needs 3 sessions", () => {
    expect(readiness([s(90, 1, 4)], { threshold: 75, floor: 60 }).ready).toBe(false);
  });
  it("ready when last 3 average above threshold", () => {
    expect(readiness([s(40, 1, 2), s(80, 2, 4), s(78, 3, 4), s(82, 4, 4)], { threshold: 75, floor: 60 }).ready).toBe(true);
  });
  it("drill passes after two consecutive >= 4", () => {
    expect(drillPassed("motivation_fit", [s(50, 1, 2), s(70, 2, 4)])).toBe(false);
    expect(drillPassed("motivation_fit", [s(50, 1, 2), s(70, 2, 4), s(75, 3, 4.5)])).toBe(true);
  });
});

describe("funnel", () => {
  const app = (stage: Application["stage"], outcome: Application["outcome"] = "rejected"): Application => ({
    id: "a",
    company: "c",
    role: "r",
    date: "2026-01-01",
    resumeId: "",
    jobId: "",
    stage,
    outcome,
    interviewLanguage: "",
    roleType: "",
    companySize: "",
    feedback: "",
    notes: "",
  });
  it("counts reach per stage and finds the biggest drop", () => {
    const apps = [app("applied"), app("applied"), app("screen"), app("interview1"), app("interview1"), app("interview1"), app("interview2")];
    const rows = funnel(apps);
    expect(rows.map((r) => r.reached)).toEqual([7, 5, 4, 1, 0, 0]);
    const drop = biggestDropOff(rows);
    expect(drop).toEqual({ from: "interview1", to: "interview2", conversion: 25 });
  });
});
