// Webcam presence metrics, computed entirely in the browser with MediaPipe.
// Only numbers leave the device; video is never recorded or uploaded.
import type { PresenceSample } from "../types";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

interface Acc {
  frames: number;
  face: number;
  gaze: number;
  smile: number;
  motion: number;
  motionN: number;
  bright: number;
  brightN: number;
  centered: number;
}
const empty = (): Acc => ({ frames: 0, face: 0, gaze: 0, smile: 0, motion: 0, motionN: 0, bright: 0, brightN: 0, centered: 0 });

function toSample(a: Acc): PresenceSample {
  const pct = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);
  return {
    frames: a.frames,
    facePresentPct: pct(a.face, a.frames),
    gazeAtCameraPct: pct(a.gaze, a.face),
    smilePct: pct(a.smile, a.face),
    headMotion: a.motionN ? Math.round((a.motion / a.motionN) * 10000) / 10000 : 0,
    brightness: a.brightN ? Math.round(a.bright / a.brightN) : 0,
    centeredPct: pct(a.centered, a.face),
  };
}

export class PresenceTracker {
  private landmarker: import("@mediapipe/tasks-vision").FaceLandmarker | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private overall = empty();
  private segment: Acc | null = null;
  private lastNose: { x: number; y: number } | null = null;
  private canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  private tick = 0;
  ready = false;
  error = "";

  async init(video: HTMLVideoElement) {
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
      this.ready = true;
      this.timer = setInterval(() => this.sample(video), 200);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  private brightness(video: HTMLVideoElement): number | null {
    if (!this.canvas || !video.videoWidth) return null;
    this.canvas.width = 32;
    this.canvas.height = 24;
    const g = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(video, 0, 0, 32, 24);
    const d = g.getImageData(0, 0, 32, 24).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return s / (d.length / 4);
  }

  private add(acc: Acc, f: { face: boolean; gaze: boolean; smile: boolean; motion: number | null; bright: number | null; centered: boolean }) {
    acc.frames++;
    if (f.face) acc.face++;
    if (f.gaze) acc.gaze++;
    if (f.smile) acc.smile++;
    if (f.centered) acc.centered++;
    if (f.motion != null) {
      acc.motion += f.motion;
      acc.motionN++;
    }
    if (f.bright != null) {
      acc.bright += f.bright;
      acc.brightN++;
    }
  }

  private sample(video: HTMLVideoElement) {
    if (!this.landmarker || video.readyState < 2) return;
    const res = this.landmarker.detectForVideo(video, performance.now());
    const lm = res.faceLandmarks?.[0];
    const bright = this.tick++ % 5 === 0 ? this.brightness(video) : null;
    if (!lm) {
      this.lastNose = null;
      const f = { face: false, gaze: false, smile: false, motion: null, bright, centered: false };
      this.add(this.overall, f);
      if (this.segment) this.add(this.segment, f);
      return;
    }
    const bs: Record<string, number> = {};
    for (const c of res.faceBlendshapes?.[0]?.categories ?? []) bs[c.categoryName] = c.score;
    const nose = lm[1];
    const left = lm[234];
    const right = lm[454];
    const top = lm[10];
    const chin = lm[152];
    const hr = (nose.x - left.x) / Math.max(1e-6, right.x - left.x);
    const vr = (nose.y - top.y) / Math.max(1e-6, chin.y - top.y);
    const headFacing = Math.abs(hr - 0.5) < 0.13 && vr > 0.38 && vr < 0.72;
    const eyeOff = Math.max(
      ((bs.eyeLookOutLeft ?? 0) + (bs.eyeLookInRight ?? 0)) / 2,
      ((bs.eyeLookInLeft ?? 0) + (bs.eyeLookOutRight ?? 0)) / 2,
      ((bs.eyeLookUpLeft ?? 0) + (bs.eyeLookUpRight ?? 0)) / 2,
      ((bs.eyeLookDownLeft ?? 0) + (bs.eyeLookDownRight ?? 0)) / 2,
    );
    const gaze = headFacing && eyeOff < 0.45;
    const smile = ((bs.mouthSmileLeft ?? 0) + (bs.mouthSmileRight ?? 0)) / 2 > 0.45;
    const motion = this.lastNose ? Math.hypot(nose.x - this.lastNose.x, nose.y - this.lastNose.y) : null;
    this.lastNose = { x: nose.x, y: nose.y };
    const centered = nose.x > 0.3 && nose.x < 0.7 && nose.y > 0.25 && nose.y < 0.75;
    const f = { face: true, gaze, smile, motion, bright, centered };
    this.add(this.overall, f);
    if (this.segment) this.add(this.segment, f);
  }

  beginSegment() {
    this.segment = empty();
  }

  endSegment(): PresenceSample | undefined {
    const s = this.segment;
    this.segment = null;
    return s && s.frames ? toSample(s) : undefined;
  }

  overallSample(): PresenceSample {
    return toSample(this.overall);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.landmarker?.close();
    this.landmarker = null;
  }
}
