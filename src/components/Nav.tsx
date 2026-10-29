"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./client";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/cv", label: "CV" },
  { href: "/jobs", label: "Job ads" },
  { href: "/interview/new", label: "Practise" },
  { href: "/progress", label: "Progress" },
  { href: "/applications", label: "Applications" },
  { href: "/diagnosis", label: "Diagnosis" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const links = LINKS.map((l) => (
    <Link
      key={l.href}
      href={l.href}
      onClick={() => setOpen(false)}
      className={`block rounded-lg px-3 py-2 text-sm ${active(l.href) ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
    >
      {l.label}
      {l.href === "/integrations" && !isAdmin && <span className="ml-1 text-xs">(view)</span>}
    </Link>
  ));
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: {} });
    router.push("/login");
    router.refresh();
  };
  return (
    <>
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Link href="/" className="font-serif text-lg font-semibold">
          Interview Buddy
        </Link>
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-line px-3 py-1.5 text-sm" aria-expanded={open}>
          {open ? "Close" : "Menu"}
        </button>
      </nav>
      {open && (
        <div className="border-b border-line bg-surface px-3 pb-3 lg:hidden">
          {links}
          <button onClick={logout} className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2">
            Log out ({name})
          </button>
        </div>
      )}
      <nav className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link href="/" className="mb-6 px-3">
          <div className="font-serif text-xl font-semibold leading-tight">Mock Interview Buddy</div>
          <div className="text-xs text-muted">Supply chain · Germany</div>
        </Link>
        <div className="flex-1 space-y-0.5">{links}</div>
        <div className="border-t border-line px-3 pt-3 text-xs text-muted">
          <div className="truncate">{name}</div>
          <button onClick={logout} className="mt-1 underline hover:text-ink">
            Log out
          </button>
        </div>
      </nav>
    </>
  );
}
