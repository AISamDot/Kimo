import { describe, expect, it } from "vitest";
import { encodeWav, estimatePitch, resample, rmsDb, summarize, type Frame } from "@/lib/client/audio";

describe("audio maths", () => {
  it("estimates the pitch of a sine wave", () => {
    const sr = 48000;
    const x = new Float32Array(2048).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 150 * i) / sr));
    expect(Math.abs(estimatePitch(x, sr) - 150)).toBeLessThan(3);
  });
  it("returns 0 pitch for silence", () => {
    expect(estimatePitch(new Float32Array(2048), 48000)).toBe(0);
  });
  it("rmsDb of full-scale sine is about -3 dB", () => {
    const x = new Float32Array(4800).map((_, i) => Math.sin((2 * Math.PI * 100 * i) / 48000));
    expect(rmsDb(x)).toBeCloseTo(-3, 0);
  });
  it("resamples to the right length", () => {
    expect(resample(new Float32Array(48000), 48000, 16000).length).toBe(16000);
  });
  it("writes a valid WAV header", () => {
    const wav = encodeWav(new Float32Array(16000), 16000);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(v.getUint32(24, true)).toBe(16000);
    expect(wav.length).toBe(44 + 32000);
  });
  it("summarises pauses and trailing off", () => {
    const f = 0.1;
    const frames: Frame[] = [];
    // 0-5 s speech (loud), 5-9 s silence (long pause), 9-14 s speech (quieter)
    for (let t = 0; t < 14; t += f) {
      const voiced = t < 5 || t >= 9;
      frames.push({ t, db: voiced ? (t < 5 ? -20 : -28) : -60, voiced, pitch: voiced ? 120 : 0 });
    }
    const s = summarize(frames, f);
    expect(s.longPauses).toBe(1);
    expect(s.longestPauseSec).toBeGreaterThanOrEqual(3.9);
    expect(s.durationSec).toBeCloseTo(14, 0);
    expect(s.endDropDb).toBeLessThan(-4);
  });
});
