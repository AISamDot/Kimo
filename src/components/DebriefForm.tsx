"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/types";
import { api, Button, ErrorNote } from "./client";
import { Icon } from "./ui";

export function DebriefForm({ apps }: { apps: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ applicationId: apps[0]?.id ?? "", date: new Date().toISOString().slice(0, 10), stage: "interview1" as Stage, language: "en", interviewers: "", feeling: 3, notes: "" });
  const [qs, setQs] = useState([{ q: "", myAnswer: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }));

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="hero flex w-full items-center gap-4 rounded-3xl p-6 text-left shadow-lift">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Icon name="clipboard" className="h-6 w-6" /></span>
        <span>
          <span className="block font-serif text-xl font-semibold">Just had an interview?</span>
          <span className="text-sm text-white/75">Log it while it is fresh. Takes 5 minutes.</span>
        </span>
        <Icon name="arrow" className="ml-auto h-5 w-5" />
      </button>
    );
  }

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("/api/debriefs", { body: { ...f, questions: qs } }); // analysed in the background
      setOpen(false);
      setQs([{ q: "", myAnswer: "" }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in space-y-4 rounded-2xl border border-accent/40 bg-surface p-5 shadow-lift sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium sm:col-span-2">
          Application
          <select className="field mt-1" value={f.applicationId} onChange={(e) => set("applicationId", e.target.value)}>
            <option value="">(not logged yet)</option>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Date<input type="date" className="field mt-1" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
        <label className="text-sm font-medium">
          Stage
          <select className="field mt-1" value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            {STAGES.filter((s) => s !== "applied" && s !== "offer").map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Language
          <select className="field mt-1" value={f.language} onChange={(e) => set("language", e.target.value)}>
            <option value="en">English</option>
            <option value="de">German</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">Who interviewed you<input className="field mt-1" placeholder="e.g. HR + team lead logistics" value={f.interviewers} onChange={(e) => set("interviewers", e.target.value)} /></label>
        <label className="text-sm font-medium">
          How did it feel? <b>{f.feeling}/5</b>
          <input type="range" min={1} max={5} className="mt-3 w-full accent-[var(--accent)]" value={f.feeling} onChange={(e) => set("feeling", Number(e.target.value))} />
        </label>
      </div>
      <div className="space-y-3">
        <div className="text-sm font-semibold">What they asked and what you said</div>
        {qs.map((q, i) => (
          <div key={i} className="grid gap-2 rounded-xl bg-surface-2/60 p-3 md:grid-cols-[1fr_1.4fr_auto]">
            <input className="field" placeholder={`Question ${i + 1}`} value={q.q} onChange={(e) => setQs(qs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            <textarea className="field" rows={2} placeholder="Roughly what you answered" value={q.myAnswer} onChange={(e) => setQs(qs.map((x, j) => (j === i ? { ...x, myAnswer: e.target.value } : x)))} />
            <button className="self-start p-2 text-muted hover:text-bad" title="Remove" onClick={() => setQs(qs.length > 1 ? qs.filter((_, j) => j !== i) : qs)}>
              <Icon name="x" />
            </button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setQs([...qs, { q: "", myAnswer: "" }])}>+ Another question</Button>
      </div>
      <label className="block text-sm font-medium">Anything else? (their reactions, what felt off, salary/visa talk)<textarea className="field mt-1" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      <ErrorNote text={err} />
      <div className="flex gap-2">
        <Button busy={busy} onClick={submit}>{busy ? "Analysing…" : "Analyse my interview"}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
