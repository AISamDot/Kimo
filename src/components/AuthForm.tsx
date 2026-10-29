"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Button, ErrorNote } from "./client";

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-serif text-3xl font-semibold">Mock Interview Buddy</h1>
          <p className="mt-1 text-sm text-muted">Practise supply-chain interviews. Find out what's holding you back.</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">{signup ? "Create your account" : "Log in"}</h2>
          {signup && firstUser && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
              You're the first user, so this account becomes the admin (it manages the API keys).
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
              Already have an account? <Link href="/login" className="text-accent underline">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup" className="text-accent underline">Create an account</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
