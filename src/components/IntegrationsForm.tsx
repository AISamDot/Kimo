"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Settings } from "@/lib/types";
import { api, Button, ErrorNote } from "./client";

type Svc = { id: string; keyField: keyof Settings["keys"]; name: string; use: string; url: string; required?: boolean };

const SERVICES: Svc[] = [
  { id: "anthropic", keyField: "anthropic", name: "Anthropic (Claude)", use: "Required. The interviewer, CV and job reviews, scoring, reports, diagnosis.", url: "https://console.anthropic.com/settings/keys", required: true },
  { id: "elevenlabs", keyField: "elevenlabs", name: "ElevenLabs", use: "Natural interviewer voice in English and German, and/or speech-to-text (Scribe).", url: "https://elevenlabs.io/app/settings/api-keys" },
  { id: "openai", keyField: "openai", name: "OpenAI", use: "Alternative voice (TTS) and speech-to-text (Whisper keeps filler words).", url: "https://platform.openai.com/api-keys" },
  { id: "deepgram", keyField: "deepgram", name: "Deepgram", use: "Alternative speech-to-text with word timings.", url: "https://console.deepgram.com/" },
  { id: "hume", keyField: "hume", name: "Hume AI", use: "Optional: how your voice may come across (vocal expression).", url: "https://platform.hume.ai/settings/keys" },
  { id: "azure", keyField: "azureSpeech", name: "Azure AI Speech", use: "Optional: pronunciation scores for German/English answers.", url: "https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices" },
  { id: "tavus", keyField: "tavus", name: "Tavus", use: "Optional: realistic video interviewer (most expensive part).", url: "https://platform.tavus.io/api-keys" },
  { id: "apify", keyField: "apify", name: "Apify", use: "Optional, paid: adds LinkedIn and Indeed jobs to the Job finder once a day (about 300 jobs, roughly $0.07 a day).", url: "https://console.apify.com/settings/integrations" },
  { id: "adzuna", keyField: "adzunaAppKey", name: "Adzuna (free)", use: "Optional: more openings in the Job finder (free developer key). Arbeitnow works without a key.", url: "https://developer.adzuna.com/signup" },
];

