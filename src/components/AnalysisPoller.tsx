"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AnalysisPoller({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(async () => {
      setSecs((s) => s + 4);
      const r = await fetch(`/api/sessions/${sessionId}`).then((x) => x.json()).catch(() => null);
      if (r && r.status !== "analyzing") router.refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [sessionId, router]);
  return (
    <div className="rounded-2xl border border-line bg-surface p-8 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      <p className="mt-4 font-medium">Scoring your interview…</p>
      <p className="mt-1 text-sm text-muted">Each answer is scored against the rubric, then the hiring verdict is written. Usually 1–3 minutes. ({secs}s)</p>
    </div>
  );
}
