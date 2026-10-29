"use client";

import { useState } from "react";
import { api, Button, ErrorNote } from "./client";
import { useRunningTask } from "./TaskTray";

export function JobReviewRunner({ jobId, resumes, defaultId }: { jobId: string; resumes: { id: string; label: string }[]; defaultId?: string }) {
  const [rid, setRid] = useState(defaultId ?? resumes[0]?.id ?? "");
  const [sending, setSending] = useState(false);
  const running = useRunningTask(`jobreview:${jobId}:${rid}`);
  const busy = sending || !!running;
  const [err, setErr] = useState("");
  if (!resumes.length) return <p className="text-sm text-muted">Upload a CV first.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="field w-auto" value={rid} onChange={(e) => setRid(e.target.value)}>
        {resumes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <Button
        busy={busy}
        onClick={async () => {
          setSending(true);
          setErr("");
          try {
            await api(`/api/jobs/${jobId}/review`, { body: { resumeId: rid } });
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setSending(false);
          }
        }}
      >
        {busy ? "Reviewing… (about a minute)" : "Review CV against this ad"}
      </Button>
      <ErrorNote text={err} />
    </div>
  );
}
