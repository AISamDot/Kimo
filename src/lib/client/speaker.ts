// Makes the interviewer talk: server TTS (ElevenLabs/OpenAI), the browser's
// built-in voice, or a Tavus video avatar in echo mode. `level` drives the
// animated avatar's mouth.
import type { Lang } from "../types";

export type SpeakMode = "server" | "browser" | "tavus";

export class Speaker {
  level = 0;
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private lastUrl = "";
  private last: { text: string; lang: Lang } | null = null;
  private cancel: (() => void) | null = null;
  tavus: TavusAvatar | null = null;
  onFallback: (msg: string) => void = () => {};

  constructor(
    public mode: SpeakMode,
    private sessionId: string,
  ) {}

  /** Speaks and resolves when finished. Returns spoken duration in ms. */
  async speak(text: string, lang: Lang, replay = false): Promise<number> {
    this.last = { text, lang };
    const t0 = performance.now();
    if (this.mode === "tavus" && this.tavus) {
      await this.tavus.say(text);
    } else if (this.mode === "server") {
      try {
        await this.playServer(text, lang, replay);
      } catch (e) {
        this.mode = "browser";
        this.onFallback(`Voice service failed (${e instanceof Error ? e.message : e}); using the browser voice instead.`);
        await this.playBrowser(text, lang);
      }
    } else {
      await this.playBrowser(text, lang);
    }
    return Math.round(performance.now() - t0);
  }

  async repeat(): Promise<number> {
    if (!this.last) return 0;
    return this.speak(this.last.text, this.last.lang, true);
  }

  stop() {
    this.cancel?.();
    this.cancel = null;
    this.audio?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.level = 0;
  }

  private ensureAudio() {
    if (this.audio) return this.audio;
    this.audio = new Audio();
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    return this.audio;
  }

  private meter() {
    const a = this.analyser;
    if (!a) return;
    const buf = new Uint8Array(a.fftSize);
    const loop = () => {
      a.getByteTimeDomainData(buf);
      let s = 0;
      for (const v of buf) s += ((v - 128) / 128) ** 2;
      this.level = Math.min(1, Math.sqrt(s / buf.length) * 4);
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    loop();
  }

  private async playServer(text: string, lang: Lang, replay: boolean) {
    const audio = this.ensureAudio();
    await this.ctx?.resume();
    if (!replay || !this.lastUrl) {
      const res = await fetch(`/api/interview/${this.sessionId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      if (this.lastUrl) URL.revokeObjectURL(this.lastUrl);
      this.lastUrl = URL.createObjectURL(await res.blob());
    }
    audio.src = this.lastUrl;
    this.meter();
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        cancelAnimationFrame(this.raf);
        this.level = 0;
        this.cancel = null;
        resolve();
      };
      this.cancel = done;
      audio.onended = done;
      audio.onerror = () => reject(new Error("audio playback failed"));
      audio.play().catch(reject);
    });
  }

  private pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    const score = (v: SpeechSynthesisVoice) =>
      (/(google|premium|enhanced|natural|neural)/i.test(v.name) ? 2 : 0) + (/(de-DE|en-GB|en-US)/i.test(v.lang) ? 1 : 0);
    return voices.sort((a, b) => score(b) - score(a))[0];
  }

  private async playBrowser(text: string, lang: Lang) {
    if (typeof speechSynthesis === "undefined") return;
    if (!speechSynthesis.getVoices().length) {
      await new Promise((r) => {
        speechSynthesis.onvoiceschanged = () => r(null);
        setTimeout(r, 1000);
      });
    }
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "de" ? "de-DE" : "en-GB";
      const v = this.pickVoice(lang);
      if (v) u.voice = v;
      u.rate = 1;
      let t = 0;
      const anim = () => {
        t += 1;
        this.level = 0.25 + 0.35 * Math.abs(Math.sin(t / 3)) * (Math.random() * 0.5 + 0.5);
        this.raf = requestAnimationFrame(anim);
      };
      const done = () => {
        cancelAnimationFrame(this.raf);
        this.level = 0;
        this.cancel = null;
        resolve();
      };
      this.cancel = done;
      u.onend = done;
      u.onerror = done;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      anim();
      // safety net: some browsers never fire onend
      setTimeout(done, Math.max(4000, text.split(/\s+/).length * 600));
    });
  }
}

// ---------------- Tavus (echo mode over Daily) ----------------

export class TavusAvatar {
  private call: import("@daily-co/daily-js").DailyCall | null = null;
  private speakingDone: (() => void) | null = null;
  conversationId = "";

  async join(url: string, conversationId: string, video: HTMLVideoElement, audio: HTMLAudioElement) {
    this.conversationId = conversationId;
    const Daily = (await import("@daily-co/daily-js")).default;
    const call = Daily.createCallObject({ audioSource: false, videoSource: false });
    this.call = call;
    call.on("track-started", (ev) => {
      if (!ev?.participant || ev.participant.local || !ev.track) return;
      const stream = new MediaStream([ev.track]);
      if (ev.track.kind === "video") {
        video.srcObject = stream;
        video.play().catch(() => undefined);
      } else {
        audio.srcObject = stream;
        audio.play().catch(() => undefined);
      }
    });
    call.on("app-message", (ev) => {
      const d = ev?.data as { event_type?: string } | undefined;
      if (d?.event_type === "conversation.replica.stopped_speaking") this.speakingDone?.();
    });
    await call.join({ url });
  }

  async say(text: string) {
    if (!this.call) return;
    const words = text.split(/\s+/).length;
    await new Promise<void>((resolve) => {
      let started = false;
      const finish = () => {
        this.speakingDone = null;
        resolve();
      };
      // fallback in case the stopped_speaking event never arrives
      const t = setTimeout(finish, 2500 + words * 420);
      this.speakingDone = () => {
        if (!started) {
          started = true;
        }
        clearTimeout(t);
        setTimeout(finish, 300);
      };
      this.call!.sendAppMessage(
        {
          message_type: "conversation",
          event_type: "conversation.echo",
          conversation_id: this.conversationId,
          properties: { modality: "text", text, inference_id: `t${Date.now()}`, done: true },
        },
        "*",
      );
    });
  }

  async leave() {
    try {
      await this.call?.leave();
      await this.call?.destroy();
    } catch {
      /* ignore */
    }
    this.call = null;
  }
}
