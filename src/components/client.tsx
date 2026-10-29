"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.form ? undefined : { "Content-Type": "application/json" },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
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

/** Button that POSTs to an endpoint, shows progress, then refreshes the page. */
export function ActionButton({
  url,
  body,
  method = "POST",
  children,
  busyLabel,
  variant,
  confirm,
  redirectTo,
}: {
  url: string;
  body?: unknown;
  method?: string;
  children: ReactNode;
  busyLabel?: string;
  variant?: "primary" | "ghost" | "danger";
  confirm?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        busy={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setErr("");
          try {
            await api(url, { method, body: body ?? {} });
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && busyLabel ? busyLabel : children}
      </Button>
      {err && <span className="max-w-sm text-xs text-bad">{err}</span>}
    </span>
  );
}

export function ErrorNote({ text }: { text: string }) {
  if (!text) return null;
  return <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{text}</p>;
}
