// Free speech recognition built into Chrome/Edge/Safari (Web Speech API).
// Note: in Chrome the audio is processed by Google's speech service.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function browserSttSupported() {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export class BrowserStt {
  private rec: any = null;
  private finals: string[] = [];
  private interim = "";
  private active = false;

  start(lang: "en" | "de") {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    this.finals = [];
    this.interim = "";
    this.active = true;
    const rec = new SR();
    rec.lang = lang === "de" ? "de-DE" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.finals.push(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      this.interim = interim.trim();
    };
    rec.onend = () => {
      // Chrome stops after a pause; keep listening until we're told to stop.
      if (this.active) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    rec.onerror = () => undefined;
    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* ignore */
    }
  }

  /** Current text so far (finals + interim), for a live caption. */
  peek() {
    return [...this.finals, this.interim].filter(Boolean).join(" ");
  }

  async stop(): Promise<string> {
    this.active = false;
    const rec = this.rec;
    if (!rec) return "";
    // give the recogniser a moment to flush the last phrase
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 900);
      rec.onend = () => {
        clearTimeout(t);
        resolve();
      };
      try {
        rec.stop();
      } catch {
        resolve();
      }
    });
    this.rec = null;
    return this.peek();
  }

  abort() {
    this.active = false;
    try {
      this.rec?.abort();
    } catch {
      /* ignore */
    }
    this.rec = null;
  }
}
