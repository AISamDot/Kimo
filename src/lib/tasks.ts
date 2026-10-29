// Background tasks: slow Claude work runs after the response is sent, so leaving the
// page never loses it. The task tray (TaskTray) polls these and shows progress/results.
import { after } from "next/server";
import { FINDER_STALE_MS, FINDER_TASK, refreshFinder } from "./finder";
import { friendlyError } from "./llm";
import { newId, readDb, updateDb } from "./store";
import type { Task } from "./types";

/** Longest a task can run (route maxDuration is 300 s); older "running" tasks died. */
export const TASK_TIMEOUT_MS = 330_000;

export function sweepStale(tasks: Task[], now = Date.now()): Task[] {
  return tasks.map((t) =>
    t.status === "running" && now - new Date(t.createdAt).getTime() > TASK_TIMEOUT_MS
      ? { ...t, status: "failed", error: "This took too long and was stopped. Please try again.", finishedAt: new Date(now).toISOString() }
      : t,
  );
}

/** Tasks worth showing: running ones, plus results he hasn't dismissed (successes for 10 min, failures for 30). */
export function visibleTasks(tasks: Task[], now = Date.now()): Task[] {
  const keep = (t: Task) => now - new Date(t.finishedAt ?? t.createdAt).getTime() < (t.status === "done" ? 10 : 30) * 60_000;
  return sweepStale(tasks, now)
    .filter((t) => !t.dismissed && (t.status === "running" || keep(t)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
}

export function runningFor(tasks: Task[], key: string): Task | undefined {
  return sweepStale(tasks).find((t) => t.key === key && t.status === "running");
}

/**
 * Starts `work` in the background and returns the task immediately.
 * If the same key is already running, returns that task instead of starting twice.
 * `work` may return a different href (e.g. the id it created).
 */
type Meta = { key: string; kind: string; label: string; href: string };

async function begin(uid: string, meta: Meta): Promise<{ task: Task; fresh: boolean }> {
  const existing = runningFor((await readDb(uid)).tasks, meta.key);
  if (existing) return { task: existing, fresh: false };
  const task: Task = { id: newId("tsk"), ...meta, status: "running", createdAt: new Date().toISOString() };
  await updateDb(uid, (d) => {
    d.tasks = [...sweepStale(d.tasks), task].slice(-40);
  });
  return { task, fresh: true };
}

async function finish(uid: string, task: Task, work: () => Promise<string | void>) {
  let patch: Partial<Task>;
  try {
    const href = await work();
    patch = { status: "done", href: href || task.href };
  } catch (e) {
    console.error(`task ${task.kind} failed`, e);
    patch = { status: "failed", error: friendlyError(e) };
  }
  await updateDb(uid, (d) => {
    const t = d.tasks.find((x) => x.id === task.id);
    if (t) Object.assign(t, patch, { finishedAt: new Date().toISOString() });
  });
}

export async function startTask(uid: string, meta: Meta, work: () => Promise<string | void>): Promise<Task> {
  const { task, fresh } = await begin(uid, meta);
  if (fresh) after(() => finish(uid, task, work));
  return task;
}

/** Same bookkeeping, but runs now and waits — for work already in the background (a chained step, the daily cron). */
export async function runTask(uid: string, meta: Meta, work: () => Promise<string | void>): Promise<void> {
  const { task, fresh } = await begin(uid, meta);
  if (fresh) await finish(uid, task, work);
}

/**
 * If his job matches are more than a day old (the cron missed, or it's a new account with a CV),
 * refresh them in the background. Called from the app layout, so any visit keeps them fresh.
 */
export async function refreshFinderIfStale(uid: string) {
  const db = await readDb(uid);
  if (!db.resumes.length) return;
  if (db.finder.lastRun && Date.now() - new Date(db.finder.lastRun).getTime() < FINDER_STALE_MS) return;
  // Don't retry more than hourly if the job boards were down.
  const tried = db.tasks.find((t) => t.key === FINDER_TASK.key && Date.now() - new Date(t.createdAt).getTime() < 3600_000);
  if (tried || db.tasks.some((t) => t.key.startsWith("cvparse:") && t.status === "running")) return;
  await startTask(uid, FINDER_TASK, async () => {
    await refreshFinder(uid);
  });
}
