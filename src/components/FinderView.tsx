"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { apifyDailyCost } from "@/lib/apify";
import { REGIONS, REGION_IDS } from "@/lib/regions";
import type { Finder, FoundJob } from "@/lib/types";
import { api, Button, ErrorNote } from "./client";
import { useTasks } from "./TaskTray";
import { Icon, Pill, ScoreRing } from "./ui";

type Tab = "new" | "saved" | "imported" | "dismissed";

const VERDICT: Record<string, { label: string; tone: "good" | "warn" | "bad" }> = {
  apply: { label: "Apply", tone: "good" },
  stretch: { label: "Stretch", tone: "warn" },
  skip: { label: "Skip", tone: "bad" },
};

function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

export function FinderView({
  finder,
  hasCv,
  germanLevel,
  targetCities,
  hasAdzuna,
  hasApify,
}: {
  finder: Finder;
  hasCv: boolean;
  germanLevel: string;
  targetCities: string;
  hasAdzuna: boolean;
  hasApify: boolean;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(finder.prefs);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("new");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState("");
  const [remoteView, setRemoteView] = useState(false);
  // Searches, fit checks and imports run as background tasks; buttons follow the task, not the request.
  const running = new Set(useTasks().filter((t) => t.status === "running").map((t) => t.key));
  const searching = running.has("finder:run");

  const counts = useMemo(() => {
    const c = { new: 0, saved: 0, imported: 0, dismissed: 0 } as Record<Tab, number>;
    for (const j of finder.results) c[j.status]++;
    return c;
  }, [finder.results]);
  const list = finder.results
    .filter((j) => j.status === tab)
    .filter((j) => !q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q.toLowerCase()))
    .filter((j) => !remoteView || j.remote)
    .sort((a, b) => (b.ai?.score ?? b.fit.score) - (a.ai?.score ?? a.fit.score));

  const call = async (label: string, body: unknown) => {
    setBusy(label);
    setErr("");
    try {
      await api("/api/finder", { body });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const search = async () => {
    await call("run", { action: "prefs", prefs });
    await call("run", { action: "run" });
    setTab("new");
  };

  return (
    <div className="space-y-6">
      <section className="hero overflow-hidden rounded-3xl p-5 shadow-lift sm:p-7">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
            <label className="text-xs font-medium text-white/75 sm:col-span-2 lg:col-span-1">
              Search terms (comma separated, English and German)
              <input className="field mt-1 !border-white/20 !bg-white/95 !text-[#15201d]" value={prefs.keywords} onChange={(e) => setPrefs({ ...prefs, keywords: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-white/75">
              Cities (empty = all of Germany)
              <input className="field mt-1 !border-white/20 !bg-white/95 !text-[#15201d]" placeholder={targetCities || "e.g. Hamburg, Berlin"} value={prefs.cities} onChange={(e) => setPrefs({ ...prefs, cities: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-white/75">
              Minimum fit score: <b className="text-white">{prefs.minScore}</b>
              <input type="range" min={0} max={80} step={5} className="mt-3 w-full accent-[#e59a2f]" value={prefs.minScore} onChange={(e) => setPrefs({ ...prefs, minScore: Number(e.target.value) })} />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-xs font-medium text-white/75">Regions</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {REGION_IDS.map((r) => {
                  const on = prefs.regions.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => setPrefs({ ...prefs, regions: on ? prefs.regions.filter((x) => x !== r) : [...prefs.regions, r] })}
                      className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-[#e59a2f] bg-[#e59a2f] text-[#0f2a24]" : "border-white/30 text-white/85 hover:bg-white/10"}`}
                    >
                      {REGIONS[r].label}
                    </button>
                  );
                })}
              </div>
              {prefs.regions.some((r) => r !== "germany") && (
                <p className="mt-1.5 text-xs text-white/70">
                  {hasApify
                    ? `Outside Germany, jobs come from LinkedIn + Indeed via Apify, once a day (about $${apifyDailyCost(prefs.regions).toFixed(2)} per day for these regions).`
                    : "Outside Germany needs an Apify token on Integrations (LinkedIn + Indeed, paid per job)."}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-white/90 sm:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-[#e59a2f]" checked={prefs.entryLevelOnly} onChange={(e) => setPrefs({ ...prefs, entryLevelOnly: e.target.checked })} />
                Hide senior roles
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-[#e59a2f]" checked={prefs.includeRemote} onChange={(e) => setPrefs({ ...prefs, includeRemote: e.target.checked })} />
                Include remote jobs (anywhere)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-[#e59a2f]" checked={prefs.remoteOnly} onChange={(e) => setPrefs({ ...prefs, remoteOnly: e.target.checked, includeRemote: e.target.checked || prefs.includeRemote })} />
                Remote only
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={search} busy={busy === "run" || searching} className="!bg-[#e59a2f] !text-[#0f2a24] hover:!bg-[#f0b155]">
              {!searching && <Icon name="search" />} {searching ? "Searching job boards…" : "Find matching jobs"}
            </Button>
            <span className="text-xs text-white/70">
              {searching
                ? "Takes up to a minute. You can leave this page."
                : finder.lastRun
                  ? `Updated ${ago(finder.lastRun)} · ${finder.lastRunNote}`
                  : "Sources: Arbeitnow" + (hasAdzuna ? " + Adzuna" : "")}
              <span className="block">Refreshes automatically every day and whenever you upload a new CV.</span>
            </span>
          </div>
        </div>
        {(!hasCv || !germanLevel) && (
          <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/90">
            {!hasCv ? "Upload your CV" : "Add your German level in Settings"} so the ranking can judge fit properly.
          </p>
        )}
      </section>

      <ErrorNote text={err} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1 text-sm shadow-card">
          {(["new", "saved", "imported", "dismissed"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 capitalize transition ${tab === t ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}>
              {t === "imported" ? "Added" : t} <span className="tabular-nums opacity-70">{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={() => setRemoteView(!remoteView)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${remoteView ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-ink"}`}
          >
            <Icon name="globe" /> Remote
          </button>
          <input className="field min-w-0 sm:max-w-xs" placeholder="Filter by title, company, city" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-10 text-center text-sm text-muted">
          {finder.results.length === 0 ? "Press “Find matching jobs” to pull live openings." : "Nothing in this list."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((j) => (
            <JobRow key={j.id} j={j} open={openId === j.id} onToggle={() => setOpenId(openId === j.id ? "" : j.id)} busy={busy} running={running} call={call} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobRow({
  j,
  open,
  onToggle,
  busy,
  running,
  call,
}: {
  j: FoundJob;
  open: boolean;
  onToggle: () => void;
  busy: string;
  running: Set<string>;
  call: (label: string, body: unknown) => Promise<void>;
}) {
  const importing = busy === `import:${j.id}` || running.has(`finderimport:${j.id}`);
  const checking = busy === `ai:${j.id}` || running.has(`finderai:${j.id}`);
  const score = j.ai?.score ?? j.fit.score;
  return (
    <li className="rounded-2xl border border-line bg-surface shadow-card transition hover:shadow-lift">
      <div className="flex flex-wrap items-start gap-4 p-4 sm:flex-nowrap">
        <ScoreRing score={score} size={56} stroke={6} label={j.ai ? "AI" : "fit"} />
        <div className="min-w-0 flex-1">
          <button onClick={onToggle} className="text-left">
            <h3 className="font-semibold leading-snug hover:text-accent">{j.title}</h3>
          </button>
          <div className="mt-0.5 text-sm text-muted">
            {j.company} · {j.location || "Germany"} {j.salary && `· ${j.salary}`} · {ago(j.postedAt || j.foundAt)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {j.ai && <Pill tone={VERDICT[j.ai.verdict].tone}>{VERDICT[j.ai.verdict].label}</Pill>}
            {j.remote && (
              <Pill tone="signal">
                <Icon name="globe" className="h-3 w-3" /> Remote
              </Pill>
            )}
            <Pill tone={j.fit.seniority === "entry" ? "good" : j.fit.seniority === "senior" ? "bad" : "neutral"}>{j.fit.seniority === "entry" ? "Entry level" : j.fit.seniority === "senior" ? "Senior" : "Mid level"}</Pill>
            {j.fit.germanNeeded !== "unknown" && <Pill tone={j.fit.germanGap === 0 ? "good" : j.fit.germanGap === 1 ? "warn" : "bad"}>German {j.fit.germanNeeded}</Pill>}
            {j.fit.matched.slice(0, 4).map((m) => (
              <Pill key={m} tone="accent">{m}</Pill>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
          {j.status === "imported" && j.jobId ? (
            <Link href={`/jobs/${j.jobId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
              Open job <Icon name="arrow" />
            </Link>
          ) : (
            <Button
              busy={importing}
              onClick={() => call(`import:${j.id}`, { action: "import", id: j.id })}
              className="!px-3 !py-1.5"
            >
              {importing ? "Adding…" : "Add & practise"}
            </Button>
          )}
          <div className="flex gap-1">
            {j.status !== "saved" && j.status !== "imported" && (
              <button title="Save" onClick={() => call(`s:${j.id}`, { action: "status", id: j.id, status: "saved" })} className="rounded-lg border border-line p-1.5 text-muted hover:text-accent">
                <Icon name="bookmark" />
              </button>
            )}
            {j.status !== "dismissed" && j.status !== "imported" && (
              <button title="Not for me" onClick={() => call(`d:${j.id}`, { action: "status", id: j.id, status: "dismissed" })} className="rounded-lg border border-line p-1.5 text-muted hover:text-bad">
                <Icon name="x" />
              </button>
            )}
            {j.status === "dismissed" && (
              <button onClick={() => call(`n:${j.id}`, { action: "status", id: j.id, status: "new" })} className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:text-ink">
                Restore
              </button>
            )}
            <a href={j.url} target="_blank" rel="noreferrer" title="Open the ad" className="rounded-lg border border-line p-1.5 text-muted hover:text-ink">
              <Icon name="external" />
            </a>
          </div>
        </div>
      </div>
      {open && (
        <div className="fade-in grid gap-4 border-t border-line p-4 text-sm lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <div>
              <div className="mb-1 font-semibold">Why it fits</div>
              <ul className="space-y-1">
                {j.fit.reasons.map((r) => (
                  <li key={r} className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-good" />{r}</li>
                ))}
              </ul>
            </div>
            {j.fit.flags.length > 0 && (
              <div>
                <div className="mb-1 font-semibold">Watch out</div>
                <ul className="space-y-1">
                  {j.fit.flags.map((r) => (
                    <li key={r} className="flex gap-2 text-warn"><Icon name="x" className="mt-0.5 h-4 w-4 shrink-0" />{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {j.ai ? (
              <div className="rounded-xl bg-accent-soft p-3">
                <div className="font-semibold text-accent">Claude’s read</div>
                <p className="mt-1">{j.ai.why}</p>
                {j.ai.risks.length > 0 && <ul className="mt-2 list-disc pl-5 text-muted">{j.ai.risks.map((r) => <li key={r}>{r}</li>)}</ul>}
                <p className="mt-2"><b>Lead with:</b> {j.ai.angle}</p>
              </div>
            ) : (
              <Button variant="ghost" busy={checking} onClick={() => call(`ai:${j.id}`, { action: "ai", id: j.id })}>
                {!checking && <Icon name="sparkle" />} {checking ? "Claude is checking the fit…" : "Deep fit check with Claude"}
              </Button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto whitespace-pre-line rounded-xl bg-surface-2/70 p-3 text-[0.85rem] leading-relaxed text-muted">{j.description}</div>
        </div>
      )}
    </li>
  );
}
