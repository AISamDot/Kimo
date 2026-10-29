"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserStt, browserSttSupported } from "@/lib/client/browserStt";
import { Recorder } from "@/lib/client/recorder";
import { guessCompetency, guessLang } from "@/lib/practice";
import { COMPETENCY_LABELS, type AnswerAttempt, type Competency } from "@/lib/types";
import { api, Button, ErrorNote } from "./client";
import { Icon, Pill, ScoreRing } from "./ui";

export interface DrillQuestion {
  key: string;
  question: string;
  competency: Competency;
  lang: "en" | "de";
  jobId: string;
  source: "weak" | "real" | "job" | "bank";
  hint: string;
  lastScore?: number;
  trend: { count: number; first: number | null; last: number | null; best: number | null; delta: number | null };
}

const SOURCES = [
  { id: "weak", label: "My weak answers" },
  { id: "real", label: "From real interviews" },
  { id: "job", label: "Job ads" },
  { id: "bank", label: "Core questions" },
] as const;

const DIMS = ["relevance", "structure", "specificity", "ownership", "domainDepth", "concision"] as const;
const DIM_LABEL: Record<string, string> = { relevance: "Relevance", structure: "Structure", specificity: "Specificity", ownership: "Ownership", domainDepth: "Domain depth", concision: "Length" };

type Phase = "idle" | "recording" | "scoring" | "result";

