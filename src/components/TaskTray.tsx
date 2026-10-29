"use client";

// Background-task tray: floating cards for slow Claude work (CV reading, reviews, job search…).
// Tasks live on the server, so they survive page changes, reloads and closed tabs.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Task } from "@/lib/types";
import { Icon } from "./ui";

let tasks: Task[] = [];
const subs = new Set<() => void>();
const EMPTY: Task[] = [];
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

function setTasks(next: Task[]) {
  tasks = next;
  emit();
}

/** Called by api() whenever a route answers with a background task. */
export function addTask(t: Task) {
  setTasks([t, ...tasks.filter((x) => x.id !== t.id)]);
}

export function useTasks() {
  return useSyncExternalStore(subscribe, () => tasks, () => EMPTY);
}

export function useRunningTask(key?: string) {
  const all = useTasks();
  return key ? all.find((t) => t.key === key && t.status === "running") : undefined;
}

function elapsed(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

/** Inline "still working" note for a page, e.g. while his CV is being read. */
export function RunningNote({ kinds, children }: { kinds: string[]; children?: React.ReactNode }) {
  const running = useTasks().filter((t) => t.status === "running" && kinds.includes(t.kind));
  if (!running.length) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
      <Spinner />
      <div>
        <div className="font-medium">{running.map((t) => t.label).join(" · ")}…</div>
        <div className="text-xs opacity-80">{children ?? "Running in the background. You can leave this page; it will show up here when ready."}</div>
      </div>
    </div>
  );
}

export function TaskTray({ initial }: { initial: Task[] }) {
  const router = useRouter();
  const list = useTasks();
  const [now, setNow] = useState(() => Date.now());
  const prev = useRef<Map<string, Task["status"]>>(new Map());

  // Seed from the server render (and on every navigation that re-renders the layout).
  useEffect(() => {
    const ids = new Set(initial.map((t) => t.id));
    setTasks([...initial, ...tasks.filter((t) => !ids.has(t.id) && t.status === "running")]);
  }, [initial]);

  const anyRunning = list.some((t) => t.status === "running");

  // Poll while anything runs; refresh the page when something finishes so results appear.
  useEffect(() => {
    if (!anyRunning) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/tasks", { cache: "no-store" });
        if (!r.ok || stop) return;
        const { tasks: fresh } = (await r.json()) as { tasks: Task[] };
        const finished = fresh.some((t) => t.status !== "running" && prev.current.get(t.id) === "running");
        setTasks(fresh);
        if (finished) router.refresh();
      } catch {
        /* offline for a moment; try again next tick */
      }
    };
    const iv = setInterval(tick, 2500);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      clearInterval(iv);
      clearInterval(clock);
    };
  }, [anyRunning, router]);

  useEffect(() => {
    prev.current = new Map(list.map((t) => [t.id, t.status]));
  }, [list]);

  const dismiss = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
    fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dismiss: id }) }).catch(() => undefined);
  };

  if (!list.length) return null;
  return (
    <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96">
      {list.slice(0, 4).map((t, i) => (
        // Phones show the two newest; larger screens up to four.
        <div key={t.id} className={`fade-in pointer-events-auto items-start gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lift sm:p-3.5 ${i < 2 ? "flex" : "hidden sm:flex"}`}>
          <span
            className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
              t.status === "running" ? "bg-accent-soft text-accent" : t.status === "done" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
            }`}
          >
            {t.status === "running" ? <Spinner /> : <Icon name={t.status === "done" ? "check" : "x"} className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{t.label}</div>
            {t.status === "running" && <div className="text-xs text-muted">Working… {elapsed(t.createdAt, now)}<span className="hidden sm:inline"> · you can keep using the app</span></div>}
            {t.status === "done" && (
              <Link href={t.href} onClick={() => dismiss(t.id)} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                Ready. View result <Icon name="arrow" className="h-3.5 w-3.5" />
              </Link>
            )}
            {t.status === "failed" && <div className="mt-0.5 text-xs text-bad">{t.error || "Something went wrong."}</div>}
          </div>
          {t.status !== "running" && (
            <button onClick={() => dismiss(t.id)} title="Dismiss" className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink">
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
