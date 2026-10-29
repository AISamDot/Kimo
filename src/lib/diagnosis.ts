import { diagnose } from "./ai";
import { biggestDropOff, funnel, funnelBy } from "./metrics";
import { newId, readDb, updateDb } from "./store";
import type { Diagnosis } from "./types";

/** Builds the evidence pack (real funnel + CV reviews + mock scores) for the diagnosis. */
export async function buildEvidence(uid: string) {
  const db = await readDb(uid);
  const done = db.sessions.filter((s) => s.status === "done").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const recent = done.slice(-8);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const compAgg: Record<string, number[]> = {};
  for (const s of recent) for (const [k, v] of Object.entries(s.competencyScores ?? {})) (compAgg[k] ??= []).push(v as number);
  const rows = funnel(db.applications);
  const latestResume = [...db.resumes].sort((a, b) => b.version - a.version)[0];

  return {
    profile: db.profile,
    applications: {
      count: db.applications.length,
      funnel: rows,
      biggestDropOff: biggestDropOff(rows),
      byInterviewLanguage: funnelBy(db.applications, "interviewLanguage").map((g) => ({ group: g.group, n: g.n, reachedInterview2: g.rows[3].reached, offers: g.rows[5].reached })),
      byResumeVersion: funnelBy(db.applications, "resumeId").map((g) => ({ group: db.resumes.find((r) => r.id === g.group)?.label ?? g.group, n: g.n, screens: g.rows[1].reached })),
      feedbackReceived: db.applications.filter((a) => a.feedback.trim()).map((a) => ({ company: a.company, stage: a.stage, feedback: a.feedback })),
    },
    cv: {
      generalReview: latestResume?.generalReview
        ? { score: latestResume.generalReview.overallScore, verdict: latestResume.generalReview.verdict, topActions: latestResume.generalReview.topActions }
        : null,
      jobFit: db.jobReviews.slice(-10).map((r) => ({
        job: db.jobs.find((j) => j.id === r.jobId)?.parsed.title,
        fit: r.result.fitScore,
        wouldGetScreen: r.result.wouldGetScreen,
      })),
    },
    targetJobs: db.jobs.map((j) => ({ title: j.parsed.title, seniority: j.parsed.seniority, germanImplied: j.parsed.germanRequired.implied, germanStated: j.parsed.germanRequired.stated })),
    mockInterviews: {
      scoredSessions: done.length,
      recentAverages: {
        overall: avg(recent.map((s) => s.overall ?? 0)),
        content: avg(recent.map((s) => s.areaScores?.content ?? 0)),
        delivery: avg(recent.map((s) => s.areaScores?.delivery ?? 0)),
        language: avg(recent.filter((s) => s.areaScores?.language != null).map((s) => s.areaScores!.language!)),
        presence: avg(recent.filter((s) => s.areaScores?.presence != null).map((s) => s.areaScores!.presence!)),
      },
      verdicts: recent.map((s) => s.verdict),
      competencyAverages5: Object.fromEntries(Object.entries(compAgg).map(([k, v]) => [k, Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10])),
      trend: done.map((s) => ({ date: s.createdAt.slice(0, 10), overall: s.overall, type: s.type, language: s.language })),
    },
    realInterviewDebriefs: db.debriefs.slice(-8).map((d) => ({
      company: db.applications.find((a) => a.id === d.applicationId)?.company ?? "",
      stage: d.stage,
      language: d.language,
      feeling: d.feeling,
      likelyVerdict: d.result.likelyVerdict,
      redFlags: d.result.redFlags,
      avgAnswerScore5: d.result.perQuestion.length ? Math.round((d.result.perQuestion.reduce((a, q) => a + q.score, 0) / d.result.perQuestion.length) * 10) / 10 : null,
    })),
    preparation: {
      stories: db.stories.length,
      quickDrillAttempts: db.attempts.length,
      germanPhrases: db.phrases.length,
    },
    openDrills: db.drills.filter((d) => d.status === "open").map((d) => d.title),
  };
}

export async function runDiagnosis(uid: string): Promise<Diagnosis> {
  const evidence = await buildEvidence(uid);
  const r = await diagnose(evidence);
  const d: Diagnosis = { id: newId("dia"), createdAt: new Date().toISOString(), ...r, causes: [...r.causes].sort((a, b) => a.rank - b.rank) };
  await updateDb(uid, (db) => {
    db.diagnoses.push(d);
    db.diagnoses = db.diagnoses.slice(-20);
  });
  return d;
}
