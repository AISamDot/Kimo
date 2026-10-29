"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Profile } from "@/lib/types";
import { api, Button, ErrorNote } from "./client";

const FIELDS: [keyof Profile, string, string][] = [
  ["name", "Full name", ""],
  ["germanLevel", "German level (self-rated)", "e.g. B1, B2"],
  ["germanCertificate", "German certificate", "e.g. Goethe B2 (2025), or none"],
  ["visaStatus", "Visa / work permit", "e.g. student permit until 03/2027, then 18-month job-seeker permit"],
  ["earliestStart", "Earliest start date", "e.g. immediately / 01.02.2027"],
  ["salaryExpectation", "Salary expectation", "e.g. €48–52k gross per year"],
  ["targetCities", "Target cities", "e.g. Hamburg, Munich, anywhere"],
  ["targetRoles", "Target roles", "e.g. demand planner, procurement analyst, Werkstudent SCM"],
];

export function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, l, ph]) => (
          <label key={k} className="text-xs text-muted">
            {l}
            <input className="field mt-1" placeholder={ph} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <label className="block text-xs text-muted">
        Anything else the interviewer and coach should know
        <textarea className="field mt-1 min-h-20" value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
      </label>
      <div className="flex items-center gap-3">
        <Button
          busy={busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            setMsg("");
            try {
              await api("/api/profile", { body: p });
              setMsg("Saved");
              router.refresh();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save profile
        </Button>
        {msg && <span className="text-sm text-good">{msg}</span>}
        <ErrorNote text={err} />
      </div>
    </div>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">Current password<input type="password" className="field mt-1" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        <label className="text-xs text-muted">New password (8+ characters)<input type="password" className="field mt-1" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            setMsg("");
            try {
              await api("/api/auth/password", { body: { current, next } });
              setCurrent("");
              setNext("");
              setMsg("Password changed. Other devices were logged out.");
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Change password
        </Button>
        {msg && <span className="text-sm text-good">{msg}</span>}
        <ErrorNote text={err} />
      </div>
    </div>
  );
}

export function DangerZone() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <a href="/api/data" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2">
        Export all my data (JSON)
      </a>
      <Button
        variant="danger"
        busy={busy}
        onClick={async () => {
          if (!confirm("Delete ALL your CVs, job ads, interviews, recordings and applications? Your account stays. This cannot be undone.")) return;
          setBusy(true);
          await api("/api/data", { method: "DELETE" });
          setBusy(false);
          router.push("/");
          router.refresh();
        }}
      >
        Delete all my data
      </Button>
    </div>
  );
}
