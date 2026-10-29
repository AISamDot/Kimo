"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Button, ErrorNote } from "./client";

const TYPES = [
  ["hr", "HR screen", "Motivation, CV walkthrough, visa, salary, start date, a German check"],
  ["manager", "Hiring manager", "Behavioural (STAR) questions, ownership, real depth"],
  ["technical", "Technical / case", "Inventory, forecasting, S&OP, KPIs, spoken case maths"],
  ["german", "German round", "The whole interview in German"],
  ["pressure", "Pressure round", "Sceptical panel, interruptions, deep probing"],
] as const;

export function InterviewSetup({
  jobs,
  resumes,
  defaultJob,
  hasKey,
}: {
  jobs: { id: string; label: string }[];
  resumes: { id: string; label: string }[];
  defaultJob?: string;
  hasKey: boolean;
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState(defaultJob ?? jobs[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [type, setType] = useState<string>("hr");
  const [language, setLanguage] = useState("en");
  const [difficulty, setDifficulty] = useState("realistic");
  const [lengthMin, setLength] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const start = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ sessionId: string }>("/api/interview", { body: { jobId, resumeId, type, language, difficulty, lengthMin } });
      router.push(`/interview/${r.sessionId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const seg = (value: string | number, set: (v: never) => void, options: [string | number, string][]) => (
    <div className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1 text-sm">
      {options.map(([v, l]) => (
        <button key={String(v)} onClick={() => set(v as never)} className={`flex-1 rounded-md px-3 py-1.5 whitespace-nowrap ${value === v ? "bg-surface font-medium shadow-sm" : "text-muted"}`}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Job ad
          <select className="field mt-1" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          CV version
          <select className="field mt-1" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-2 text-sm">Interview type</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map(([v, l, d]) => (
            <button
              key={v}
              onClick={() => {
                setType(v);
                if (v === "german") setLanguage("de");
              }}
              className={`rounded-xl border p-3 text-left ${type === v ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"}`}
            >
              <div className="text-sm font-semibold">{l}</div>
              <div className="text-xs text-muted">{d}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="text-sm">
          <div className="mb-1">Language</div>
          {type === "german"
            ? seg("de", () => undefined, [["de", "German"]])
            : seg(language, setLanguage, [
                ["en", "English"],
                ["de", "German"],
                ["mixed", "Mixed"],
              ])}
        </div>
        <div className="text-sm">
          <div className="mb-1">Difficulty</div>
          {seg(difficulty, setDifficulty, [
            ["friendly", "Friendly"],
            ["realistic", "Realistic"],
            ["tough", "Tough"],
          ])}
        </div>
        <div className="text-sm">
          <div className="mb-1">Length</div>
          {seg(lengthMin, setLength, [
            [10, "10 min"],
            [20, "20 min"],
            [30, "30 min"],
          ])}
        </div>
      </div>
      {language === "mixed" && type !== "german" && <p className="text-xs text-muted">Mixed: starts in English and switches to German partway, as many German companies do.</p>}

      <ErrorNote text={err} />
      {!hasKey && <p className="text-sm text-warn">A Claude API key is needed. Add it on the Integrations page.</p>}
      <Button onClick={start} busy={busy} disabled={!jobId || !resumeId || !hasKey}>
        {busy ? "Preparing your interviewer… (20–40 s)" : "Prepare interview"}
      </Button>
    </div>
  );
}
