import Link from "next/link";
import type { ReactNode } from "react";

// ---------------- Icons (stroke icons, 24px grid) ----------------

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  cv: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6M9 9h2",
  briefcase: "M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3",
  bolt: "M13 3 4 14h7l-1 7 9-11h-7z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7",
  chat: "M4 5h16v11H8l-4 4zM8 9h8M8 12h5",
  chart: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  clipboard: "M9 4h6v3H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12l2 2 4-4",
  stethoscope: "M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-2M20 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  plug: "M9 2v5M15 2v5M7 7h10v4a5 5 0 0 1-10 0zM12 16v6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7.4 19.6l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.2z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  check: "M5 12.5 10 17l9-10",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  flame: "M12 21c4 0 7-2.7 7-6.5 0-3.5-2.5-5.5-4-8.5-1 2.5-2.5 3.5-3.5 3.5C11 7 11 5 10 3 7 6 5 9.5 5 14.5 5 18.3 8 21 12 21z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  x: "M6 6l12 12M18 6 6 18",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  volume: "M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

// ---------------- Layout ----------------

export function PageHeader({ title, sub, action, eyebrow }: { title: string; sub?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</div>}
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[0.95rem] text-muted">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, action, icon }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && (
            <h2 className="flex items-center gap-2 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-muted">
              {icon && <Icon name={icon} className="h-4 w-4 text-accent" />}
              {title}
            </h2>
          )}
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

function toneVar(score: number | null | undefined) {
  if (score == null) return "var(--line)";
  if (score >= 75) return "var(--good)";
  if (score >= 55) return "var(--warn)";
  return "var(--bad)";
}

export function ScoreBadge({ score, size = "md" }: { score: number | null | undefined; size?: "sm" | "md" | "lg" }) {
  if (size === "lg") return <ScoreRing score={score} size={68} />;
  const cls = size === "sm" ? "h-7 min-w-7 px-1.5 text-xs" : "h-10 min-w-10 px-2 text-base";
  return <span className={`inline-flex items-center justify-center rounded-full font-semibold tabular-nums ${cls} ${scoreTone(score)}`}>{score == null ? "–" : Math.round(score)}</span>;
}

/** Circular score gauge (0-100). */
export function ScoreRing({ score, size = 72, label, stroke = 7, light = false }: { score: number | null | undefined; size?: number; label?: string; stroke?: number; light?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "rgb(255 255 255 / 0.18)" : "var(--surface-2)"} strokeWidth={stroke} />
        {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "#fff" : toneVar(score)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-semibold tabular-nums" style={{ fontSize: size * 0.3 }}>
          {score == null ? "–" : Math.round(score)}
        </span>
        {label && <span className={`mt-0.5 text-[10px] uppercase tracking-wide ${light ? "text-white/70" : "text-muted"}`}>{label}</span>}
      </span>
    </span>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconName }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "accent" | "signal" }) {
  const t = {
    neutral: "bg-surface-2 text-muted",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    accent: "bg-accent-soft text-accent",
    signal: "bg-signal-soft text-warn",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function Empty({ title, children, href, cta, icon = "sparkle" }: { title: string; children?: ReactNode; href?: string; cta?: string; icon?: IconName }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-8 text-center">
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {href && cta && (
        <Link href={href} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-card hover:opacity-90">
          {cta} <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}

export function LinkButton({ href, children, variant = "primary", icon }: { href: string; children: ReactNode; variant?: "primary" | "ghost" | "light"; icon?: IconName }) {
  const cls = {
    primary: "bg-accent text-accent-ink shadow-card hover:bg-accent-2",
    ghost: "border border-line bg-surface hover:bg-surface-2",
    light: "bg-white text-[#0f2a24] hover:bg-white/90",
  }[variant];
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${cls}`}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

export function Meter({ value, max = 100, tone }: { value: number; max?: number; tone?: "accent" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar = tone === "accent" ? "bg-accent" : pct >= 75 ? "bg-good" : pct >= 55 ? "bg-warn" : "bg-bad";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const VERDICT_LABEL: Record<string, string> = { strong_no: "Strong no", no: "No", lean_yes: "Leaning yes", yes: "Yes" };
export const VERDICT_TONE: Record<string, "bad" | "warn" | "good"> = { strong_no: "bad", no: "bad", lean_yes: "warn", yes: "good" };

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
