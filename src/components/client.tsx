"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Task } from "@/lib/types";
import { addTask, useRunningTask } from "./TaskTray";

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.form ? undefined : { "Content-Type": "application/json" },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  const task = (data as { task?: Task }).task;
  if (task) addTask(task); // slow work continues on the server; the tray tracks it
  return data as T;
}

export function Button({
  children,
  onClick,
  busy,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  busy?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const cls = {
    primary: "bg-accent text-accent-ink shadow-card hover:bg-accent-2",
    ghost: "border border-line bg-surface hover:bg-surface-2",
    danger: "border border-line bg-surface text-bad hover:bg-bad-soft",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 ${cls} ${className}`}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

/**
 * Button that POSTs to an endpoint, shows progress, then refreshes the page.
 * With `taskKey`, it stays busy for as long as that background task runs — even after leaving and coming back.
 */
export function ActionButton({
  url,
  body,
  method = "POST",
  children,
  busyLabel,
  variant,
  confirm,
  redirectTo,
  taskKey,
}: {
  url: string;
  body?: unknown;
  method?: string;
  children: ReactNode;
  busyLabel?: string;
  variant?: "primary" | "ghost" | "danger";
  confirm?: string;
  redirectTo?: string;
  taskKey?: string;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const running = useRunningTask(taskKey);
  const busy = sending || !!running;
  const [err, setErr] = useState("");
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        busy={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setSending(true);
          setErr("");
          try {
            await api(url, { method, body: body ?? {} });
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setSending(false);
          }
        }}
      >
        {busy && busyLabel ? busyLabel : children}
      </Button>
      {running && <span className="text-xs text-muted">Running in the background. You can leave this page.</span>}
      {err && <span className="max-w-sm text-xs text-bad">{err}</span>}
    </span>
  );
}

export function ErrorNote({ text }: { text: string }) {
  if (!text) return null;
  return <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{text}</p>;
}
