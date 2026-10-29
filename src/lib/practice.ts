// Pure helpers for the practice features: spaced repetition, story coverage,
// answer-attempt keys and the daily plan. Unit-tested; no I/O.
import { COMPETENCIES, type AnswerAttempt, type Competency, type Phrase, type Story, type UserDb } from "./types";

// ---------------- Spaced repetition (Leitner boxes) ----------------

export const BOX_DAYS = [0, 1, 2, 4, 7, 15, 30];
export type Grade = "again" | "hard" | "good" | "easy";

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function reviewPhrase(p: Phrase, grade: Grade, day: string): Phrase {
  const last = BOX_DAYS.length - 1;
  let box = p.box;
  if (grade === "again") box = 0;
  else if (grade === "hard") box = Math.max(1, box);
  else if (grade === "good") box = Math.min(last, box + 1);
  else box = Math.min(last, box + 2);
  const wait = grade === "again" ? 0 : grade === "hard" ? Math.max(1, Math.round(BOX_DAYS[box] / 2)) : BOX_DAYS[box];
  return { ...p, box, due: addDays(day, wait), reviews: p.reviews + 1, lapses: p.lapses + (grade === "again" ? 1 : 0) };
}

export function duePhrases(phrases: Phrase[], day: string) {
  return phrases.filter((p) => p.due <= day).sort((a, b) => a.box - b.box || a.due.localeCompare(b.due));
}

export const normPhrase = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

/** Adds phrases that are not already in the deck (case/punctuation-insensitive). Returns how many were added. */
export function mergePhrases(deck: Phrase[], incoming: Omit<Phrase, "box" | "due" | "reviews" | "lapses">[], day: string): number {
  const have = new Set(deck.map((p) => normPhrase(p.de)));
  let n = 0;
  for (const x of incoming) {
    const k = normPhrase(x.de);
    if (!k || have.has(k)) continue;
    have.add(k);
    deck.push({ ...x, box: 0, due: day, reviews: 0, lapses: 0 });
    n++;
  }
  return n;
}

export function masteredCount(phrases: Phrase[]) {
  return phrases.filter((p) => p.box >= 4).length;
}

// ---------------- Story bank ----------------

/** Competencies that are answered with a real story (not hygiene/closing/language). */
export const STORY_COMPETENCIES = COMPETENCIES.filter((c) => !["hygiene", "closing_questions", "german_language", "cv_walkthrough"].includes(c));

/** Competencies each story covers; gaps = competencies with no story. */
export function storyCoverage(stories: Story[], focus: readonly Competency[] = STORY_COMPETENCIES) {
  const count = Object.fromEntries(focus.map((c) => [c, 0])) as Record<Competency, number>;
  for (const s of stories) for (const c of s.competencies) if (c in count) count[c]++;
  const gaps = focus.filter((c) => count[c] === 0);
  return { count, gaps };
}

/** A story is "interview-ready" when it has an action and a measurable result. */
export function storyStrength(s: Story): "strong" | "ok" | "weak" {
  const hasNumber = /\d/.test(`${s.result} ${s.metrics}`);
  const actionLen = s.action.trim().split(/\s+/).length;
  if (hasNumber && actionLen >= 15 && s.result.trim()) return "strong";
  if (s.result.trim() && actionLen >= 8) return "ok";
  return "weak";
}

// ---------------- Answer attempts ----------------

export function attemptKey(question: string) {
  const n = normPhrase(question).slice(0, 160);
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return `q${h.toString(16)}`;
}

export function attemptTrend(attempts: AnswerAttempt[], key: string) {
  const list = attempts.filter((a) => a.key === key).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const first = list[0]?.content ?? null;
  const last = list.at(-1)?.content ?? null;
  const best = list.length ? Math.max(...list.map((a) => a.content)) : null;
  return { count: list.length, first, last, best, delta: first != null && last != null ? last - first : null };
}

// ---------------- Daily plan ----------------

export interface PlanItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  done: boolean;
}

