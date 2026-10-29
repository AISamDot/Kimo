// Deterministic scoring maths. No LLM calls in here, so it is unit-tested and
// gives the same number for the same input every time.
import {
  STAGES,
  type AnswerScore,
  type Application,
  type Competency,
  type DeliveryMetrics,
  type Lang,
  type PresenceSample,
  type SessionSummary,
  type Settings,
  type Stage,
  type Turn,
} from "./types";

export const RUBRIC_VERSION = "v1";

const FILLER_PATTERNS: Record<Lang, [string, RegExp][]> = {
  en: [
    ["um", /\b(u+h*m+|e+r+m+)\b/gi],
    ["uh", /\b(u+h+|e+r+|a+h+)\b/gi],
    ["hmm", /\b(h+m+|m+h*m+)\b/gi],
    ["you know", /\byou know\b/gi],
    ["I mean", /\bi mean\b/gi],
    ["basically", /\bbasically\b/gi],
    ["kind of / sort of", /\b(kind|sort) of\b/gi],
  ],
  de: [
    ["ähm", /(?<![\p{L}])(ä+h*m+|ö+h*m+|e+h*m+)(?![\p{L}])/giu],
    ["äh", /(?<![\p{L}])(ä+h+|ö+h+|e+h+)(?![\p{L}])/giu],
    ["hm", /(?<![\p{L}])(h+m+)(?![\p{L}])/giu],
    ["sozusagen", /(?<![\p{L}])sozusagen(?![\p{L}])/giu],
    ["quasi", /(?<![\p{L}])quasi(?![\p{L}])/giu],
    ["halt", /(?<![\p{L}])halt(?![\p{L}])/giu],
    ["irgendwie", /(?<![\p{L}])irgendwie(?![\p{L}])/giu],
  ],
};

export function countFillers(text: string, lang: Lang): { total: number; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const [label, re] of FILLER_PATTERNS[lang]) {
    const n = (text.match(re) || []).length;
    if (n) {
      counts[label] = n;
      total += n;
    }
  }
  return { total, counts };
}

export function wordCount(text: string): number {
  return (text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
}

/** 100 inside [lo, hi]; falls linearly to 0 at `soft` distance outside the range. */
export function rangeScore(value: number, lo: number, hi: number, soft: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= lo && value <= hi) return 100;
  const d = value < lo ? lo - value : value - hi;
  return Math.max(0, Math.round(100 * (1 - d / soft)));
}

/** Score 100 at or below `good`, 0 at `bad` (for "fewer is better" metrics). */
export function lowerIsBetter(value: number, good: number, bad: number): number {
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return Math.round(100 * (1 - (value - good) / (bad - good)));
}

export const WPM_TARGET: Record<Lang, [number, number]> = { en: [120, 160], de: [100, 140] };

