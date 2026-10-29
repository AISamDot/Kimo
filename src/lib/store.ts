import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AppConfig, Profile, SessionDetail, Settings, UserDb } from "./types";

// Storage, with two interchangeable backends:
//   • Local files (default): data/… next to the app. Zero setup; for running on a laptop.
//   • Postgres (when DATABASE_URL is set): for hosted deployments such as Vercel,
//     where the file system doesn't persist. Tables are created automatically.
// Documents (JSON):  "app"  ·  "user/<uid>"  ·  "session/<uid>/<sid>"
// Blobs (audio):     "audio/<uid>/<sid>/<file>"

interface Backend {
  get<T>(key: string): Promise<T | null>;
  /** Atomic read-modify-write of one document. */
  update<T, R>(key: string, fn: (cur: T | null) => { value: T; result: R }): Promise<R>;
  del(key: string): Promise<void>;
  delPrefix(prefix: string): Promise<void>;
  putBlob(key: string, data: Buffer): Promise<void>;
  getBlob(key: string): Promise<Buffer | null>;
  delBlobPrefix(prefix: string): Promise<void>;
  delBlobsOlderThan(cutoff: Date): Promise<void>;
}

// ---------------- file backend ----------------

const DATA_DIR = process.env.BUDDY_DATA_DIR || path.join(process.cwd(), "data");
const safeKey = (k: string) => {
  if (!/^[a-z0-9_./-]+$/i.test(k) || k.includes("..")) throw new Error(`Bad storage key: ${k}`);
  return k;
};
const docPath = (k: string) => path.join(DATA_DIR, `${safeKey(k)}.json`);
const blobPath = (k: string) => path.join(DATA_DIR, "blobs", safeKey(k));

function writeAtomic(file: string, data: string | Buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

const fileBackend: Backend = {
  async get(key) {
    const f = docPath(key);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  },
  async update(key, fn) {
    // Synchronous read-modify-write: atomic within the single Node process.
    const f = docPath(key);
    const cur = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
    const { value, result } = fn(cur);
    writeAtomic(f, JSON.stringify(value, null, 1));
    return result;
  },
  async del(key) {
    fs.rmSync(docPath(key), { force: true });
  },
  async delPrefix(prefix) {
    fs.rmSync(path.join(DATA_DIR, safeKey(prefix)), { recursive: true, force: true });
  },
  async putBlob(key, data) {
    writeAtomic(blobPath(key), data);
  },
  async getBlob(key) {
    const f = blobPath(key);
    return fs.existsSync(f) ? fs.readFileSync(f) : null;
  },
  async delBlobPrefix(prefix) {
    fs.rmSync(blobPath(prefix), { recursive: true, force: true });
  },
  async delBlobsOlderThan(cutoff) {
    const root = path.join(DATA_DIR, "blobs");
    if (!fs.existsSync(root)) return;
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (fs.statSync(p).mtime < cutoff) fs.rmSync(p, { force: true });
      }
    };
    walk(root);
  },
};

// ---------------- postgres backend ----------------

type Sql = import("postgres").Sql;
let sqlPromise: Promise<Sql> | null = null;

function pg(): Promise<Sql> {
  sqlPromise ??= (async () => {
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL!, { max: 3, prepare: false, idle_timeout: 20, onnotice: () => undefined });
    await sql`create table if not exists buddy_kv (key text primary key, value jsonb not null, updated_at timestamptz not null default now())`;
    await sql`create table if not exists buddy_blobs (key text primary key, data bytea not null, created_at timestamptz not null default now())`;
    return sql;
  })();
  return sqlPromise;
}

