"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./client";
import { Icon, type IconName } from "./ui";

const GROUPS: { label: string; links: { href: string; label: string; icon: IconName }[] }[] = [
  { label: "", links: [{ href: "/", label: "Today", icon: "home" }] },
  {
    label: "Prepare",
    links: [
      { href: "/finder", label: "Job finder", icon: "search" },
      { href: "/jobs", label: "Job ads", icon: "briefcase" },
      { href: "/cv", label: "CV", icon: "cv" },
      { href: "/stories", label: "Story bank", icon: "book" },
    ],
  },
  {
    label: "Practise",
    links: [
      { href: "/interview/new", label: "Mock interview", icon: "mic" },
      { href: "/practice", label: "Quick drills", icon: "bolt" },
      { href: "/german", label: "German trainer", icon: "globe" },
    ],
  },
  {
    label: "Track",
    links: [
      { href: "/progress", label: "Progress", icon: "chart" },
      { href: "/applications", label: "Applications", icon: "list" },
      { href: "/debrief", label: "Real interviews", icon: "clipboard" },
      { href: "/diagnosis", label: "Diagnosis", icon: "stethoscope" },
    ],
  },
  {
    label: "Setup",
    links: [
      { href: "/integrations", label: "Integrations", icon: "plug" },
      { href: "/settings", label: "Settings", icon: "gear" },
    ],
  },
];

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-[#12a07f] to-[#e59a2f] text-white shadow-lift ${small ? "h-8 w-8" : "h-9 w-9"}`}>
        <Icon name="mic" className="h-4.5 w-4.5" />
      </span>
      <span className="leading-tight">
        <span className="block font-serif text-lg font-semibold tracking-tight">Kimo</span>
        {!small && <span className="block text-[11px] text-side-muted">Interview buddy · supply chain</span>}
      </span>
    </span>
  );
}

export function Nav({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`) || (href === "/interview/new" && path.startsWith("/interview")));
  const links = GROUPS.map((g) => (
    <div key={g.label} className="mb-3">
      {g.label && <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-side-muted/80">{g.label}</div>}
      {g.links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
            active(l.href) ? "bg-white/10 font-medium text-white shadow-[inset_2px_0_0_#e59a2f]" : "text-side-muted hover:bg-white/5 hover:text-side-ink"
          }`}
        >
          <Icon name={l.icon} className={`h-4 w-4 ${active(l.href) ? "text-[#f0b155]" : ""}`} />
          {l.label}
          {l.href === "/integrations" && !isAdmin && <span className="ml-auto text-[10px]">view</span>}
        </Link>
      ))}
    </div>
  ));
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: {} });
    router.push("/login");
    router.refresh();
  };
  return (
    <>
      <nav className="sticky top-0 z-30 flex items-center justify-between bg-side px-4 py-3 text-side-ink lg:hidden">
        <Link href="/">
          <Logo small />
        </Link>
        <button onClick={() => setOpen(!open)} className="rounded-xl border border-white/15 px-3 py-1.5 text-sm" aria-expanded={open}>
          {open ? "Close" : "Menu"}
        </button>
      </nav>
      {open && (
        <div className="fixed inset-x-0 top-[56px] bottom-0 z-30 overflow-y-auto bg-side px-3 py-4 text-side-ink lg:hidden">
          {links}
          <button onClick={logout} className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-side-muted hover:bg-white/5">
            <Icon name="logout" /> Log out ({name})
          </button>
        </div>
      )}
      <nav className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-side px-3 py-5 text-side-ink lg:flex">
        <Link href="/" className="mb-7 px-2">
          <Logo />
        </Link>
        <div className="flex-1">{links}</div>
        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e59a2f] text-sm font-semibold text-[#0f2a24]">{(name[0] ?? "?").toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{name}</div>
            <button onClick={logout} className="text-xs text-side-muted hover:text-side-ink">
              Log out
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