export function QuickDrill({
  questions,
  jobs,
  recent,
  browserStt,
  hasCv,
  initialQuestion,
}: {
  questions: DrillQuestion[];
  jobs: { id: string; label: string }[];
  recent: { id: string; question: string; content: number; createdAt: string }[];
  browserStt: boolean;
  hasCv: boolean;
  initialQuestion?: string;
}) {
  const router = useRouter();
  const firstSource = (SOURCES.find((s) => questions.some((q) => q.source === s.id))?.id ?? "bank") as DrillQuestion["source"];
  const [source, setSource] = useState<DrillQuestion["source"]>(firstSource);
  const [lang, setLang] = useState<"all" | "en" | "de">("all");
  const [current, setCurrent] = useState<DrillQuestion | null>(() => {
    if (!initialQuestion) return null;
    return (
      questions.find((q) => q.question === initialQuestion) ?? {
        key: "",
        question: initialQuestion,
        competency: guessCompetency(initialQuestion),
        lang: guessLang(initialQuestion),
        jobId: "",
        source: "bank",
        hint: "",
        trend: { count: 0, first: null, last: null, best: null, delta: null },
      }
    );
  });
  const [jobId, setJobId] = useState(() => questions.find((q) => q.question === initialQuestion)?.jobId ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [mode, setMode] = useState<"voice" | "type">("voice");
  const [caption, setCaption] = useState("");
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ attempt: AnswerAttempt; history: { createdAt: string; content: number }[] } | null>(null);
  const rec = useRef<Recorder | null>(null);
  const stt = useRef<BrowserStt | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number>(0);

  const list = useMemo(() => questions.filter((q) => q.source === source && (lang === "all" || q.lang === lang)), [questions, source, lang]);

  useEffect(() => () => cleanup(), []);
  function cleanup() {
    window.clearInterval(timer.current);
    rec.current?.stop();
    rec.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    stt.current?.abort?.();
  }

  const pick = (q: DrillQuestion) => {
    cleanup();
    setCurrent(q);
    setJobId(q.jobId);
    setPhase("idle");
    setResult(null);
    setTyped("");
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const speak = () => {
    if (!current || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(current.question);
    u.lang = current.lang === "de" ? "de-DE" : "en-GB";
    u.rate = 0.97;
    speechSynthesis.speak(u);
  };

  const startRec = async () => {
    if (!current) return;
    setErr("");
    if (browserStt && !browserSttSupported()) {
      setErr("This browser has no built-in speech recognition. Use Chrome or Edge, pick a speech-to-text service on Integrations, or type your answer.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const r = new Recorder();
      await r.start(stream.current);
      r.onTick = (t) => setLevel(t.level);
      rec.current = r;
      if (browserStt) {
        stt.current = new BrowserStt();
        stt.current.start(current.lang);
      }
      r.beginAnswer();
      const t0 = Date.now();
      setSecs(0);
      setCaption("");
      timer.current = window.setInterval(() => {
        setSecs(Math.round((Date.now() - t0) / 1000));
        if (stt.current) setCaption(stt.current.peek());
      }, 400);
      setPhase("recording");
    } catch {
      setErr("Microphone access was blocked. Allow it in the browser, or type your answer instead.");
      cleanup();
    }
  };

  const submit = async (fromVoice: boolean) => {
    if (!current) return;
    const fd = new FormData();
    let durationMs = 0;
    let acoustic;
    if (fromVoice && rec.current) {
      window.clearInterval(timer.current);
      const ans = rec.current.endAnswer();
      durationMs = ans.durationMs;
      acoustic = ans.acoustic;
      fd.append("audio", ans.wav, "answer.wav");
      if (stt.current) fd.append("transcript", await stt.current.stop());
      cleanup();
    } else {
      fd.append("transcript", typed);
    }
    fd.append("meta", JSON.stringify({ question: current.question, competency: current.competency, lang: current.lang, jobId, durationMs, acoustic }));
    setPhase("scoring");
    try {
      const r = await api<{ attempt: AnswerAttempt; history: { createdAt: string; content: number }[] }>("/api/attempts", { form: fd });
      setResult(r);
      setPhase("result");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  };

  const prev = result && result.history.length > 1 ? result.history[result.history.length - 2].content : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] [&>*]:min-w-0">
      <div className="space-y-4">
        {!hasCv && <ErrorNote text="Upload your CV first: answers are judged against your real background." />}
        {!current ? (
          <div className="hero flex min-h-64 flex-col justify-center rounded-3xl p-8 shadow-lift">
            <Icon name="bolt" className="h-8 w-8 text-[#f0b155]" />
            <h2 className="mt-3 font-serif text-2xl font-semibold">Pick a question to drill</h2>
            <p className="mt-1 max-w-md text-white/80">Start with “My weak answers”: they are the answers that cost you points in mock interviews.</p>
          </div>
        ) : (
          <section className="hero rounded-3xl p-6 shadow-lift sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/75">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5">{COMPETENCY_LABELS[current.competency]}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5">{current.lang === "de" ? "Deutsch" : "English"}</span>
              {current.trend.count > 0 && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{current.trend.count} attempt{current.trend.count === 1 ? "" : "s"} · best {current.trend.best}</span>}
            </div>
            <p className="mt-4 font-serif text-2xl leading-snug sm:text-[1.7rem]">“{current.question}”</p>
            {current.hint && <p className="mt-3 text-sm text-white/70">{current.source === "weak" ? `Last time you missed: ${current.hint}` : current.source === "real" ? `In the real interview: ${current.hint}` : current.hint}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={speak} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
                <Icon name="volume" /> Hear it
              </button>
              <select className="order-last w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white sm:order-none sm:w-auto sm:max-w-xs" value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Judge for job">
                <option value="" className="text-black">General supply-chain role</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id} className="text-black">{j.label}</option>
                ))}
              </select>
              <div className="flex rounded-xl bg-white/10 p-1 text-sm sm:ml-auto">
                {(["voice", "type"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1 ${mode === m ? "bg-white text-[#0f2a24]" : "text-white/80"}`}>
                    {m === "voice" ? "Speak" : "Type"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-black/15 p-4">
              {mode === "type" ? (
                <div className="space-y-3">
                  <textarea className="field min-h-36 !bg-white/95 !text-[#15201d]" placeholder="Write the answer you would say out loud…" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={phase === "scoring"} />
                  <Button onClick={() => submit(false)} busy={phase === "scoring"} disabled={typed.trim().split(/\s+/).length < 5} className="!bg-[#e59a2f] !text-[#0f2a24]">
                    Score my answer
                  </Button>
                </div>
              ) : phase === "recording" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f08a78] opacity-70" /><span className="relative inline-flex h-3 w-3 rounded-full bg-[#f08a78]" /></span>
                    <span className="tabular-nums">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#f0b155] transition-all" style={{ width: `${Math.round(level * 100)}%` }} /></div>
                  </div>
                  {caption && <p className="max-h-28 overflow-y-auto text-sm text-white/80">{caption}</p>}
                  <Button onClick={() => submit(true)} className="!bg-white !text-[#0f2a24]">Done, score it</Button>
                  <p className="text-xs text-white/60">Aim for 60–120 seconds: situation, what you did, the result with a number.</p>
                </div>
              ) : (
                <Button onClick={startRec} busy={phase === "scoring"} className="!bg-[#e59a2f] !text-[#0f2a24]">
                  <Icon name="mic" /> {phase === "scoring" ? "Scoring…" : phase === "result" ? "Try again" : "Start answering"}
                </Button>
              )}
            </div>
          </section>
        )}
        <ErrorNote text={err} />

        {result && (
          <section className="fade-in space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-5">
              <ScoreRing score={result.attempt.content} size={84} label="content" />
              <div className="min-w-0 flex-1">
                {prev != null ? (
                  <p className="text-lg font-semibold">
                    {result.attempt.content - prev >= 0 ? "▲" : "▼"} {Math.abs(result.attempt.content - prev)} points vs last attempt
                  </p>
                ) : (
                  <p className="text-lg font-semibold">First attempt on this question</p>
                )}
                <p className="text-sm text-muted">{result.attempt.scores.answerSummary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <Pill>{result.attempt.durationSec}s</Pill>
                  <Pill tone={result.attempt.delivery.wpm > 170 || result.attempt.delivery.wpm < 95 ? "warn" : "good"}>{result.attempt.delivery.wpm} wpm</Pill>
                  <Pill tone={result.attempt.delivery.fillersPerMin > 6 ? "warn" : "good"}>{result.attempt.delivery.fillersPerMin} fillers/min</Pill>
                </div>
              </div>
            </div>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {DIMS.map((d) => {
                const v = result.attempt.scores[d];
                return (
                  <div key={d} className="text-sm">
                    <div className="flex justify-between"><span>{DIM_LABEL[d]}</span><span className="tabular-nums text-muted">{v}/5</span></div>
                    <div className="mt-1 flex gap-1">{[1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= v ? (v >= 4 ? "bg-good" : v === 3 ? "bg-warn" : "bg-bad") : "bg-surface-2"}`} />)}</div>
                  </div>
                );
              })}
            </div>
            {result.attempt.scores.costlyQuote && (
              <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">Cost you points: “{result.attempt.scores.costlyQuote}”</p>
            )}
            <div className="text-sm"><b>Missing:</b> {result.attempt.scores.whatWasMissing}</div>
            <details className="rounded-xl bg-accent-soft p-4 text-sm" open>
              <summary className="cursor-pointer font-semibold text-accent">A stronger answer from your own background</summary>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{result.attempt.scores.modelAnswer}</p>
            </details>
            <details className="text-sm text-muted">
              <summary className="cursor-pointer">What you said</summary>
              <p className="mt-1">{result.attempt.transcript}</p>
            </details>
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((s) => {
              const n = questions.filter((q) => q.source === s.id).length;
              return (
                <button key={s.id} onClick={() => setSource(s.id)} className={`rounded-full px-3 py-1 text-xs ${source === s.id ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink"}`}>
                  {s.label} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5 text-xs">
            {(["all", "en", "de"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`rounded-md px-2 py-0.5 ${lang === l ? "bg-ink text-bg" : "text-muted"}`}>{l === "all" ? "All" : l.toUpperCase()}</button>
            ))}
          </div>
          <ul className="mt-3 max-h-[28rem] divide-y divide-line overflow-y-auto">
            {list.length === 0 && <li className="py-6 text-center text-sm text-muted">{source === "weak" ? "Weak answers from scored mock interviews appear here." : source === "real" ? "Log a real interview to drill its questions." : "Nothing here yet."}</li>}
            {list.map((q) => (
              <li key={q.key}>
                <button onClick={() => pick(q)} className={`flex w-full items-start gap-3 py-2.5 text-left text-sm ${current?.key === q.key ? "text-accent" : "hover:text-accent"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{q.question}</span>
                    <span className="text-xs text-muted">{COMPETENCY_LABELS[q.competency]} · {q.lang.toUpperCase()}</span>
                  </span>
                  {q.trend.count > 0 ? (
                    <Pill tone={(q.trend.last ?? 0) >= 75 ? "good" : (q.trend.last ?? 0) >= 55 ? "warn" : "bad"}>{q.trend.last}{q.trend.delta ? ` (${q.trend.delta > 0 ? "+" : ""}${q.trend.delta})` : ""}</Pill>
                  ) : q.lastScore != null ? (
                    <Pill tone="bad">{Math.round(q.lastScore)}</Pill>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {recent.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="mb-2 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-muted">Recent attempts</div>
            <ul className="space-y-2 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="line-clamp-1 flex-1 text-muted">{r.question}</span>
                  <Pill tone={r.content >= 75 ? "good" : r.content >= 55 ? "warn" : "bad"}>{r.content}</Pill>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