export function answerTarget(kind: string | undefined, competency?: Competency): [number, number] {
  if (competency === "cv_walkthrough" || kind === "opening") return [60, 90];
  if (competency === "hygiene") return [10, 45];
  if (kind === "probe") return [20, 75];
  return [45, 120];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

export function computeDelivery(turns: Turn[]): DeliveryMetrics {
  const answers = turns.filter((t) => t.speaker === "candidate" && t.text.trim().length > 0);
  const interviewer = turns.filter((t) => t.speaker === "interviewer");
  const byIdx = new Map(turns.map((t) => [t.idx, t]));

  let words = 0;
  let speechSec = 0;
  let fillerTotal = 0;
  const fillerCounts: Record<string, number> = {};
  let lengthOk = 0;
  let pauses = 0;
  const durations: number[] = [];
  const pitchSds: number[] = [];
  let trailing = 0;
  const langCount: Record<Lang, number> = { en: 0, de: 0 };

  for (const a of answers) {
    const n = wordCount(a.text);
    words += n;
    langCount[a.lang]++;
    const dur = a.acoustic?.durationSec ?? a.durationMs / 1000;
    durations.push(dur);
    speechSec += a.acoustic?.speechSec && a.acoustic.speechSec > 0 ? a.acoustic.speechSec : dur;
    const f = countFillers(a.text, a.lang);
    fillerTotal += f.total;
    for (const [k, v] of Object.entries(f.counts)) fillerCounts[k] = (fillerCounts[k] || 0) + v;
    pauses += a.acoustic?.longPauses ?? 0;
    if (a.acoustic && a.acoustic.pitchSdSemitones > 0) pitchSds.push(a.acoustic.pitchSdSemitones);
    if (a.acoustic && a.acoustic.endDropDb < -4) trailing++;
    // find the interviewer turn this answers (closest previous interviewer turn)
    let q: Turn | undefined;
    for (let i = a.idx - 1; i >= 0; i--) {
      const t = byIdx.get(i);
      if (t?.speaker === "interviewer") {
        q = t;
        break;
      }
    }
    const [lo, hi] = answerTarget(q?.kind === "probe" ? "probe" : undefined, q?.competency);
    if (dur >= lo && dur <= hi) lengthOk++;
  }

  const mainLang: Lang = langCount.de > langCount.en ? "de" : "en";
  const minutes = speechSec / 60;
  const wpm = minutes > 0 ? words / minutes : 0;
  const fillersPerMin = minutes > 0 ? fillerTotal / minutes : 0;
  const candSec = avg(durations) * durations.length;
  const intSec = interviewer.reduce((s, t) => s + t.durationMs / 1000, 0);
  const talkRatio = candSec + intSec > 0 ? candSec / (candSec + intSec) : 0;
  const pitchVariation = avg(pitchSds);
  const n = answers.length || 1;

  const [wlo, whi] = WPM_TARGET[mainLang];
  const sub: Record<string, number> = {
    pace: rangeScore(wpm, wlo, whi, 60),
    fillers: lowerIsBetter(fillersPerMin, 3, 12),
    pauses: lowerIsBetter(pauses / n, 2, 6),
    answerLength: Math.round((lengthOk / n) * 100),
    talkRatio: rangeScore(talkRatio * 100, 55, 70, 30),
  };
  if (pitchSds.length) sub.vocalVariety = rangeScore(pitchVariation, 2, 6, 2.5);
  if (answers.some((a) => a.acoustic)) sub.energyHold = Math.round((1 - trailing / n) * 100);

  const score = answers.length ? Math.round(avg(Object.values(sub))) : 0;
  return {
    wpm: Math.round(wpm),
    fillersPerMin: round1(fillersPerMin),
    fillerCounts,
    longPausesPerAnswer: round1(pauses / n),
    avgAnswerSec: Math.round(avg(durations)),
    answerLengthOkPct: Math.round((lengthOk / n) * 100),
    talkRatio: Math.round(talkRatio * 100),
    pitchVariation: round1(pitchVariation),
    trailingOffPct: Math.round((trailing / n) * 100),
    score,
    subScores: sub,
  };
}

const CONTENT_WEIGHTS = {
  relevance: 1.2,
  structure: 1,
  specificity: 1.3,
  ownership: 1,
  domainDepth: 1.1,
  concision: 0.8,
};

/** One answer's content score on a 1–5 scale (weighted rubric average). */
export function answerContentScore(a: AnswerScore): number {
  let sum = 0;
  let w = 0;
  for (const [k, wt] of Object.entries(CONTENT_WEIGHTS)) {
    sum += (a[k as keyof typeof CONTENT_WEIGHTS] as number) * wt;
    w += wt;
  }
  if (a.correctness != null) {
    sum += a.correctness * 1.2;
    w += 1.2;
  }
  return sum / w;
}

/** Map a 1–5 rubric average to 0–100. */
export const fiveToHundred = (x: number) => Math.round(Math.max(0, Math.min(100, ((x - 1) / 4) * 100)));

export function contentScore(answers: AnswerScore[]): number {
  if (!answers.length) return 0;
  return fiveToHundred(avg(answers.map(answerContentScore)));
}

export function competencyScores(answers: AnswerScore[]): Partial<Record<Competency, number>> {
  const groups: Partial<Record<Competency, number[]>> = {};
  for (const a of answers) (groups[a.competency] ??= []).push(answerContentScore(a));
  const out: Partial<Record<Competency, number>> = {};
  for (const [k, v] of Object.entries(groups)) out[k as Competency] = round1(avg(v!));
  return out;
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
export function cefrIndex(level: string): number {
  const m = level.toUpperCase().match(/[ABC][12]/);
  return m ? CEFR_ORDER.indexOf(m[0]) : -1;
}

export function cefrGap(estimated: string, required: string): "meets" | "one_level" | "two_plus" | "unknown" {
  const e = cefrIndex(estimated);
  const r = cefrIndex(required);
  if (e < 0 || r < 0) return "unknown";
  if (e >= r) return "meets";
  return r - e === 1 ? "one_level" : "two_plus";
}

export function languageScore(l: {
  fluency: number;
  grammar: number;
  vocabulary: number;
  domainVocabulary: number;
  comprehension: number;
  pronunciation: number | null;
}): number {
  const parts = [l.fluency, l.grammar, l.vocabulary, l.domainVocabulary, l.comprehension];
  if (l.pronunciation != null) parts.push(l.pronunciation);
  return fiveToHundred(avg(parts));
}

export function presenceScore(p: PresenceSample): { score: number; notes: string[] } {
  const notes: string[] = [];
  const gaze = rangeScore(p.gazeAtCameraPct, 60, 100, 50);
  const smile = rangeScore(p.smilePct, 10, 60, 20);
  const motion = lowerIsBetter(p.headMotion, 0.01, 0.05);
  const light = rangeScore(p.brightness, 70, 200, 60);
  const framing = rangeScore(p.centeredPct, 80, 100, 50);
  if (gaze < 70) notes.push(`You looked at or near the camera ${Math.round(p.gazeAtCameraPct)}% of the time. Aim for 60%+.`);
  if (smile < 70) notes.push(p.smilePct < 10 ? "You rarely smiled. A smile at the greeting and close reads as warmth." : "Smiling a lot is fine, but keep it natural during serious answers.");
  if (motion < 70) notes.push("Lots of head movement. Sit back and keep your head steadier.");
  if (light < 70) notes.push(p.brightness < 70 ? "Your face is too dark. Put a light in front of you." : "Your image is overexposed. Reduce light behind the camera.");
  if (framing < 70) notes.push("You were often off-centre or out of frame. Center your face at eye level.");
  if (p.facePresentPct < 80) notes.push(`Your face was visible only ${Math.round(p.facePresentPct)}% of the time.`);
  const score = Math.round(gaze * 0.4 + smile * 0.15 + motion * 0.2 + light * 0.1 + framing * 0.15);
  return { score, notes };
}

export function overallScore(
  area: { content: number; delivery: number; language: number | null; presence: number | null },
  weights: Settings["weights"],
): number {
  const parts: [number, number][] = [
    [area.content, weights.content],
    [area.delivery, weights.delivery],
  ];
  if (area.language != null) parts.push([area.language, weights.language]);
  if (area.presence != null) parts.push([area.presence, weights.presence]);
  const w = parts.reduce((s, [, wt]) => s + wt, 0);
  return w ? Math.round(parts.reduce((s, [v, wt]) => s + v * wt, 0) / w) : 0;
}

/** Interview-ready when the last 3 finished sessions average >= threshold with no area below floor. */
export function readiness(
  sessions: SessionSummary[],
  r: Settings["readiness"],
): { ready: boolean; avg: number | null; count: number; reason: string } {
  const done = sessions
    .filter((s) => s.status === "done" && s.overall != null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-3);
  if (done.length < 3) return { ready: false, avg: done.length ? Math.round(avg(done.map((s) => s.overall!))) : null, count: done.length, reason: `${3 - done.length} more scored session(s) needed` };
  const a = Math.round(avg(done.map((s) => s.overall!)));
  const lows = done.flatMap((s) =>
    Object.entries(s.areaScores ?? {})
      .filter(([, v]) => v != null && (v as number) < r.floor)
      .map(([k]) => k),
  );
  if (a < r.threshold) return { ready: false, avg: a, count: 3, reason: `Average ${a} is below ${r.threshold}` };
  if (lows.length) return { ready: false, avg: a, count: 3, reason: `Below ${r.floor} in: ${[...new Set(lows)].join(", ")}` };
  return { ready: true, avg: a, count: 3, reason: "Last 3 sessions meet the bar" };
}

/** A drill passes when its skill scored >= 4/5 in the two most recent sessions that tested it. */
export function drillPassed(skill: Competency, sessionsOldestFirst: SessionSummary[]): boolean {
  const scores = sessionsOldestFirst
    .filter((s) => s.status === "done" && s.competencyScores?.[skill] != null)
    .map((s) => s.competencyScores![skill]!);
  if (scores.length < 2) return false;
  return scores.slice(-2).every((x) => x >= 4);
}

export interface FunnelRow {
  stage: Stage;
  reached: number;
  pctOfApplied: number;
  conversionFromPrev: number | null;
}

export function funnel(apps: Application[]): FunnelRow[] {
  const idx = (s: Stage) => STAGES.indexOf(s);
  const total = apps.length;
  return STAGES.map((stage, i) => {
    const reached = apps.filter((a) => idx(a.stage) >= i || (stage === "offer" && a.outcome === "offer")).length;
    const prev = i === 0 ? null : apps.filter((a) => idx(a.stage) >= i - 1).length;
    return {
      stage,
      reached,
      pctOfApplied: total ? Math.round((reached / total) * 100) : 0,
      conversionFromPrev: prev ? Math.round((reached / prev) * 100) : prev === 0 ? 0 : null,
    };
  });
}

/** Where do candidates most often stop? Returns the stage transition with the worst conversion. */
export function biggestDropOff(rows: FunnelRow[]): { from: Stage; to: Stage; conversion: number } | null {
  let worst: { from: Stage; to: Stage; conversion: number } | null = null;
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i].conversionFromPrev;
    if (c == null || rows[i - 1].reached < 2) continue;
    if (!worst || c < worst.conversion) worst = { from: rows[i - 1].stage, to: rows[i].stage, conversion: c };
  }
  return worst;
}

export function funnelBy<K extends keyof Application>(apps: Application[], key: K): { group: string; rows: FunnelRow[]; n: number }[] {
  const groups = new Map<string, Application[]>();
  for (const a of apps) {
    const g = String(a[key] || "unknown");
    groups.set(g, [...(groups.get(g) ?? []), a]);
  }
  return [...groups.entries()].map(([group, list]) => ({ group, rows: funnel(list), n: list.length }));
}
