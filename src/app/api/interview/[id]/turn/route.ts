import { interviewerNext } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { transcribe } from "@/lib/speech";
import { getSettings, readDb, readSession, saveAudio, updateSession } from "@/lib/store";
import type { AcousticSummary, PresenceSample, Turn } from "@/lib/types";

export const maxDuration = 120;

interface Meta {
  atMs: number;
  durationMs: number;
  acoustic?: AcousticSummary;
  presence?: PresenceSample;
  interrupted?: boolean;
  repeats?: number;
  prevInterviewerDurationMs?: number;
}

// One exchange: the candidate's answer comes in, the interviewer's next line goes out.
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const s = await readSession(u.id, id);
  if (!s) throw new Error("Session not found");
  if (s.status !== "live") throw new Error("This interview has already ended.");
  const fd = await req.formData();
  const meta = JSON.parse(String(fd.get("meta") ?? "{}")) as Meta;
  const audio = fd.get("audio");
  const browserText = String(fd.get("transcript") ?? "").trim();
  const lastQ = [...s.turns].reverse().find((t) => t.speaker === "interviewer")!;
  const lang = lastQ.lang;
  const idx = s.turns.length;

  let text = browserText;
  let words: Turn["words"];
  let audioFile: string | undefined;
  if (audio instanceof File && audio.size > 44) {
    const buf = Buffer.from(await audio.arrayBuffer());
    audioFile = await saveAudio(u.id, id, `a${idx}.wav`, buf);
    if ((await getSettings()).stt !== "browser") {
      const tr = await transcribe(buf, lang);
      text = tr.text.trim();
      words = tr.words;
    }
  }

  const answer: Turn = {
    idx,
    speaker: "candidate",
    text,
    lang,
    atMs: meta.atMs,
    durationMs: meta.durationMs,
    audioFile,
    words,
    acoustic: meta.acoustic,
    presence: meta.presence,
    interrupted: meta.interrupted,
    questionNo: lastQ.questionNo,
    competency: lastQ.competency,
  };
  const turnsSoFar = [...s.turns];
  if (meta.prevInterviewerDurationMs) turnsSoFar[lastQ.idx] = { ...lastQ, durationMs: meta.prevInterviewerDurationMs };
  turnsSoFar.push(answer);

  const db = await readDb(u.id);
  const next = await interviewerNext({
    plan: s.plan,
    type: s.type,
    difficulty: s.difficulty,
    language: s.language,
    turns: turnsSoFar,
    elapsedMin: (meta.atMs + meta.durationMs) / 60000,
    lengthMin: s.lengthMin,
    candidateName: (db.profile.name || u.name).split(" ")[0],
  });
  const reply: Turn = {
    idx: idx + 1,
    speaker: "interviewer",
    text: next.say,
    lang: next.lang,
    atMs: meta.atMs + meta.durationMs,
    durationMs: 0,
    kind: next.kind,
    questionNo: next.questionNo,
    competency: next.competency,
  };
  await updateSession(u.id, id, (x) => {
    x.turns = [...turnsSoFar, reply];
    if (meta.repeats) x.repeatRequests += meta.repeats;
  });
  return json({ candidateText: text, interviewer: reply, done: next.kind === "end" });
});
