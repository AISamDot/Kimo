import { scoreAnswer } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { answerContentScore, countFillers, wordCount } from "@/lib/metrics";
import { attemptKey } from "@/lib/practice";
import { transcribe } from "@/lib/speech";
import { getSettings, newId, readDb, updateDb } from "@/lib/store";
import { COMPETENCIES, type AcousticSummary, type AnswerAttempt, type Competency, type Lang } from "@/lib/types";

export const maxDuration = 120;

interface Meta {
  question: string;
  competency: Competency;
  lang: Lang;
  jobId: string;
  durationMs: number;
  acoustic?: AcousticSummary;
}

// One quick-drill answer: transcribe (or take the typed/browser transcript), score instantly, keep history.
export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const fd = await req.formData();
  const meta = JSON.parse(String(fd.get("meta") ?? "{}")) as Meta;
  const question = String(meta.question ?? "").trim().slice(0, 600);
  if (!question) throw new Error("Missing question.");
  const lang: Lang = meta.lang === "de" ? "de" : "en";
  const competency: Competency = COMPETENCIES.includes(meta.competency) ? meta.competency : "communication";
  let text = String(fd.get("transcript") ?? "").trim();
  const audio = fd.get("audio");
  if (audio instanceof File && audio.size > 44 && (await getSettings()).stt !== "browser") {
    text = (await transcribe(Buffer.from(await audio.arrayBuffer()), lang)).text.trim();
  }
  if (wordCount(text) < 5) throw new Error("I couldn't hear an answer. Try again, a bit closer to the mic, or type it.");

  const db = await readDb(u.id);
  const job = db.jobs.find((j) => j.id === meta.jobId);
  const resume = [...db.resumes].sort((a, b) => b.version - a.version)[0];
  if (!resume) throw new Error("Upload your CV first so answers can be judged against it.");
  const durationMs = Math.max(1000, Number(meta.durationMs) || wordCount(text) * 420);
  const r = await scoreAnswer({
    questionNo: 1,
    question,
    competency,
    kind: "behavioral",
    thread: [
      { idx: 0, speaker: "interviewer", text: question, lang, atMs: 0, durationMs: 0, kind: "question", questionNo: 1, competency },
      { idx: 1, speaker: "candidate", text, lang, atMs: 0, durationMs, questionNo: 1, competency, acoustic: meta.acoustic },
    ],
    job,
    resume,
    stories: db.stories,
  });
  const content = answerContentScore({ questionNo: 1, question, competency, ...r });
  const mins = durationMs / 60000;
  const attempt: AnswerAttempt = {
    id: newId("att"),
    createdAt: new Date().toISOString(),
    key: attemptKey(question),
    jobId: job?.id ?? "",
    question,
    competency,
    lang,
    transcript: text,
    durationSec: Math.round(durationMs / 1000),
    content,
    scores: r,
    delivery: {
      wpm: Math.round(wordCount(text) / Math.max(mins, 0.05)),
      fillersPerMin: Math.round((countFillers(text, lang).total / Math.max(mins, 0.05)) * 10) / 10,
      longPauses: meta.acoustic?.longPauses ?? 0,
    },
  };
  const history = await updateDb(u.id, (d) => {
    d.attempts.push(attempt);
    if (d.attempts.length > 600) d.attempts = d.attempts.slice(-600);
    return d.attempts.filter((a) => a.key === attempt.key).map((a) => ({ createdAt: a.createdAt, content: a.content }));
  });
  return json({ attempt, history });
});
