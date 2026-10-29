"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAGE_LABELS, STAGES, type Application } from "@/lib/types";
import { api, Button, ErrorNote } from "./client";

const OUTCOMES = [
  ["active", "In progress"],
  ["rejected", "Rejected"],
  ["ghosted", "No reply"],
  ["withdrawn", "Withdrew"],
  ["offer", "Offer"],
] as const;

const blank = (): Partial<Application> => ({
  company: "",
  role: "",
  date: new Date().toISOString().slice(0, 10),
  stage: "applied",
  outcome: "active",
  interviewLanguage: "",
  roleType: "",
  companySize: "",
  resumeId: "",
  jobId: "",
  feedback: "",
  notes: "",
});

function Form({
  value,
  onChange,
  resumes,
  jobs,
}: {
  value: Partial<Application>;
  onChange: (v: Partial<Application>) => void;
  resumes: { id: string; label: string }[];
  jobs: { id: string; label: string }[];
}) {
  const set = (k: keyof Application) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-muted">Company<input className="field mt-1" value={value.company ?? ""} onChange={set("company")} /></label>
      <label className="text-xs text-muted">Role<input className="field mt-1" value={value.role ?? ""} onChange={set("role")} /></label>
      <label className="text-xs text-muted">Date applied<input type="date" className="field mt-1" value={value.date ?? ""} onChange={set("date")} /></label>
      <label className="text-xs text-muted">
        Furthest stage reached
        <select className="field mt-1" value={value.stage} onChange={set("stage")}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">
        Outcome
        <select className="field mt-1" value={value.outcome} onChange={set("outcome")}>
          {OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">
        Interview language
        <select className="field mt-1" value={value.interviewLanguage} onChange={set("interviewLanguage")}>
          <option value="">n/a</option><option value="en">English</option><option value="de">German</option><option value="mixed">Mixed</option>
        </select>
      </label>
      <label className="text-xs text-muted">Role type<input className="field mt-1" placeholder="planning, procurement…" value={value.roleType ?? ""} onChange={set("roleType")} /></label>
      <label className="text-xs text-muted">
        Company size
        <select className="field mt-1" value={value.companySize} onChange={set("companySize")}>
          <option value="">?</option><option value="startup">Startup</option><option value="mid">Mid-size</option><option value="large">Large</option>
        </select>
      </label>
      <label className="text-xs text-muted">
        CV version used
        <select className="field mt-1" value={value.resumeId} onChange={set("resumeId")}>
          <option value="">?</option>
          {resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">
        Linked job ad
        <select className="field mt-1" value={value.jobId} onChange={set("jobId")}>
          <option value="">none</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted sm:col-span-2">Feedback received (if any)<input className="field mt-1" value={value.feedback ?? ""} onChange={set("feedback")} /></label>
    </div>
  );
}

export function ApplicationsEditor({
  apps,
  resumes,
  jobs,
}: {
  apps: Application[];
  resumes: { id: string; label: string }[];
  jobs: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<Application>>(blank());
  const [editing, setEditing] = useState<Partial<Application> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState<{ id: string; subject: string; body: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState("");

  const save = async (v: Partial<Application>, after: () => void) => {
    setBusy(true);
    setErr("");
    try {
      await api("/api/applications", { body: v });
      after();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const genEmail = async (id: string, lang: "en" | "de") => {
    setEmailBusy(id + lang);
    try {
      const r = await api<{ subject: string; body: string }>(`/api/applications/${id}/email`, { body: { lang } });
      setEmail({ id, ...r });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEmailBusy("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Log an application</h2>
        <Form value={draft} onChange={setDraft} resumes={resumes} jobs={jobs} />
        <div className="mt-3 flex items-center gap-3">
          <Button busy={busy} onClick={() => save(draft, () => setDraft(blank()))}>Add</Button>
          <ErrorNote text={err} />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Your applications ({apps.length})</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-muted">Backfill your past applications too: they are the real evidence for the diagnosis.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...apps].sort((a, b) => b.date.localeCompare(a.date)).map((a) =>
              editing?.id === a.id ? (
                <li key={a.id} className="space-y-3 py-3">
                  <Form value={editing} onChange={setEditing} resumes={resumes} jobs={jobs} />
                  <div className="flex gap-2">
                    <Button busy={busy} onClick={() => save(editing, () => setEditing(null))}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        if (!confirm("Delete this application?")) return;
                        await api(`/api/applications?id=${a.id}`, { method: "DELETE" });
                        setEditing(null);
                        router.refresh();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <div className="font-medium">{a.company} — {a.role}</div>
                    <div className="text-muted">
                      {a.date} · reached {STAGE_LABELS[a.stage]} · {OUTCOMES.find((o) => o[0] === a.outcome)?.[1]}
                      {a.interviewLanguage ? ` · interview in ${a.interviewLanguage.toUpperCase()}` : ""}
                    </div>
                    {a.feedback && <div className="text-muted italic">“{a.feedback}”</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(a.outcome === "rejected" || a.outcome === "ghosted") && (
                      <>
                        <Button variant="ghost" busy={emailBusy === a.id + "en"} onClick={() => genEmail(a.id, "en")}>Ask for feedback (EN)</Button>
                        <Button variant="ghost" busy={emailBusy === a.id + "de"} onClick={() => genEmail(a.id, "de")}>(DE)</Button>
                      </>
                    )}
                    <Button variant="ghost" onClick={() => setEditing(a)}>Edit</Button>
                  </div>
                  {email?.id === a.id && (
                    <div className="w-full rounded-xl bg-surface-2 p-3">
                      <div className="text-xs text-muted">Copy this and send it yourself:</div>
                      <div className="mt-1 font-medium">{email.subject}</div>
                      <pre className="mt-1 font-sans whitespace-pre-wrap">{email.body}</pre>
                      <Button variant="ghost" className="mt-2" onClick={() => navigator.clipboard.writeText(`${email.subject}\n\n${email.body}`)}>Copy</Button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