export function IntegrationsForm({ initial, allowSignups, isAdmin }: { initial: Settings; allowSignups: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [signups, setSignups] = useState(allowSignups);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [tests, setTests] = useState<Record<string, { ok: boolean; message: string } | "busy">>({});

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    setErr("");
    setSaved(false);
    try {
      const { keys: _k, ...rest } = s;
      await api("/api/settings", { body: { settings: { ...rest, keys }, allowSignups: signups } });
      setKeys({});
      setSaved(true);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const test = async (id: string) => {
    setTests((t) => ({ ...t, [id]: "busy" }));
    const r = await api<{ ok: boolean; message: string }>("/api/settings/test", { body: { service: id } }).catch((e) => ({ ok: false, message: (e as Error).message }));
    setTests((t) => ({ ...t, [id]: r }));
  };
  const has = (k: keyof Settings["keys"]) => !!initial.keys[k];
  const dis = !isAdmin;

  const radio = <T extends string>(value: T, onChange: (v: T) => void, options: { v: T; label: string; need?: keyof Settings["keys"]; hint?: string }[]) => (
    <div className="space-y-1.5">
      {options.map((o) => {
        const missing = o.need && !has(o.need);
        return (
          <label key={o.v} className={`flex items-start gap-2 text-sm ${missing ? "opacity-60" : ""}`}>
            <input type="radio" className="mt-1 accent-[var(--accent)]" checked={value === o.v} disabled={dis} onChange={() => onChange(o.v)} />
            <span>
              {o.label}
              {missing && <span className="text-xs text-warn"> (needs key)</span>}
              {o.hint && <span className="block text-xs text-muted">{o.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {!isAdmin && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">Only the admin can change integrations. You can see what’s connected.</p>}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">API keys</h2>
        <p className="mt-1 text-xs text-muted">Keys are stored on this app’s server (its data folder or database) and are never sent to the browser. “Test” calls a free endpoint of each service (no usage charge).</p>
        <div className="mt-4 divide-y divide-line">
          {SERVICES.map((svc) => {
            const t = tests[svc.id];
            return (
              <div key={svc.id} className="grid gap-2 py-4 md:grid-cols-[220px_1fr]">
                <div>
                  <div className="font-medium">
                    {svc.name} {svc.required && <span className="text-xs text-bad">required</span>}
                  </div>
                  <div className="text-xs text-muted">{svc.use}</div>
                  <a href={svc.url} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
                    Get a key
                  </a>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="field max-w-md flex-1"
                      type="password"
                      autoComplete="off"
                      disabled={dis}
                      placeholder={has(svc.keyField) ? `Saved (${initial.keys[svc.keyField]}). Type to replace` : "Paste key"}
                      value={keys[svc.keyField] ?? ""}
                      onChange={(e) => setKeys((k) => ({ ...k, [svc.keyField]: e.target.value }))}
                    />
                    {svc.id === "adzuna" && (
                      <input
                        className="field w-40"
                        type="password"
                        autoComplete="off"
                        disabled={dis}
                        placeholder={has("adzunaAppId") ? `App ID saved (${initial.keys.adzunaAppId})` : "App ID"}
                        value={keys.adzunaAppId ?? ""}
                        onChange={(e) => setKeys((k) => ({ ...k, adzunaAppId: e.target.value }))}
                      />
                    )}
                    {svc.id === "azure" && (
                      <input
                        className="field w-36"
                        disabled={dis}
                        placeholder="region"
                        value={keys.azureRegion ?? initial.keys.azureRegion}
                        onChange={(e) => setKeys((k) => ({ ...k, azureRegion: e.target.value }))}
                      />
                    )}
                    {isAdmin && has(svc.keyField) && (
                      <>
                        <Button variant="ghost" busy={t === "busy"} onClick={() => test(svc.id)}>
                          Test
                        </Button>
                        <Button variant="danger" onClick={() => setKeys((k) => ({ ...k, [svc.keyField]: "__clear__" }))}>
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                  {keys[svc.keyField] === "__clear__" && <p className="text-xs text-warn">Will be removed when you save.</p>}
                  {t && t !== "busy" && <p className={`text-xs ${t.ok ? "text-good" : "text-bad"}`}>{t.message}</p>}
                  {svc.id === "elevenlabs" && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="text-xs text-muted">Voice ID<input className="field mt-1" disabled={dis} value={s.voices.elevenlabsVoiceId} onChange={(e) => set("voices", { ...s.voices, elevenlabsVoiceId: e.target.value })} /></label>
                      <label className="text-xs text-muted">Voice model<input className="field mt-1" disabled={dis} value={s.voices.elevenlabsModel} onChange={(e) => set("voices", { ...s.voices, elevenlabsModel: e.target.value })} /></label>
                      <label className="text-xs text-muted">Speech-to-text model<input className="field mt-1" disabled={dis} value={s.voices.elevenlabsSttModel} onChange={(e) => set("voices", { ...s.voices, elevenlabsSttModel: e.target.value })} /></label>
                    </div>
                  )}
                  {svc.id === "openai" && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="text-xs text-muted">Voice<input className="field mt-1" disabled={dis} value={s.voices.openaiVoice} onChange={(e) => set("voices", { ...s.voices, openaiVoice: e.target.value })} /></label>
                      <label className="text-xs text-muted">Voice model<input className="field mt-1" disabled={dis} value={s.voices.openaiTtsModel} onChange={(e) => set("voices", { ...s.voices, openaiTtsModel: e.target.value })} /></label>
                      <label className="text-xs text-muted">Speech-to-text model<input className="field mt-1" disabled={dis} value={s.voices.openaiSttModel} onChange={(e) => set("voices", { ...s.voices, openaiSttModel: e.target.value })} /></label>
                    </div>
                  )}
                  {svc.id === "deepgram" && (
                    <label className="block max-w-xs text-xs text-muted">Model<input className="field mt-1" disabled={dis} value={s.voices.deepgramModel} onChange={(e) => set("voices", { ...s.voices, deepgramModel: e.target.value })} /></label>
                  )}
                  {svc.id === "tavus" && (
                    <label className="block max-w-md text-xs text-muted">
                      Replica ID (the face; pick one in Tavus, leave empty for your account default)
                      <input className="field mt-1" disabled={dis} value={s.tavus.replicaId} onChange={(e) => set("tavus", { ...s.tavus, replicaId: e.target.value, palId: "" })} />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 rounded-2xl border border-line bg-surface p-5 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Interviewer voice</h3>
          {radio(s.tts, (v) => set("tts", v), [
            { v: "browser", label: "Browser voice", hint: "Free; sounds robotic" },
            { v: "elevenlabs", label: "ElevenLabs", need: "elevenlabs", hint: "Most natural, good German" },
            { v: "openai", label: "OpenAI", need: "openai" },
          ])}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Speech-to-text (your answers)</h3>
          {radio(s.stt, (v) => set("stt", v), [
            { v: "browser", label: "Browser (Chrome/Edge)", hint: "Free; drops filler words, so delivery scores are less precise" },
            { v: "openai", label: "OpenAI Whisper", need: "openai", hint: "Keeps “ähm/um”, word timings" },
            { v: "elevenlabs", label: "ElevenLabs Scribe", need: "elevenlabs" },
            { v: "deepgram", label: "Deepgram", need: "deepgram" },
          ])}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Interviewer on screen</h3>
          {radio(s.avatar, (v) => set("avatar", v), [
            { v: "animated", label: "Animated avatar", hint: "Free, built in" },
            { v: "tavus", label: "Tavus video avatar", need: "tavus", hint: "Realistic face; ~$0.30/min" },
            { v: "none", label: "None (voice only)" },
          ])}
          <h3 className="mt-4 mb-2 text-sm font-semibold">Analysis extras</h3>
          {(
            [
              ["webcam", "Webcam presence analysis (in-browser)"],
              ["hume", "Vocal expression (Hume, if key)"],
              ["azurePronunciation", "Pronunciation (Azure, if key)"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--accent)]" disabled={dis} checked={s.features[k]} onChange={(e) => set("features", { ...s.features, [k]: e.target.checked })} />
              {l}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold">Claude models</h3>
        <p className="mb-3 text-xs text-muted">Default is Claude Opus 5.5 everywhere. For a snappier interviewer, try Claude Sonnet 5.5 or Haiku 5.5 for the “Interviewer” role (cheaper and faster, slightly less sharp).</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["interviewer", "analysis", "verdict"] as const).map((role) => (
            <div key={role} className="space-y-1">
              <label className="text-xs text-muted capitalize">
                {role === "analysis" ? "Reviews & scoring" : role === "verdict" ? "Verdict & diagnosis" : "Interviewer"}
                <select className="field mt-1" disabled={dis} value={s.models[role]} onChange={(e) => set("models", { ...s.models, [role]: e.target.value })}>
                  <option value="claude-opus-5-5">Claude Opus 5.5</option>
                  <option value="claude-sonnet-5-5">Claude Sonnet 5.5</option>
                  <option value="claude-haiku-5-5">Claude Haiku 5.5</option>
                  <option value="claude-fable-5-1">Claude Fable 5.1 (most capable, priciest)</option>
                </select>
              </label>
              <select className="field" disabled={dis} value={s.effort[role]} onChange={(e) => set("effort", { ...s.effort, [role]: e.target.value as Settings["effort"]["interviewer"] })}>
                {["low", "medium", "high", "xhigh"].map((x) => (
                  <option key={x} value={x}>
                    effort: {x}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold">Interview behaviour & scoring</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted">
            Silence that ends an answer (seconds)
            <input type="number" min={1.2} max={6} step={0.1} className="field mt-1" disabled={dis} value={s.interview.silenceMs / 1000} onChange={(e) => set("interview", { ...s.interview, silenceMs: Math.round(Number(e.target.value) * 1000) })} />
          </label>
          <label className="text-xs text-muted">
            Pressure round: interrupt after (s)
            <input type="number" min={60} max={300} className="field mt-1" disabled={dis} value={s.interview.pressureMaxAnswerSec} onChange={(e) => set("interview", { ...s.interview, pressureMaxAnswerSec: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-muted">
            Ready when last-3 average ≥
            <input type="number" min={50} max={95} className="field mt-1" disabled={dis} value={s.readiness.threshold} onChange={(e) => set("readiness", { ...s.readiness, threshold: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-muted">
            …and no area below
            <input type="number" min={30} max={90} className="field mt-1" disabled={dis} value={s.readiness.floor} onChange={(e) => set("readiness", { ...s.readiness, floor: Number(e.target.value) })} />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {(["content", "delivery", "language", "presence"] as const).map((k) => (
            <label key={k} className="text-xs text-muted capitalize">
              Weight: {k}
              <input type="number" min={0} max={100} className="field mt-1" disabled={dis} value={s.weights[k]} onChange={(e) => set("weights", { ...s.weights, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Weights are relative (they don’t need to add up to 100). Raise Language if the target jobs need C1 German.</p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold">Data & access</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted">
            Keep answer recordings for (days)
            <input type="number" min={1} max={365} className="field mt-1" disabled={dis} value={s.data.audioRetentionDays} onChange={(e) => set("data", { ...s.data, audioRetentionDays: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" disabled={dis} checked={s.data.deleteAudioAfterAnalysis} onChange={(e) => set("data", { ...s.data, deleteAudioAfterAnalysis: e.target.checked })} />
            Delete recordings right after analysis
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" disabled={dis} checked={signups} onChange={(e) => setSignups(e.target.checked)} />
            Allow new sign-ups
          </label>
        </div>
      </section>

      {isAdmin && (
        <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
          <Button busy={busy} onClick={save}>Save integrations</Button>
          {saved && <span className="text-sm text-good">Saved</span>}
          <ErrorNote text={err} />
        </div>
      )}
    </div>
  );
}
