import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function scoreTone(score: number | null | undefined) {
  if (score == null) return "bg-surface-2 text-muted";
  if (score >= 75) return "bg-good-soft text-good";
  if (score >= 55) return "bg-warn-soft text-warn";
  return "bg-bad-soft text-bad";
}

export function ScoreBadge({ score, size = "md" }: { score: number | null | undefined; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-16 w-16 text-2xl" : size === "sm" ? "h-7 min-w-7 px-1 text-xs" : "h-10 w-10 text-base";
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-semibold tabular-nums ${cls} ${scoreTone(score)}`}>
      {score == null ? "–" : Math.round(score)}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "accent" }) {
  const t = {
    neutral: "bg-surface-2 text-muted",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    accent: "bg-accent-soft text-accent",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function Empty({ title, children, href, cta }: { title: string; children?: ReactNode; href?: string; cta?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {href && cta && (
        <Link href={href} className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  const cls =
    variant === "primary"
      ? "bg-accent text-accent-ink hover:opacity-90"
      : "border border-line bg-surface hover:bg-surface-2";
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${cls}`}>
      {children}
    </Link>
  );
}

export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = pct >= 75 ? "bg-good" : pct >= 55 ? "bg-warn" : "bg-bad";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const VERDICT_LABEL: Record<string, string> = { strong_no: "Strong no", no: "No", lean_yes: "Leaning yes", yes: "Yes" };
export const VERDICT_TONE: Record<string, "bad" | "warn" | "good"> = { strong_no: "bad", no: "bad", lean_yes: "warn", yes: "good" };

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
