// Post-interview analysis pipeline: scores every answer, measures delivery,
// language and presence, then writes the coaching report and updates drills.
import { assessLanguage, scoreAnswer, writeReport } from "./ai";
import { friendlyError } from "./llm";
import { mergePhrases, today } from "./practice";
import {
  competencyScores,
  computeDelivery,
  contentScore,
  drillPassed,
  fiveToHundred,
  languageScore,
  overallScore,
  presenceScore,
  cefrGap,
} from "./metrics";
import { azurePronunciation, humeProsody } from "./speech";
import {
  deleteSessionAudio,
  enforceAudioRetention,
  getSettings,
  newId,
  readAudio,
  readDb,
  readSession,
  updateDb,
  updateSession,
} from "./store";
import type { AnswerScore, Competency, Lang, SessionAnalysis, SessionDetail, Turn } from "./types";

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export interface Thread {
  questionNo: number;
  question: string;
  competency: Competency;
  kind: string;
  turns: Turn[];
}

/** Groups the transcript into one thread per plan question (question + follow-ups + answers). */
export function groupThreads(s: Pick<SessionDetail, "turns" | "plan">): Thread[] {
  const threads = new Map<number, Thread>();
  let current = 0;
  for (const t of s.turns) {
    if (t.speaker === "interviewer" && t.questionNo != null) current = t.questionNo;
    if (!current) continue;
    let th = threads.get(current);
    if (!th) {
      const pq = s.plan.questions.find((q) => q.no === current);
      th = {
        questionNo: current,
        question: pq?.text ?? t.text,
        competency: (t.competency ?? pq?.competency ?? "communication") as Competency,
        kind: pq?.kind ?? "behavioral",
        turns: [],
      };
      threads.set(current, th);
    }
    th.turns.push(t);
  }
  return [...threads.values()].filter((th) => th.turns.some((t) => t.speaker === "candidate" && t.text.trim()));
}

const running = new Set<string>();

/** Marks the session as analysing; returns the analysis job to run (pass it to `after()`). */
export async function startAnalysis(uid: string, sessionId: string): Promise<() => Promise<void>> {
  await updateSession(uid, sessionId, (s) => {
    s.status = "analyzing";
    s.error = undefined;
  });
  return async () => {
    if (running.has(sessionId)) return;
    running.add(sessionId);
    try {
      await runAnalysis(uid, sessionId);
    } catch (e) {
      console.error("analysis failed", e);
      await updateSession(uid, sessionId, (s) => {
        s.status = "failed";
        s.error = friendlyError(e);
      });
    } finally {
      running.delete(sessionId);
    }
  };
}

