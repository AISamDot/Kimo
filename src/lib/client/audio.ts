// Browser-side audio maths: WAV encoding, resampling and acoustic summaries.
// Pure functions (no DOM) so they are unit-tested.
import type { AcousticSummary } from "../types";

export interface Frame {
  t: number; // seconds since answer start
  db: number;
  voiced: boolean;
  pitch: number; // Hz, 0 if none
}

export function rmsDb(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return 20 * Math.log10(Math.sqrt(s / Math.max(1, x.length)) + 1e-9);
}

/** Autocorrelation pitch estimate (70–400 Hz). Returns 0 when no clear periodicity. */
export function estimatePitch(x: Float32Array, sampleRate: number): number {
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.min(Math.floor(sampleRate / 70), x.length - 1);
  let energy = 0;
  for (let i = 0; i < x.length; i++) energy += x[i] * x[i];
  if (energy < 1e-6) return 0;
  let best = 0;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i + lag < x.length; i++) c += x[i] * x[i + lag];
    const norm = c / energy;
    if (norm > best) {
      best = norm;
      bestLag = lag;
    }
  }
  return best > 0.5 && bestLag ? sampleRate / bestLag : 0;
}

export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = start; j < end; j++) s += input[j];
    out[i] = end > start ? s / (end - start) : input[start] ?? 0;
  }
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Summarise one answer from its per-frame energy/pitch track. */
export function summarize(frames: Frame[], frameSec: number): AcousticSummary & { firstVoiced: number; lastVoiced: number } {
  const voiced = frames.filter((f) => f.voiced);
  if (!voiced.length) {
    return { durationSec: 0, speechSec: 0, longPauses: 0, longestPauseSec: 0, meanDb: -90, dbSd: 0, pitchMedianHz: 0, pitchSdSemitones: 0, endDropDb: 0, voicedRatio: 0, firstVoiced: 0, lastVoiced: 0 };
  }
  const first = voiced[0].t;
  const last = voiced[voiced.length - 1].t + frameSec;
  // pauses: unvoiced runs between first and last voiced frame
  let longPauses = 0;
  let longest = 0;
  let runStart = -1;
  for (const f of frames) {
    if (f.t < first || f.t > last) continue;
    if (!f.voiced) {
      if (runStart < 0) runStart = f.t;
    } else if (runStart >= 0) {
      const len = f.t - runStart;
      if (len >= 3) longPauses++;
      longest = Math.max(longest, len);
      runStart = -1;
    }
  }
  const dbs = voiced.map((f) => f.db);
  const pitches = voiced.map((f) => f.pitch).filter((p) => p > 0);
  const pMed = median(pitches);
  const semis = pMed ? pitches.map((p) => 12 * Math.log2(p / pMed)) : [];
  const k = Math.max(1, Math.floor(voiced.length * 0.3));
  const endDrop = mean(voiced.slice(-k).map((f) => f.db)) - mean(voiced.slice(0, k).map((f) => f.db));
  const durationSec = last - first;
  const speechSec = voiced.length * frameSec;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    durationSec: r1(durationSec),
    speechSec: r1(speechSec),
    longPauses,
    longestPauseSec: r1(longest),
    meanDb: r1(mean(dbs)),
    dbSd: r1(sd(dbs)),
    pitchMedianHz: Math.round(pMed),
    pitchSdSemitones: r1(sd(semis)),
    endDropDb: r1(endDrop),
    voicedRatio: durationSec > 0 ? Math.round((speechSec / durationSec) * 100) / 100 : 0,
    firstVoiced: first,
    lastVoiced: last,
  };
}
