"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Button, ErrorNote } from "./client";

export function JobReviewRunner({ jobId, resumes, defaultId }: { jobId: string; resumes: { id: string; label: string }[]; defaultId?: string }) {
  const router = useRouter();
  const [rid, setRid] = useState(defaultId ?? resumes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
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
          setBusy(true);
          setErr("");
          try {
            await api(`/api/jobs/${jobId}/review`, { body: { resumeId: rid } });
            router.push(`/jobs/${jobId}?cv=${rid}`);
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Reviewing… (about a minute)" : "Review CV against this ad"}
      </Button>
      <ErrorNote text={err} />
    </div>
  );
}
