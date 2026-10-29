"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { storyStrength } from "@/lib/practice";
import { COMPETENCIES, COMPETENCY_LABELS, type Competency, type Story } from "@/lib/types";
import { api, Button, ErrorNote } from "./client";
import { Icon, Pill } from "./ui";

const blank = (): Partial<Story> => ({ title: "", situation: "", task: "", action: "", result: "", metrics: "", competencies: [], answersQuestions: [] });
const STRENGTH = { strong: { tone: "good", label: "Interview-ready" }, ok: { tone: "warn", label: "Needs numbers" }, weak: { tone: "bad", label: "Too thin" } } as const;

export function StoryBank({ stories }: { stories: Story[] }) {
  const [editing, setEditing] = useState<Partial<Story> | null>(null);
  const sorted = [...stories].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setEditing(blank())}>
          + Add a story
        </Button>
      </div>
      {editing && <StoryForm initial={editing} onDone={() => setEditing(null)} />}
      {sorted.length === 0 && !editing ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-10 text-center text-sm text-muted">
          No stories yet. Draft them from your CV or add your own.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((s) => {
            const st = STRENGTH[storyStrength(s)];
            return (
              <article key={s.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-lg font-semibold leading-snug">{s.title}</h3>
                  <Pill tone={st.tone}>{st.label}</Pill>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  {(["situation", "task", "action", "result"] as const).map((k) => (
                    <div key={k} className="grid grid-cols-[1.4rem_1fr] gap-2">
                      <dt className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-[11px] font-bold uppercase text-accent">{k[0]}</dt>
                      <dd className={k === "action" ? "" : "text-muted"}>{s[k] || <i className="text-bad">missing</i>}</dd>
                    </div>
                  ))}
                </dl>
                {s.metrics && <p className="mt-2 rounded-lg bg-signal-soft px-2.5 py-1.5 text-xs text-warn">Numbers to confirm: {s.metrics}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.competencies.map((c) => <Pill key={c} tone="accent">{COMPETENCY_LABELS[c]}</Pill>)}
                </div>
                {s.answersQuestions.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-muted">Answers {s.answersQuestions.length} questions</summary>
                    <ul className="mt-1 list-disc pl-5 text-muted">{s.answersQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
                  </details>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <Button variant="ghost" className="!px-3 !py-1.5" onClick={() => setEditing(s)}>Edit</Button>
                  <DeleteStory id={s.id} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteStory({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="rounded-xl px-3 py-1.5 text-sm text-muted hover:text-bad"
      onClick={async () => {
        if (!confirm("Delete this story?")) return;
        await api(`/api/stories?id=${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}

function StoryForm({ initial, onDone }: { initial: Partial<Story>; onDone: () => void }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Story, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const toggle = (c: Competency) => set("competencies", s.competencies?.includes(c) ? s.competencies.filter((x) => x !== c) : [...(s.competencies ?? []), c]);
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("/api/stories", { body: { story: s } });
      onDone();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const area = (k: "situation" | "task" | "action" | "result", label: string, hint: string, rows = 2) => (
    <label className="block text-sm font-medium">
      {label} <span className="font-normal text-muted">{hint}</span>
      <textarea className="field mt-1" rows={rows} value={(s[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  return (
    <div className="fade-in space-y-3 rounded-2xl border border-accent/40 bg-surface p-5 shadow-lift">
      <div className="flex items-center gap-2 font-semibold"><Icon name="book" className="h-4 w-4 text-accent" /> {s.id ? "Edit story" : "New story"}</div>
      <label className="block text-sm font-medium">
        Title
        <input className="field mt-1" value={s.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Rescuing the late packaging supplier" />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {area("situation", "Situation", "where, when, what was at stake")}
        {area("task", "Task", "what you were responsible for")}
        {area("action", "Action", "what YOU did, step by step (I, not we)", 4)}
        {area("result", "Result", "outcome with a number", 4)}
      </div>
      <label className="block text-sm font-medium">
        Numbers <span className="font-normal text-muted">(volumes, %, € saved, days)</span>
        <input className="field mt-1" value={s.metrics ?? ""} onChange={(e) => set("metrics", e.target.value)} />
      </label>
      <div>
        <div className="mb-1 text-sm font-medium">Proves</div>
        <div className="flex flex-wrap gap-1.5">
          {COMPETENCIES.map((c) => (
            <button key={c} type="button" onClick={() => toggle(c)} className={`rounded-full px-2.5 py-1 text-xs ${s.competencies?.includes(c) ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink"}`}>
              {COMPETENCY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote text={err} />
      <div className="flex gap-2">
        <Button busy={busy} onClick={save}>Save story</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}
