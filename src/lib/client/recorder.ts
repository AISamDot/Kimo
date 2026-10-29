// Microphone recorder with voice-activity detection, built on an AudioWorklet.
import { encodeWav, estimatePitch, resample, rmsDb, summarize, type Frame } from "./audio";
import type { AcousticSummary } from "../types";

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('tap', Tap);
`;

export interface Tick {
  level: number; // 0..1 for meters
  speaking: boolean;
  speechStarted: boolean;
  silenceMs: number;
  elapsedMs: number;
  speechElapsedMs: number;
  voicedMs: number; // total time he has actually been speaking this answer
}

/** Rolling noise floor: a low percentile of recent loudness, so steady room noise (fans, traffic) is ignored. */
export function noiseFloor(recent: number[]) {
  if (!recent.length) return -55;
  const sorted = [...recent].sort((a, b) => a - b);
  return Math.max(-75, Math.min(-30, sorted[Math.floor(sorted.length * 0.15)]));
}

/** Voice must clear the floor by this much (dB), within sane absolute limits. */
export const voiceThreshold = (floor: number) => Math.min(-25, Math.max(-52, floor + 10));

export interface Answer {
  wav: Blob;
  acoustic: AcousticSummary;
  durationMs: number;
  offsetMs: number; // when speech started, relative to beginAnswer()
}

export class Recorder {
  ctx!: AudioContext;
  private node!: AudioWorkletNode;
  private recent: number[] = []; // last ~3 s of chunk loudness (dB)
  private run = 0; // consecutive voiced chunks
  private voicedMs = 0;
  private recording = false;
  private chunks: Float32Array[] = [];
  private frames: Frame[] = [];
  private startedAt = 0;
  private lastVoiceAt = 0;
  private firstVoiceAt = 0;
  onTick: (t: Tick) => void = () => {};
  level = 0;

  async start(stream: MediaStream) {
    this.ctx = new AudioContext();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await this.ctx.audioWorklet.addModule(url);
    const src = this.ctx.createMediaStreamSource(stream);
    this.node = new AudioWorkletNode(this.ctx, "tap");
    src.connect(this.node);
    this.node.port.onmessage = (e) => this.onChunk(e.data as Float32Array);
  }

  get sampleRate() {
    return this.ctx.sampleRate;
  }

  private onChunk(x: Float32Array) {
    const db = rmsDb(x);
    const chunkMs = (x.length / this.ctx.sampleRate) * 1000;
    this.recent.push(db);
    if (this.recent.length > Math.round(3000 / chunkMs)) this.recent.shift();
    const voiced = db > voiceThreshold(noiseFloor(this.recent));
    this.run = voiced ? this.run + 1 : 0;
    // A click, breath or tap is one chunk; real speech lasts at least ~90 ms.
    const speech = this.run >= 2;
    this.level = Math.max(0, Math.min(1, (db + 60) / 45));
    const now = performance.now();
    if (!this.recording) {
      this.onTick({ level: this.level, speaking: speech, speechStarted: false, silenceMs: 0, elapsedMs: 0, speechElapsedMs: 0, voicedMs: 0 });
      return;
    }
    this.chunks.push(x);
    const t = (now - this.startedAt) / 1000;
    this.frames.push({ t, db, voiced, pitch: voiced ? estimatePitch(x, this.ctx.sampleRate) : 0 });
    if (speech) {
      if (!this.firstVoiceAt) this.firstVoiceAt = now;
      this.lastVoiceAt = now;
      this.voicedMs += chunkMs;
    }
    this.onTick({
      level: this.level,
      speaking: speech,
      speechStarted: !!this.firstVoiceAt,
      silenceMs: this.firstVoiceAt ? now - this.lastVoiceAt : 0,
      elapsedMs: now - this.startedAt,
      speechElapsedMs: this.firstVoiceAt ? now - this.firstVoiceAt : 0,
      voicedMs: this.voicedMs,
    });
  }

  beginAnswer() {
    this.chunks = [];
    this.frames = [];
    this.firstVoiceAt = 0;
    this.lastVoiceAt = 0;
    this.voicedMs = 0;
    this.run = 0;
    this.startedAt = performance.now();
    this.recording = true;
  }

  cancelAnswer() {
    this.recording = false;
    this.chunks = [];
    this.frames = [];
  }

  endAnswer(): Answer {
    this.recording = false;
    const sr = this.ctx.sampleRate;
    const frameSec = 2048 / sr;
    const sum = summarize(this.frames, frameSec);
    const all = new Float32Array(this.chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of this.chunks) {
      all.set(c, o);
      o += c.length;
    }
    // trim to the spoken part (+0.3 s padding) and convert to 16 kHz mono WAV
    const from = Math.max(0, Math.floor((sum.firstVoiced - 0.3) * sr));
    let to = sum.lastVoiced ? Math.min(all.length, Math.ceil((sum.lastVoiced + 0.3) * sr)) : all.length;
    // Hosted deployments cap uploads at ~4.5 MB: use 16 kHz up to ~2 min, then
    // 8 kHz (still fine for speech recognition), and trim beyond ~4 min.
    const MAX_BYTES = 3_800_000;
    const secs = (to - from) / sr;
    const outRate = secs * 16000 * 2 <= MAX_BYTES ? 16000 : 8000;
    const maxSecs = MAX_BYTES / (outRate * 2);
    if (secs > maxSecs) to = from + Math.floor(maxSecs * sr);
    const pcm = resample(all.subarray(from, Math.max(from, to)), sr, outRate);
    const { firstVoiced, lastVoiced: _l, ...acoustic } = sum;
    return {
      wav: new Blob([encodeWav(pcm, outRate) as BlobPart], { type: "audio/wav" }),
      acoustic,
      durationMs: Math.round(acoustic.durationSec * 1000),
      offsetMs: Math.round(firstVoiced * 1000),
    };
  }

  stop() {
    this.recording = false;
    this.node?.disconnect();
    this.ctx?.close().catch(() => undefined);
  }
}
