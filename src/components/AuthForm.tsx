"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Button, ErrorNote } from "./client";
import { Icon, type IconName } from "./ui";

export function AuthForm({ mode, firstUser, signupsOpen }: { mode: "login" | "signup"; firstUser: boolean; signupsOpen: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api(`/api/auth/${mode}`, { body: { email, password, name } });
      router.push(mode === "signup" ? "/settings?welcome=1" : "/");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const signup = mode === "signup";
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="hero relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#12a07f] to-[#e59a2f] shadow-lift">
            <Icon name="mic" className="h-5 w-5" />
          </span>
          <span className="font-serif text-2xl font-semibold">Kimo</span>
        </div>
        <div>
          <h1 className="max-w-md font-serif text-5xl font-semibold leading-[1.05]">Interviews in, offers out.</h1>
          <p className="mt-4 max-w-md text-lg text-white/80">
            A private interview coach for supply-chain roles in Germany: live mock interviews in English and German, honest scoring, and a diagnosis of what is
            really costing you the offer.
          </p>
          <ul className="mt-8 grid max-w-md gap-3 text-sm text-white/85">
            {[
              ["mic", "Realistic voice interviewer that presses on weak points"],
              ["search", "Job finder ranked against your CV and German level"],
              ["globe", "German trainer built from your own mistakes"],
              ["stethoscope", "Diagnosis from real applications and debriefs"],
            ].map(([i, t]) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Icon name={i as IconName} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">Private by design · your data stays in your own deployment</p>
      </aside>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <div className="mb-4 flex justify-center lg:hidden">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#12a07f] to-[#e59a2f] text-white shadow-lift">
                <Icon name="mic" className="h-6 w-6" />
              </span>
            </div>
            <h2 className="font-serif text-3xl font-semibold">{signup ? "Create your account" : "Welcome back"}</h2>
            <p className="mt-1 text-sm text-muted">{signup ? "Start practising in two minutes." : "Log in to keep practising."}</p>
          </div>
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
            {signup && firstUser && (
              <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
                You’re the first user, so this account becomes the admin (it manages the API keys).
              </p>
            )}
            {signup && !signupsOpen && !firstUser ? (
              <p className="text-sm text-muted">Sign-ups are closed. Ask the admin to open them.</p>
            ) : (
              <>
                {signup && (
                  <label className="block text-sm">
                    Name
                    <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  </label>
                )}
                <label className="block text-sm">
                  Email
                  <input className="field mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <label className="block text-sm">
                  Password
                  <input
                    className="field mt-1"
                    type="password"
                    required
                    minLength={signup ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={signup ? "new-password" : "current-password"}
                  />
                  {signup && <span className="text-xs text-muted">At least 8 characters.</span>}
                </label>
                <ErrorNote text={err} />
                <Button type="submit" busy={busy} className="w-full">
                  {signup ? "Sign up" : "Log in"}
                </Button>
              </>
            )}
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            {signup ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-accent underline">
                  Log in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link href="/signup" className="text-accent underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
