"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Grade } from "@/lib/practice";
import type { Phrase } from "@/lib/types";
import { api, Button, ErrorNote } from "./client";
import { Icon, Pill } from "./ui";

function say(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.92;
  speechSynthesis.speak(u);
}

const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: "again", label: "Again", cls: "bg-bad-soft text-bad" },
  { g: "hard", label: "Hard", cls: "bg-warn-soft text-warn" },
  { g: "good", label: "Good", cls: "bg-good-soft text-good" },
  { g: "easy", label: "Easy", cls: "bg-accent-soft text-accent" },
];

export function PhraseTrainer({ due, all }: { due: Phrase[]; all: Phrase[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(due);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [err, setErr] = useState("");
  const card = queue[0];

  const grade = async (g: Grade) => {
    if (!card) return;
    setErr("");
    const rest = queue.slice(1);
    // "Again" goes back into today's queue.
    setQueue(g === "again" ? [...rest, card] : rest);
    setFlipped(false);
    setDone((n) => n + 1);
    try {
      await api("/api/phrases", { body: { review: card.id, grade: g } });
    } catch (e) {
      setErr((e as Error).message);
    }
    if (!rest.length && g !== "again") router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
      <div className="space-y-4">
        {card ? (
          <>
            <div className="flip">
              <div className={`flip-inner relative min-h-64 ${flipped ? "flipped" : ""}`}>
                <button onClick={() => setFlipped(true)} className="flip-face hero absolute inset-0 flex flex-col items-center justify-center rounded-3xl p-8 text-center shadow-lift">
                  <span className="text-xs uppercase tracking-[0.16em] text-white/60">Say it in German</span>
                  <span className="mt-3 font-serif text-2xl leading-snug sm:text-3xl">{card.en || card.note || "(no translation, recall the phrase)"}</span>
                  {card.en && card.note && <span className="mt-3 text-sm text-white/60">{card.note}</span>}
                  <span className="mt-6 text-sm text-white/70">Tap to reveal</span>
                </button>
                <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-line bg-surface p-8 text-center shadow-lift">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted">Deutsch</span>
                  <span className="mt-3 font-serif text-2xl leading-snug text-accent sm:text-3xl">{card.de}</span>
                  {card.en && <span className="mt-2 text-sm text-muted">{card.en}</span>}
                  <button onClick={() => say(card.de)} className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
                    <Icon name="volume" /> Listen and repeat aloud
                  </button>
                </div>
              </div>
            </div>
            {flipped ? (
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map((x) => (
                  <button key={x.g} onClick={() => grade(x.g)} className={`rounded-xl py-3 text-sm font-semibold transition hover:brightness-95 ${x.cls}`}>
                    {x.label}
                  </button>
                ))}
              </div>
            ) : (
              <Button className="w-full" onClick={() => setFlipped(true)}>Show answer</Button>
            )}
            <p className="text-center text-xs text-muted">{queue.length} left in this round · {done} reviewed</p>
          </>
        ) : (
          <div className="rounded-3xl border border-line bg-surface p-10 text-center shadow-card">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-good-soft text-good"><Icon name="check" className="h-6 w-6" /></span>
            <p className="mt-3 font-serif text-xl font-semibold">{all.length ? "All done for today" : "Your deck is empty"}</p>
            <p className="mt-1 text-sm text-muted">
              {all.length ? "Come back tomorrow. Short daily reviews beat long cramming." : "Do a mock interview with German in it, add phrases from a prep pack, or add your own below."}
            </p>
          </div>
        )}
        <ErrorNote text={err} />
      </div>
      <div className="space-y-4">
        <AddPhrase />
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="mb-2 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-muted">Deck</div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">
            {[...all].sort((a, b) => a.box - b.box).map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.de}</span>
                  {p.en && <span className="block truncate text-xs text-muted">{p.en}</span>}
                </span>
                <Pill tone={p.box >= 4 ? "good" : p.box >= 2 ? "accent" : "neutral"}>box {p.box}</Pill>
                <button
                  title="Delete"
                  className="text-muted hover:text-bad"
                  onClick={async () => {
                    await api(`/api/phrases?id=${p.id}`, { method: "DELETE" });
                    router.refresh();
                  }}
                >
                  <Icon name="x" />
                </button>
              </li>
            ))}
            {all.length === 0 && <li className="py-4 text-center text-muted">No phrases yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AddPhrase() {
  const router = useRouter();
  const [de, setDe] = useState("");
  const [en, setEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form
      className="space-y-2 rounded-2xl border border-line bg-surface p-4 shadow-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
          await api("/api/phrases", { body: { add: [{ de, en }] } });
          setDe("");
          setEn("");
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-muted">Add a phrase</div>
      <input className="field" placeholder="Deutsch, e.g. Ich habe die Bestellmengen angepasst." value={de} onChange={(e) => setDe(e.target.value)} />
      <input className="field" placeholder="Meaning in English" value={en} onChange={(e) => setEn(e.target.value)} />
      <ErrorNote text={err} />
      <Button type="submit" busy={busy} disabled={!de.trim()} variant="ghost">Add to deck</Button>
    </form>
  );
}
