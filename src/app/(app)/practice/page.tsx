import { QuickDrill, type DrillQuestion } from "@/components/QuickDrill";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { answerContentScore } from "@/lib/metrics";
import { attemptKey, attemptTrend, guessCompetency, guessLang } from "@/lib/practice";
import { QUESTION_BANK } from "@/lib/questionBank";
import { getSettings, readDb, readSession } from "@/lib/store";

export const metadata = { title: "Quick drills" };

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const user = await requireUser();
  const sp = await searchParams;
  const db = await readDb(user.id);
  const settings = await getSettings();
  const qs: DrillQuestion[] = [];
  const add = (q: Omit<DrillQuestion, "key" | "trend">) => {
    const key = attemptKey(q.question);
    if (qs.some((x) => x.key === key)) return;
    qs.push({ ...q, key, trend: attemptTrend(db.attempts, key) });
  };

  // 1. His weakest real answers from scored mock interviews (most useful first).
  const done = db.sessions.filter((s) => s.status === "done").slice(-10).reverse();
  const weak: (Omit<DrillQuestion, "key" | "trend"> & { score: number })[] = [];
  for (const s of done) {
    const d = await readSession(user.id, s.id);
    for (const a of d?.analysis?.answers ?? []) {
      const score = answerContentScore(a);
      if (score < 65) weak.push({ question: a.question, competency: a.competency, lang: guessLang(a.question), jobId: s.jobId, source: "weak", hint: a.whatWasMissing, lastScore: score, score });
    }
  }
  weak.sort((a, b) => a.score - b.score).forEach(({ score: _s, ...w }) => add(w));
  // 2. Questions from his real interviews.
  for (const d of [...db.debriefs].reverse()) {
    const app = db.applications.find((a) => a.id === d.applicationId);
    for (const q of d.result.perQuestion) add({ question: q.q, competency: guessCompetency(q.q), lang: guessLang(q.q), jobId: app?.jobId ?? "", source: "real", hint: q.assessment, lastScore: q.score * 20 });
  }
  // 3. Likely questions for each job ad.
  for (const j of db.jobs) for (const q of j.parsed.likelyQuestions) add({ question: q, competency: guessCompetency(q), lang: guessLang(q), jobId: j.id, source: "job", hint: `${j.parsed.title} · ${j.parsed.company}` });
  // 4. Core bank.
  for (const b of QUESTION_BANK) {
    add({ question: b.en, competency: b.competency, lang: "en", jobId: "", source: "bank", hint: "" });
    add({ question: b.de, competency: b.competency, lang: "de", jobId: "", source: "bank", hint: "" });
  }

  const recent = [...db.attempts].reverse().slice(0, 8).map((a) => ({ id: a.id, question: a.question, content: a.content, createdAt: a.createdAt }));
  return (
    <div>
      <PageHeader
        eyebrow="Practise"
        title="Quick drills"
        sub="One question, one answer, instant score. Redo your weakest answers until the number moves. Faster than a full interview and great for 10-minute sessions."
      />
      <QuickDrill
        questions={qs}
        jobs={db.jobs.map((j) => ({ id: j.id, label: `${j.parsed.title} · ${j.parsed.company}` }))}
        recent={recent}
        browserStt={settings.stt === "browser"}
        hasCv={db.resumes.length > 0}
        initialQuestion={typeof sp.q === "string" ? sp.q : undefined}
      />
    </div>
  );
}