async function runAnalysis(uid: string, sessionId: string) {
  const settings = await getSettings();
  const s = await readSession(uid, sessionId);
  if (!s) throw new Error("Session not found");
  const db = await readDb(uid);
  const job = db.jobs.find((j) => j.id === s.jobId);
  const resume = db.resumes.find((r) => r.id === s.resumeId);
  if (!job || !resume) throw new Error("The job ad or CV for this session was deleted.");
  const notes: string[] = [];

  // 1. Content: one scoring call per question thread.
  const threads = groupThreads(s);
  if (!threads.length) throw new Error("No answers were recorded in this session, so there is nothing to score.");
  const scored = await mapLimit(threads, 4, async (th) => {
    const r = await scoreAnswer({ ...th, thread: th.turns, job, resume, stories: db.stories });
    const a: AnswerScore = { questionNo: th.questionNo, question: th.question, competency: th.competency, ...r };
    return a;
  });

  // 2. Delivery (deterministic).
  const delivery = computeDelivery(s.turns);

  // 3. Language: German if any German answers, else English.
  const answers = s.turns.filter((t) => t.speaker === "candidate" && t.text.trim());
  const lang: Lang = answers.some((t) => t.lang === "de") ? "de" : "en";
  const langTurns = s.turns.filter((t) => t.lang === lang);
  const required = lang === "de" ? job.parsed.germanRequired.implied || job.parsed.germanRequired.stated : job.parsed.englishRequired;

  let pronunciation: SessionAnalysis["pronunciation"] = null;
  if (settings.features.azurePronunciation && settings.keys.azureSpeech) {
    try {
      const candidates = answers
        .filter((t) => t.lang === lang && t.audioFile && t.text.trim())
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 4);
      const results: NonNullable<Awaited<ReturnType<typeof azurePronunciation>>>[] = [];
      for (const t of candidates) {
        const buf = await readAudio(uid, s.id, t.audioFile!);
        if (!buf) continue;
        const r = await azurePronunciation(buf, lang, t.text);
        if (r) results.push(r);
      }
      if (results.length) {
        const m = (k: "accuracy" | "fluency" | "overall") => Math.round(results.reduce((a, r) => a + r[k], 0) / results.length);
        const pros = results.filter((r) => r.prosody != null);
        pronunciation = {
          accuracy: m("accuracy"),
          fluency: m("fluency"),
          overall: m("overall"),
          prosody: pros.length ? Math.round(pros.reduce((a, r) => a + (r.prosody ?? 0), 0) / pros.length) : null,
        };
      }
    } catch (e) {
      notes.push(`Pronunciation check skipped: ${friendlyError(e)}`);
    }
  }

  const la = await assessLanguage({ lang, turns: langTurns, required, repeatRequests: s.repeatRequests });
  const pron15 = pronunciation ? 1 + (pronunciation.overall / 100) * 4 : null;
  const language: SessionAnalysis["language"] = {
    lang,
    ...la,
    pronunciation: pron15 != null ? Math.round(pron15 * 10) / 10 : null,
    requiredLevel: required,
    gap: cefrGap(la.cefr, required),
    score: languageScore({ ...la, pronunciation: pron15 }),
  };

  // 4. Vocal expression (Hume), optional.
  let vocal: SessionAnalysis["vocal"] = null;
  if (settings.features.hume && settings.keys.hume) {
    try {
      const files: { name: string; data: Buffer; t: Turn }[] = [];
      for (const t of answers.filter((x) => x.audioFile)) {
        const data = await readAudio(uid, s.id, t.audioFile!);
        if (data) files.push({ name: t.audioFile!, data, t });
      }
      if (files.length) {
        const res = await humeProsody(files);
        const totals: Record<string, number> = {};
        const perAnswer: { questionNo: number; top: string[] }[] = [];
        for (const f of files) {
          const scores = res.get(f.name);
          if (!scores) continue;
          for (const [k, v] of Object.entries(scores)) totals[k] = (totals[k] ?? 0) + v / files.length;
          const top = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k]) => k);
          perAnswer.push({ questionNo: f.t.questionNo ?? 0, top });
        }
        vocal = {
          topExpressions: Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, score]) => ({ name, score: Math.round(score * 100) / 100 })),
          perAnswer,
          note: "How your voice may come across to a listener (Hume AI vocal-expression model). It's an impression, not a reading of your feelings.",
        };
      }
    } catch (e) {
      notes.push(`Vocal-expression analysis skipped: ${friendlyError(e)}`);
    }
  }

  // 5. Presence (webcam metrics computed in the browser).
  const presence = s.presenceOverall && s.presenceOverall.frames > 20 ? { ...s.presenceOverall, ...presenceScore(s.presenceOverall) } : null;

  // 6. Scores.
  const areaScores = {
    content: contentScore(scored),
    delivery: delivery.score,
    language: language.score,
    presence: presence?.score ?? null,
  };
  const overall = overallScore(areaScores, settings.weights);
  const comp = competencyScores(scored);

  // 7. Report (hiring verdict + drills).
  const previous = (await readDb(uid))
    .sessions.filter((x) => x.jobId === s.jobId && x.id !== s.id && x.status === "done")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
  const hygiene = groupThreads(s).filter((t) => t.competency === "hygiene");
  const report = await writeReport({
    role: `${job.parsed.title} at ${job.parsed.company}`,
    interviewType: s.type,
    difficulty: s.difficulty,
    overall,
    areaScores,
    answers: scored.map((a) => ({
      q: a.question,
      competency: a.competency,
      content5: fiveToHundred((a.relevance + a.structure + a.specificity + a.ownership + a.domainDepth + a.concision) / 6),
      scores: { relevance: a.relevance, structure: a.structure, specificity: a.specificity, ownership: a.ownership, domainDepth: a.domainDepth, concision: a.concision, correctness: a.correctness },
      summary: a.answerSummary,
      costlyQuote: a.costlyQuote,
      missing: a.whatWasMissing,
    })),
    delivery,
    language: { ...language, phrasesToPractice: undefined },
    pronunciation,
    presence,
    vocalImpression: vocal?.topExpressions,
    hygieneAnswers: hygiene.map((h) => h.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n")),
    previousSession: previous
      ? { overall: previous.overall, areaScores: previous.areaScores, competencyScores: previous.competencyScores, date: previous.createdAt }
      : null,
  });

  const analysis: SessionAnalysis = {
    answers: scored,
    delivery,
    language,
    presence,
    vocal,
    pronunciation,
    report,
    areaScores,
    overall,
    competencyScores: comp,
    costNotes: notes,
  };

  await updateSession(uid, s.id, (x) => {
    x.analysis = analysis;
    x.overall = overall;
    x.verdict = report.verdict;
    x.areaScores = areaScores;
    x.competencyScores = comp;
    x.status = "done";
    x.error = undefined;
  });

  // 8. Drills: add this session's 3, then auto-pass any whose skill is now solid.
  await updateDb(uid, (d) => {
    d.drills = d.drills.filter((dr) => dr.sessionId !== s.id);
    for (const dr of report.drills.slice(0, 3)) {
      d.drills.push({ id: newId("drl"), sessionId: s.id, jobId: s.jobId, skill: dr.skill, title: dr.title, detail: dr.detail, status: "open", createdAt: new Date().toISOString() });
    }
    const trackSessions = d.sessions.filter((x) => x.jobId === s.jobId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const dr of d.drills) {
      if (dr.status === "open" && dr.jobId === s.jobId && drillPassed(dr.skill, trackSessions)) {
        dr.status = "passed";
        dr.passedAt = new Date().toISOString();
      }
    }
    // German corrections and missing phrases go straight into the phrase trainer.
    if (language?.lang === "de") {
      const now = new Date().toISOString();
      mergePhrases(
        d.phrases,
        [
          ...language.corrections.map((c) => ({ id: newId("phr"), de: c.better, en: "", note: `You said: “${c.said}”`, source: "session" as const, createdAt: now })),
          ...language.phrasesToPractice.map((p) => ({ id: newId("phr"), de: p.phrase, en: p.meaning, note: "", source: "session" as const, createdAt: now })),
        ],
        today(),
      );
    }
  });

  // 9. Audio retention.
  if (settings.data.deleteAudioAfterAnalysis) await deleteSessionAudio(uid, s.id);
  await enforceAudioRetention(settings.data.audioRetentionDays);
}