export function daysUntil(date: string, day: string) {
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${day}T00:00:00Z`).getTime()) / 864e5);
}

export function nextInterview(db: Pick<UserDb, "applications">, day: string) {
  return db.applications
    .filter((a) => a.outcome === "active" && a.nextInterviewDate && a.nextInterviewDate >= day)
    .sort((a, b) => a.nextInterviewDate!.localeCompare(b.nextInterviewDate!))[0];
}

/** What to do today: driven by the next real interview, due phrases, open drills and story gaps. */
export function todayPlan(db: Pick<UserDb, "applications" | "jobs" | "phrases" | "drills" | "stories" | "attempts" | "sessions">, day: string): PlanItem[] {
  const items: PlanItem[] = [];
  const next = nextInterview(db, day);
  if (next) {
    const job = db.jobs.find((j) => j.id === next.jobId);
    const d = daysUntil(next.nextInterviewDate!, day);
    if (job && !job.prepPack) {
      items.push({ id: "prep", label: `Build the prep pack for ${next.company}`, detail: `Interview in ${d} day${d === 1 ? "" : "s"}`, href: `/jobs/${job.id}/prep`, done: false });
    }
    const mockToday = db.sessions.some((s) => s.jobId === next.jobId && s.createdAt.slice(0, 10) === day);
    items.push({
      id: "mock",
      label: d <= 1 ? `Final rehearsal for ${next.company}` : `Mock interview for ${next.company}`,
      detail: d <= 1 ? "Short realistic round, then rest" : `${d} days to go`,
      href: job ? `/interview/new?job=${job.id}` : "/interview/new",
      done: mockToday,
    });
  }
  const due = duePhrases(db.phrases, day).length;
  if (db.phrases.length) {
    items.push({ id: "german", label: due ? `Review ${due} German phrase${due === 1 ? "" : "s"}` : "German phrases done for today", detail: "5 minutes, spaced repetition", href: "/german", done: due === 0 });
  }
  const drillsDoneToday = db.attempts.filter((a) => a.createdAt.slice(0, 10) === day).length;
  const open = db.drills.filter((d) => d.status === "open").length;
  if (open || db.jobs.length) {
    items.push({ id: "redo", label: "Redo 3 weak answers", detail: `${Math.min(drillsDoneToday, 3)}/3 today${open ? ` · ${open} open drills` : ""}`, href: "/practice", done: drillsDoneToday >= 3 });
  }
  const { gaps } = storyCoverage(db.stories);
  if (db.stories.length < 6 || gaps.length > 6) {
    items.push({ id: "stories", label: db.stories.length ? "Fill a gap in your story bank" : "Build your story bank", detail: `${db.stories.length} stories · ${gaps.length} competencies without one`, href: "/stories", done: false });
  }
  return items;
}

// ---------------- Question helpers ----------------

const GUESS: [RegExp, Competency][] = [
  [/salary|gehalt|visa|permit|aufenthalt|notice|start date|kündigungsfrist|eintritt/i, "hygiene"],
  [/why (us|this|our|germany|supply)|warum|motivat|interest/i, "motivation_fit"],
  [/yourself|cv|lebenslauf|background|werdegang/i, "cv_walkthrough"],
  [/supplier|lieferant|procure|purchas|einkauf|negotiat|verhandl/i, "procurement_supplier"],
  [/forecast|demand|s&op|inventory|bestand|planning|planung|safety stock/i, "supply_chain_planning"],
  [/warehouse|lager|transport|logist|shipping|versand/i, "logistics_operations"],
  [/sap|erp|excel|power ?bi|sql|python|tool/i, "erp_tools"],
  [/data|analy|kpi|number|zahl/i, "analytical_data"],
  [/stakeholder|conflict|konflikt|colleague|kolleg|team|disagree/i, "stakeholder_management"],
  [/lead|initiative|ownership|verantwort|responsib/i, "leadership_ownership"],
  [/problem|challenge|herausforder|mistake|fehler|fail/i, "problem_solving"],
  [/deutsch|german/i, "german_language"],
];

export function guessCompetency(q: string): Competency {
  return GUESS.find(([re]) => re.test(q))?.[1] ?? "communication";
}

export function guessLang(q: string): "en" | "de" {
  return /\b(Sie|Ihnen|Ihre[mnrs]?|warum|wie|was|welche[nrs]?|erzählen|haben|würden|können)\b/.test(q) ? "de" : "en";
}
