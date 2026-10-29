"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./client";

export function DrillToggle({ id, status }: { id: string; status: "open" | "passed" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <input
      type="checkbox"
      className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
      checked={status === "passed"}
      disabled={busy}
      aria-label="Mark drill as done"
      onChange={async (e) => {
        setBusy(true);
        await api(`/api/drills/${id}`, { body: { status: e.target.checked ? "passed" : "open" } }).catch(() => undefined);
        setBusy(false);
        router.refresh();
      }}
    />
  );
}