const likePrefix = (p: string) => `${p.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const pgBackend: Backend = {
  async get<T>(key: string) {
    const sql = await pg();
    const rows = await sql`select value from buddy_kv where key = ${key}`;
    return rows.length ? (rows[0].value as T) : null;
  },
  async update<T, R>(key: string, fn: (cur: T | null) => { value: T; result: R }) {
    const sql = await pg();
    let out: R;
    await sql.begin(async (tx) => {
      await tx`insert into buddy_kv (key, value) values (${key}, 'null'::jsonb) on conflict (key) do nothing`;
      const rows = await tx`select value from buddy_kv where key = ${key} for update`;
      const cur = (rows[0]?.value ?? null) as T | null;
      const { value, result } = fn(cur);
      await tx`update buddy_kv set value = ${tx.json(value as never)}, updated_at = now() where key = ${key}`;
      out = result;
    });
    return out!;
  },
  async del(key) {
    const sql = await pg();
    await sql`delete from buddy_kv where key = ${key}`;
  },
  async delPrefix(prefix) {
    const sql = await pg();
    await sql`delete from buddy_kv where key like ${likePrefix(prefix)}`;
  },
  async putBlob(key, data) {
    const sql = await pg();
    await sql`insert into buddy_blobs (key, data) values (${key}, ${data}) on conflict (key) do update set data = excluded.data, created_at = now()`;
  },
  async getBlob(key) {
    const sql = await pg();
    const rows = await sql`select data from buddy_blobs where key = ${key}`;
    return rows.length ? Buffer.from(rows[0].data as Uint8Array) : null;
  },
  async delBlobPrefix(prefix) {
    const sql = await pg();
    await sql`delete from buddy_blobs where key like ${likePrefix(prefix)}`;
  },
  async delBlobsOlderThan(cutoff) {
    const sql = await pg();
    await sql`delete from buddy_blobs where created_at < ${cutoff}`;
  },
};

const db: Backend = process.env.DATABASE_URL ? pgBackend : fileBackend;
export const STORAGE_KIND = process.env.DATABASE_URL ? "postgres" : "files";

// ---------------- defaults ----------------

export const DEFAULT_SETTINGS: Settings = {
  keys: {
    anthropic: "",
    elevenlabs: "",
    openai: "",
    deepgram: "",
    hume: "",
    azureSpeech: "",
    azureRegion: "westeurope",
    tavus: "",
  },
  models: { interviewer: "claude-opus-5-5", analysis: "claude-opus-5-5", verdict: "claude-opus-5-5" },
  effort: { interviewer: "low", analysis: "medium", verdict: "high" },
  stt: "browser",
  tts: "browser",
  avatar: "animated",
  voices: {
    elevenlabsVoiceId: "JBFqnCBsd6RMkjVDRZzb",
    elevenlabsModel: "eleven_multilingual_v2",
    elevenlabsSttModel: "scribe_v1",
    openaiVoice: "onyx",
    openaiTtsModel: "gpt-4o-mini-tts",
    openaiSttModel: "whisper-1",
    deepgramModel: "nova-3",
  },
  tavus: { replicaId: "", palId: "" },
  features: { webcam: true, hume: true, azurePronunciation: true },
  interview: { silenceMs: 2500, pressureMaxAnswerSec: 150 },
  weights: { content: 45, delivery: 20, language: 20, presence: 15 },
  readiness: { threshold: 75, floor: 60 },
  data: { audioRetentionDays: 30, deleteAudioAfterAnalysis: false },
};

export const DEFAULT_PROFILE: Profile = {
  name: "",
  germanLevel: "",
  germanCertificate: "",
  visaStatus: "",
  earliestStart: "",
  salaryExpectation: "",
  targetCities: "",
  targetRoles: "",
  notes: "",
};

const emptyUserDb = (): UserDb => ({
  profile: DEFAULT_PROFILE,
  resumes: [],
  jobs: [],
  jobReviews: [],
  sessions: [],
  applications: [],
  drills: [],
  diagnoses: [],
});

// Deep-merge saved values over defaults so newly added fields get sensible values.
function mergeDefaults<T>(defaults: T, saved: unknown): T {
  if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) {
    return (saved === undefined ? defaults : saved) as T;
  }
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  const s = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  for (const k of Object.keys(out)) out[k] = mergeDefaults(out[k], s[k]);
  return out as T;
}

function normalizeApp(raw: Partial<AppConfig> | null): AppConfig {
  return {
    settings: mergeDefaults(DEFAULT_SETTINGS, raw?.settings),
    allowSignups: raw?.allowSignups ?? true,
    users: raw?.users ?? [],
    authSessions: raw?.authSessions ?? [],
  };
}

function normalizeUser(raw: Partial<UserDb> | null): UserDb {
  return { ...emptyUserDb(), ...(raw ?? {}), profile: mergeDefaults(DEFAULT_PROFILE, raw?.profile) };
}

// ---------------- app config (shared) ----------------

export async function readApp(): Promise<AppConfig> {
  return normalizeApp(await db.get<AppConfig>("app"));
}

export async function updateApp<R>(fn: (app: AppConfig) => R): Promise<R> {
  return db.update<AppConfig, R>("app", (cur) => {
    const app = normalizeApp(cur);
    const result = fn(app);
    return { value: app, result };
  });
}

export async function getSettings(): Promise<Settings> {
  return (await readApp()).settings;
}

export async function updateSettings(fn: (s: Settings) => void) {
  await updateApp((a) => fn(a.settings));
}

// ---------------- per-user data ----------------

const uidOk = (uid: string) => {
  if (!/^usr_[a-f0-9]+$/.test(uid)) throw new Error("Bad user id");
  return uid;
};
const sidOk = (sid: string) => /^ses_[a-f0-9]+$/.test(sid);

export async function readDb(uid: string): Promise<UserDb> {
  return normalizeUser(await db.get<UserDb>(`user/${uidOk(uid)}`));
}

export async function updateDb<R>(uid: string, fn: (d: UserDb) => R): Promise<R> {
  return db.update<UserDb, R>(`user/${uidOk(uid)}`, (cur) => {
    const d = normalizeUser(cur);
    const result = fn(d);
    return { value: d, result };
  });
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export async function readSession(uid: string, id: string): Promise<SessionDetail | null> {
  if (!sidOk(id)) return null;
  return db.get<SessionDetail>(`session/${uidOk(uid)}/${id}`);
}

function summaryOf(s: SessionDetail) {
  const { plan: _plan, turns: _turns, analysis: _analysis, presenceOverall: _p, repeatRequests: _r, ...summary } = s;
  return summary;
}

async function syncSummary(uid: string, s: SessionDetail) {
  await updateDb(uid, (d) => {
    const i = d.sessions.findIndex((x) => x.id === s.id);
    if (i >= 0) d.sessions[i] = summaryOf(s);
    else d.sessions.push(summaryOf(s));
  });
}

export async function writeSession(uid: string, s: SessionDetail) {
  if (!sidOk(s.id)) throw new Error("Bad session id");
  await db.update<SessionDetail, null>(`session/${uidOk(uid)}/${s.id}`, () => ({ value: s, result: null }));
  await syncSummary(uid, s);
}

export async function updateSession(uid: string, id: string, fn: (s: SessionDetail) => void): Promise<SessionDetail> {
  if (!sidOk(id)) throw new Error("Bad session id");
  const s = await db.update<SessionDetail, SessionDetail>(`session/${uidOk(uid)}/${id}`, (cur) => {
    if (!cur) throw new Error("Session not found");
    fn(cur);
    return { value: cur, result: cur };
  });
  await syncSummary(uid, s);
  return s;
}

export async function deleteSession(uid: string, id: string) {
  if (!sidOk(id)) return;
  await db.del(`session/${uidOk(uid)}/${id}`);
  await deleteSessionAudio(uid, id);
  await updateDb(uid, (d) => {
    d.sessions = d.sessions.filter((s) => s.id !== id);
    d.drills = d.drills.filter((x) => x.sessionId !== id);
  });
}

const audioKey = (uid: string, sid: string, name?: string) =>
  `audio/${uidOk(uid)}/${sid.replace(/[^a-z0-9_]/gi, "")}${name ? `/${name.replace(/[^a-z0-9_.-]/gi, "")}` : "/"}`;

export async function saveAudio(uid: string, sessionId: string, name: string, buf: Buffer): Promise<string> {
  const safe = name.replace(/[^a-z0-9_.-]/gi, "");
  await db.putBlob(audioKey(uid, sessionId, safe), buf);
  return safe;
}

export async function readAudio(uid: string, sessionId: string, name: string): Promise<Buffer | null> {
  return db.getBlob(audioKey(uid, sessionId, name));
}

export async function deleteSessionAudio(uid: string, sessionId: string) {
  await db.delBlobPrefix(audioKey(uid, sessionId));
}

/** Remove answer audio older than the retention window (all users). */
export async function enforceAudioRetention(days: number) {
  if (days > 0) await db.delBlobsOlderThan(new Date(Date.now() - days * 86400_000));
}

export async function wipeUserData(uid: string) {
  await db.del(`user/${uidOk(uid)}`);
  await db.delPrefix(`session/${uid}/`);
  await db.delBlobPrefix(`audio/${uid}/`);
}
