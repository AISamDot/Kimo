"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserStt, browserSttSupported } from "@/lib/client/browserStt";
import { PresenceTracker } from "@/lib/client/presence";
import { Recorder, type Tick } from "@/lib/client/recorder";
import { Speaker, TavusAvatar, type SpeakMode } from "@/lib/client/speaker";
import type { AvatarMode, InterviewType, Lang, SttProvider, TtsProvider } from "@/lib/types";
import { Avatar } from "./Avatar";
import { api, Button, ErrorNote } from "./client";

interface Q {
  text: string;
  lang: Lang;
  kind?: string;
}

export interface RoomProps {
  sessionId: string;
  type: InterviewType;
  typeLabel: string;
  interviewerName: string;
  interviewerTitle: string;
  lengthMin: number;
  turns: { speaker: "interviewer" | "candidate"; text: string; lang: Lang; kind?: string }[];
  elapsedMs: number;
  config: { stt: SttProvider; tts: TtsProvider; avatar: AvatarMode; webcam: boolean; silenceMs: number; pressureMaxAnswerSec: number };
}

type Phase = "intro" | "ready" | "speaking" | "listening" | "thinking" | "paused" | "error" | "ending";

export function InterviewRoom(p: RoomProps) {
  const router = useRouter();
  const [phase, _setPhase] = useState<Phase>("intro");
  const phaseRef = useRef<Phase>("intro");
  const setPhase = (x: Phase) => {
    phaseRef.current = x;
    _setPhase(x);
  };
  const [tick, setTick] = useState<Tick | null>(null);
  const [caption, setCaption] = useState("");
  const [lines, setLines] = useState(p.turns);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [clock, setClock] = useState(p.elapsedMs);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>(p.config.avatar);

  const selfVideo = useRef<HTMLVideoElement>(null);
  const tavusVideo = useRef<HTMLVideoElement>(null);
  const tavusAudio = useRef<HTMLAudioElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const presence = useRef<PresenceTracker | null>(null);
  const speaker = useRef<Speaker | null>(null);
  const stt = useRef<BrowserStt | null>(null);
  const startAt = useRef(0);
  const answerStart = useRef(0);
  const [initialQ] = useState<Q>(() => [...p.turns].reverse().find((t) => t.speaker === "interviewer") ?? { text: "", lang: "en" });
  const currentQ = useRef<Q>(initialQ);
  const lastInterviewerMs = useRef(0);
  const repeats = useRef(0);
  const pending = useRef<FormData | null>(null);
  const lastTickUi = useRef(0);

  const note = (m: string) => setNotices((n) => [...n, m]);
  const useBrowserStt = p.config.stt === "browser";

  const getLevel = useCallback(() => {
    if (phaseRef.current === "speaking") return speaker.current?.level ?? 0;
    return 0;
  }, []);

  // ---------- setup ----------
  const prepare = async () => {
    setError("");
    try {
      if (useBrowserStt && !browserSttSupported()) {
        throw new Error("This browser has no built-in speech recognition. Use Chrome or Edge, or choose a speech-to-text service on the Integrations page.");
      }
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: p.config.webcam ? { width: 640, height: 480 } : false,
      });
      stream.current = s;
      if (p.config.webcam && selfVideo.current) {
        selfVideo.current.srcObject = s;
        await selfVideo.current.play().catch(() => undefined);
      }
      const rec = new Recorder();
      await rec.start(s);
      rec.onTick = onTick;
      recorder.current = rec;
      if (p.config.webcam && selfVideo.current) {
        const pt = new PresenceTracker();
        presence.current = pt;
        pt.init(selfVideo.current).then(() => {
          if (pt.error) note(`Webcam analysis unavailable: ${pt.error}`);
        });
      }
      const mode: SpeakMode = p.config.avatar === "tavus" ? "tavus" : p.config.tts === "browser" ? "browser" : "server";
      const sp = new Speaker(mode, p.sessionId);
      sp.onFallback = note;
      speaker.current = sp;
      if (mode === "tavus") {
        try {
          const t = await api<{ conversationId: string; url: string }>(`/api/interview/${p.sessionId}/tavus`, { body: {} });
          const av = new TavusAvatar();
          await av.join(t.url, t.conversationId, tavusVideo.current!, tavusAudio.current!);
          sp.tavus = av;
        } catch (e) {
          note(`Video avatar failed (${(e as Error).message}); using the animated avatar.`);
          sp.mode = p.config.tts === "browser" ? "browser" : "server";
          setAvatarMode("animated");
        }
      }
      stt.current = useBrowserStt ? new BrowserStt() : null;
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message.includes("Permission") ? "Microphone/camera permission was blocked. Allow it in the browser's address bar and try again." : (e as Error).message);
    }
  };

  const begin = () => {
    // eslint-disable-next-line react-hooks/purity -- runs in a click handler, not during render
    startAt.current = performance.now() - p.elapsedMs;
    runQuestion(currentQ.current);
  };

  // ---------- loop ----------
  const runQuestion = async (q: Q, replay = false) => {
    setPhase("speaking");
    setCaption("");
    const ms = replay ? await speaker.current!.repeat() : await speaker.current!.speak(q.text, q.lang);
    lastInterviewerMs.current = ms;
    if (phaseRef.current !== "speaking") return; // paused / ended meanwhile
    if (q.kind === "end") return finish();
    listen();
  };

  const listen = () => {
    setPhase("listening");
    answerStart.current = performance.now() - startAt.current;
    recorder.current!.beginAnswer();
    presence.current?.beginSegment();
    stt.current?.start(currentQ.current.lang);
  };

  function onTick(t: Tick) {
    // eslint-disable-next-line react-hooks/purity -- audio callback, not render
    const now = performance.now();
    if (now - lastTickUi.current > 100) {
      lastTickUi.current = now;
      setTick(t);
      if (stt.current && phaseRef.current === "listening") setCaption(stt.current.peek());
    }
    if (phaseRef.current !== "listening") return;
    if (t.speechStarted && t.silenceMs >= p.config.silenceMs) submitAnswer(false);
    else if (p.type === "pressure" && t.speechElapsedMs > p.config.pressureMaxAnswerSec * 1000) submitAnswer(true);
  }

  const submitAnswer = async (interrupted: boolean) => {
    if (phaseRef.current !== "listening") return;
    setPhase("thinking");
    const ans = recorder.current!.endAnswer();
    const seg = presence.current?.endSegment();
    const transcript = stt.current ? await stt.current.stop() : "";
    const fd = new FormData();
    if (ans.durationMs > 200) fd.append("audio", ans.wav, "answer.wav");
    fd.append("transcript", transcript);
    fd.append(
      "meta",
      JSON.stringify({
        atMs: Math.round(answerStart.current + ans.offsetMs),
        durationMs: ans.durationMs,
        acoustic: ans.acoustic,
        presence: seg,
        interrupted,
        repeats: repeats.current,
        prevInterviewerDurationMs: lastInterviewerMs.current,
      }),
    );
    pending.current = fd;
    await send();
  };

  const send = async () => {
    if (!pending.current) return;
    setPhase("thinking");
    setError("");
    try {
      const r = await api<{ candidateText: string; interviewer: { text: string; lang: Lang; kind: string }; done: boolean }>(
        `/api/interview/${p.sessionId}/turn`,
        { form: pending.current },
      );
      pending.current = null;
      repeats.current = 0;
      setLines((l) => [...l, { speaker: "candidate", text: r.candidateText || "(no speech detected)", lang: currentQ.current.lang }, { speaker: "interviewer", ...r.interviewer }]);
      currentQ.current = r.interviewer;
      runQuestion(r.interviewer);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  const repeatQuestion = () => {
    if (phaseRef.current !== "listening") return;
    recorder.current!.cancelAnswer();
    presence.current?.endSegment();
    stt.current?.abort();
    repeats.current++;
    runQuestion(currentQ.current, true);
  };

  const pause = () => {
    speaker.current?.stop();
    recorder.current?.cancelAnswer();
    presence.current?.endSegment();
    stt.current?.abort();
    setPhase("paused");
  };

  const cleanup = useCallback(() => {
    speaker.current?.stop();
    stt.current?.abort();
    recorder.current?.stop();
    presence.current?.stop();
    speaker.current?.tavus?.leave();
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const finish = async () => {
    setPhase("ending");
    const pres = presence.current?.overallSample();
    const tav = speaker.current?.tavus;
    cleanup();
    if (tav?.conversationId) fetch(`/api/interview/${p.sessionId}/tavus?conversationId=${encodeURIComponent(tav.conversationId)}`, { method: "DELETE" }).catch(() => undefined);
    try {
      await api(`/api/interview/${p.sessionId}/end`, { body: { presence: pres, repeats: repeats.current, lastInterviewerDurationMs: lastInterviewerMs.current } });
      router.push(`/sessions/${p.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const endEarly = () => {
    if (!window.confirm("End the interview now? You'll get a report on the answers so far.")) return;
    speaker.current?.stop();
    if (phaseRef.current === "listening") {
      recorder.current?.cancelAnswer();
      stt.current?.abort();
    }
    finish();
  };

  // ---------- effects ----------
  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    const live = phase !== "intro" && phase !== "ending";
    const warn = (e: BeforeUnloadEvent) => {
      if (live) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && phaseRef.current === "listening" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        submitAnswer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (phase === "intro" || phase === "ready" || phase === "ending") return;
    const t = setInterval(() => setClock(performance.now() - startAt.current), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ---------- UI ----------
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const status: Record<Phase, string> = {
    intro: "Not started",
    ready: "Ready",
    speaking: `${p.interviewerName} is speaking…`,
    listening: "Your turn: answer out loud",
    thinking: "Interviewer is thinking…",
    paused: "Paused",
    error: "Something went wrong",
    ending: "Wrapping up and starting your report…",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{p.typeLabel}</h1>
          <p className="text-sm text-muted">
            {p.interviewerName}, {p.interviewerTitle}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm tabular-nums text-muted">
          <span>
            {mmss(clock)} / {p.lengthMin}:00
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2" style={{ aspectRatio: "16 / 10" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          {avatarMode === "tavus" ? (
            <video ref={tavusVideo} className="h-full w-full object-cover" playsInline autoPlay />
          ) : avatarMode === "animated" ? (
            <div className="aspect-square h-full">
              <Avatar type={p.type} getLevel={getLevel} listening={phase === "listening"} />
            </div>
          ) : (
            <div className={`h-28 w-28 rounded-full bg-accent-soft ${phase === "speaking" ? "animate-pulse" : ""}`} />
          )}
        </div>
        <audio ref={tavusAudio} autoPlay hidden />
        {p.config.webcam && (
          <video ref={selfVideo} muted playsInline className="absolute right-3 bottom-3 w-28 -scale-x-100 rounded-xl border-2 border-surface shadow sm:w-40" />
        )}
        <div className="absolute top-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-xs font-medium shadow-sm">
          {phase === "listening" && <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-bad align-middle" />}
          {status[phase]}
        </div>
      </div>

      {notices.map((n, i) => (
        <p key={i} className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {n}
        </p>
      ))}
      <ErrorNote text={error} />

      {phase === "intro" && (
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
          <h2 className="font-semibold">Before you start</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Use headphones if you can, in a quiet room. Sit facing a light{p.config.webcam ? ", camera at eye level" : ""}.</li>
            <li>Answer out loud like a real interview. When you stop talking for {Math.round(p.config.silenceMs / 100) / 10}s, your answer is sent. You can also press <b>Space</b> or “I’m done”.</li>
            <li>The interviewer won’t give feedback during the interview. Your full report comes at the end.</li>
            {p.config.webcam && <li>Webcam analysis runs only in this browser; video is never recorded or uploaded.</li>}
            {useBrowserStt && <li>Speech recognition uses your browser’s built-in service (Chrome sends audio to Google). Choose another service on Integrations for better accuracy.</li>}
          </ul>
          <Button className="mt-4" onClick={prepare}>
            Check microphone{p.config.webcam ? " & camera" : ""}
          </Button>
        </div>
      )}

      {phase === "ready" && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex-1">
            <div className="text-sm font-medium">Say something to test your mic</div>
            <div className="mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-good transition-all" style={{ width: `${Math.round((tick?.level ?? 0) * 100)}%` }} />
            </div>
          </div>
          <Button onClick={begin}>Begin interview</Button>
        </div>
      )}

      {(phase === "listening" || phase === "speaking" || phase === "thinking") && (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          {phase === "listening" && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full rounded-full transition-all ${tick?.speaking ? "bg-good" : "bg-line"}`} style={{ width: `${Math.round((tick?.level ?? 0) * 100)}%` }} />
                </div>
                <span className="w-14 text-right text-xs tabular-nums text-muted">{mmss(tick?.speechElapsedMs ?? 0)}</span>
              </div>
              {caption && <p className="text-sm text-muted italic">“{caption}”</p>}
              {tick && !tick.speechStarted && tick.elapsedMs > 15000 && <p className="text-xs text-muted">Take your time. Start speaking whenever you’re ready.</p>}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => submitAnswer(false)} disabled={phase !== "listening"}>
              I’m done answering
            </Button>
            <Button variant="ghost" onClick={repeatQuestion} disabled={phase !== "listening"}>
              Repeat question
            </Button>
            <Button variant="ghost" onClick={pause} disabled={phase === "thinking"}>
              Pause
            </Button>
            <Button variant="danger" onClick={endEarly}>
              End interview
            </Button>
          </div>
        </div>
      )}

      {phase === "paused" && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-4">
          <Button onClick={() => runQuestion(currentQ.current, true)}>Resume (repeat the question)</Button>
          <Button variant="danger" onClick={endEarly}>
            End interview
          </Button>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={send}>Retry sending my answer</Button>
          <Button variant="ghost" onClick={() => runQuestion(currentQ.current, true)}>
            Answer again
          </Button>
          <Button variant="danger" onClick={endEarly}>
            End interview
          </Button>
        </div>
      )}

      <div>
        <button className="text-sm text-accent underline" onClick={() => setShowTranscript(!showTranscript)}>
          {showTranscript ? "Hide transcript" : "Show transcript"}
        </button>
        <p className="text-xs text-muted">Hidden by default, like a real interview.</p>
        {showTranscript && (
          <div className="mt-2 max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-line bg-surface p-4 text-sm">
            {lines.map((l, i) => (
              <p key={i}>
                <b className={l.speaker === "interviewer" ? "text-accent" : ""}>{l.speaker === "interviewer" ? p.interviewerName : "You"}:</b> {l.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
