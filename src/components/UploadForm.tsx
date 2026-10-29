"use client";

import { useState } from "react";
import { api, Button, ErrorNote } from "./client";
import { RunningNote } from "./TaskTray";

export function UploadForm({
  endpoint,
  kind,
  allowUrl,
}: {
  endpoint: string;
  kind: "cv" | "job";
  allowUrl?: boolean;
}) {
  const [mode, setMode] = useState<"file" | "text" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setBusy(true);
    setErr("");
    const fd = new FormData();
    if (mode === "file" && file) fd.append("file", file);
    if (mode === "text") fd.append("text", text);
    if (mode === "url") fd.append("url", url);
    if (label) fd.append("label", label);
    try {
      // The server reads it with Claude in the background; the task tray shows progress.
      await api(endpoint, { form: fd });
      setFile(null);
      setText("");
      setUrl("");
      setLabel("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const tabs: ["file" | "text" | "url", string][] = [
    ["file", "Upload file"],
    ["text", "Paste text"],
    ...(allowUrl ? ([["url", "Link"]] as ["url", string][]) : []),
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
        {tabs.map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-md px-3 py-1.5 ${mode === m ? "bg-surface font-medium shadow-sm" : "text-muted"}`}>
            {l}
          </button>
        ))}
      </div>
      {mode === "file" && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm hover:bg-surface-2">
          <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? <span className="font-medium">{file.name}</span> : <span className="text-muted">Choose a PDF, DOCX or TXT file</span>}
        </label>
      )}
      {mode === "text" && (
        <textarea className="field min-h-48" placeholder={kind === "cv" ? "Paste your full CV text" : "Paste the full job ad"} value={text} onChange={(e) => setText(e.target.value)} />
      )}
      {mode === "url" && <input className="field" placeholder="https://… link to the job ad" value={url} onChange={(e) => setUrl(e.target.value)} />}
      {kind === "cv" && <input className="field" placeholder="Label (optional), e.g. 'German version' or 'after review'" value={label} onChange={(e) => setLabel(e.target.value)} />}
      <ErrorNote text={err} />
      <RunningNote kinds={[kind === "cv" ? "cv-read" : "job-read"]}>
        {kind === "cv" ? "Takes about a minute. Then Kimo re-ranks job matches against it. You can leave this page." : "Takes about a minute. You can leave this page."}
      </RunningNote>
      <Button onClick={submit} busy={busy} disabled={(mode === "file" && !file) || (mode === "text" && text.length < 80) || (mode === "url" && !url)}>
        {busy ? "Uploading…" : kind === "cv" ? "Add CV" : "Add job ad"}
      </Button>
    </div>
  );
}
