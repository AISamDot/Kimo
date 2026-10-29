// Server-side adapters for third-party speech services. Each one reads its key
// from Settings (Integrations page). Nothing here runs unless the user picked
// that provider and saved a key.
import { MissingKeyError } from "./llm";
import { getSettings, updateSettings } from "./store";
import type { Lang, Word } from "./types";

export interface Transcript {
  text: string;
  words: Word[];
}

// Prompts that nudge Whisper to keep filler words verbatim instead of cleaning them up.
const VERBATIM_PROMPT: Record<Lang, string> = {
  en: "Umm, let me think, like, hmm... Okay, uh, so here's what I, um, did.",
  de: "Ähm, also, äh, ich denke, hm... Ja, also, ähm, das war so.",
};

export async function transcribe(wav: Buffer, lang: Lang): Promise<Transcript> {
  const s = await getSettings();
  switch (s.stt) {
    case "openai":
      return openaiStt(wav, lang);
    case "elevenlabs":
      return elevenStt(wav, lang);
    case "deepgram":
      return deepgramStt(wav, lang);
    default:
      throw new Error("Browser speech recognition is selected; the transcript comes from the browser.");
  }
}

async function check(res: Response, service: string) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${service} error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

async function openaiStt(wav: Buffer, lang: Lang): Promise<Transcript> {
  const s = await getSettings();
  if (!s.keys.openai) throw new MissingKeyError("OpenAI");
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "answer.wav");
  fd.append("model", s.voices.openaiSttModel);
  fd.append("language", lang);
  fd.append("prompt", VERBATIM_PROMPT[lang]);
  const wordLevel = s.voices.openaiSttModel.startsWith("whisper");
  if (wordLevel) {
    fd.append("response_format", "verbose_json");
    fd.append("timestamp_granularities[]", "word");
  } else {
    fd.append("response_format", "json");
  }
  const res = await check(
    await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${s.keys.openai}` },
      body: fd,
    }),
    "OpenAI transcription",
  );
  const j = (await res.json()) as { text: string; words?: { word: string; start: number; end: number }[] };
  return { text: j.text ?? "", words: (j.words ?? []).map((w) => ({ w: w.word, s: w.start, e: w.end })) };
}

async function elevenStt(wav: Buffer, lang: Lang): Promise<Transcript> {
  const s = await getSettings();
  if (!s.keys.elevenlabs) throw new MissingKeyError("ElevenLabs");
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "answer.wav");
  fd.append("model_id", s.voices.elevenlabsSttModel);
  fd.append("language_code", lang === "de" ? "deu" : "eng");
  fd.append("timestamps_granularity", "word");
  fd.append("tag_audio_events", "false");
  const res = await check(
    await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": s.keys.elevenlabs },
      body: fd,
    }),
    "ElevenLabs transcription",
  );
  const j = (await res.json()) as { text: string; words?: { text: string; start: number; end: number; type: string }[] };
  return {
    text: j.text ?? "",
    words: (j.words ?? []).filter((w) => w.type === "word").map((w) => ({ w: w.text, s: w.start, e: w.end })),
  };
}

async function deepgramStt(wav: Buffer, lang: Lang): Promise<Transcript> {
  const s = await getSettings();
  if (!s.keys.deepgram) throw new MissingKeyError("Deepgram");
  const params = new URLSearchParams({
    model: s.voices.deepgramModel,
    language: lang,
    punctuate: "true",
    smart_format: "true",
    filler_words: "true",
  });
  const res = await check(
    await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: { Authorization: `Token ${s.keys.deepgram}`, "Content-Type": "audio/wav" },
      body: new Uint8Array(wav),
    }),
    "Deepgram transcription",
  );
  const j = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript: string; words?: { word: string; punctuated_word?: string; start: number; end: number }[] }[] }[] };
  };
  const alt = j.results?.channels?.[0]?.alternatives?.[0];
  return {
    text: alt?.transcript ?? "",
    words: (alt?.words ?? []).map((w) => ({ w: w.punctuated_word ?? w.word, s: w.start, e: w.end })),
  };
}

export async function synthesize(text: string, lang: Lang): Promise<{ audio: Buffer; mime: string }> {
  const s = await getSettings();
  if (s.tts === "elevenlabs") {
    if (!s.keys.elevenlabs) throw new MissingKeyError("ElevenLabs");
    const res = await check(
      await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(s.voices.elevenlabsVoiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": s.keys.elevenlabs, "Content-Type": "application/json" },
          body: JSON.stringify({ text, model_id: s.voices.elevenlabsModel, language_code: lang }),
        },
      ),
      "ElevenLabs voice",
    );
    return { audio: Buffer.from(await res.arrayBuffer()), mime: "audio/mpeg" };
  }
  if (s.tts === "openai") {
    if (!s.keys.openai) throw new MissingKeyError("OpenAI");
    const res = await check(
      await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.keys.openai}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: s.voices.openaiTtsModel,
          voice: s.voices.openaiVoice,
          input: text,
          response_format: "mp3",
          ...(s.voices.openaiTtsModel.startsWith("gpt-")
            ? { instructions: lang === "de" ? "Speak natural, professional German like a German hiring manager." : "Speak like a calm, professional hiring manager." }
            : {}),
        }),
      }),
      "OpenAI voice",
    );
    return { audio: Buffer.from(await res.arrayBuffer()), mime: "audio/mpeg" };
  }
  throw new Error("Browser voice is selected; speech is generated in the browser.");
}

// ---------- Hume: vocal expression (prosody) on recorded answers ----------

interface HumePrediction {
  source?: { filename?: string };
  results?: {
    predictions?: {
      file?: string;
      models?: { prosody?: { grouped_predictions?: { predictions?: { emotions?: { name: string; score: number }[] }[] }[] } };
    }[];
  };
}

/** Runs a Hume batch job over answer files; returns mean expression scores per file. */
export async function humeProsody(files: { name: string; data: Buffer }[]): Promise<Map<string, Record<string, number>>> {
  const s = await getSettings();
  if (!s.keys.hume) throw new MissingKeyError("Hume");
  const fd = new FormData();
  fd.append("json", JSON.stringify({ models: { prosody: { granularity: "utterance" } } }));
  for (const f of files) fd.append("file", new Blob([new Uint8Array(f.data)], { type: "audio/wav" }), f.name);
  const start = await check(
    await fetch("https://api.hume.ai/v0/batch/jobs", { method: "POST", headers: { "X-Hume-Api-Key": s.keys.hume }, body: fd }),
    "Hume",
  );
  const { job_id } = (await start.json()) as { job_id: string };
  const deadline = Date.now() + 5 * 60_000;
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await check(await fetch(`https://api.hume.ai/v0/batch/jobs/${job_id}`, { headers: { "X-Hume-Api-Key": s.keys.hume } }), "Hume");
    const j = (await st.json()) as { state?: { status?: string; message?: string } };
    const status = j.state?.status;
    if (status === "COMPLETED") break;
    if (status === "FAILED") throw new Error(`Hume job failed: ${j.state?.message ?? ""}`);
    if (Date.now() > deadline) throw new Error("Hume job timed out");
  }
  const pr = await check(
    await fetch(`https://api.hume.ai/v0/batch/jobs/${job_id}/predictions`, { headers: { "X-Hume-Api-Key": s.keys.hume } }),
    "Hume",
  );
  const preds = (await pr.json()) as HumePrediction[];
  const out = new Map<string, Record<string, number>>();
  for (const p of preds) {
    for (const r of p.results?.predictions ?? []) {
      const name = r.file ?? p.source?.filename ?? "";
      const sums: Record<string, number> = {};
      let n = 0;
      for (const g of r.models?.prosody?.grouped_predictions ?? []) {
        for (const u of g.predictions ?? []) {
          n++;
          for (const e of u.emotions ?? []) sums[e.name] = (sums[e.name] ?? 0) + e.score;
        }
      }
      if (n) {
        for (const k of Object.keys(sums)) sums[k] /= n;
        out.set(name, sums);
      }
    }
  }
  return out;
}

// ---------- Azure: pronunciation assessment (first 60 s of an answer) ----------

export async function azurePronunciation(
  wav16k: Buffer,
  lang: Lang,
  referenceText: string,
): Promise<{ accuracy: number; fluency: number; prosody: number | null; overall: number } | null> {
  const s = await getSettings();
  if (!s.keys.azureSpeech) throw new MissingKeyError("Azure Speech");
  // REST short-audio limit is 60 s: truncate the PCM payload (16-bit mono).
  const rate = wav16k.length > 28 ? wav16k.readUInt32LE(24) : 16000;
  const maxBytes = 44 + rate * 2 * 58;
  const audio = wav16k.length > maxBytes ? fixWavHeader(wav16k.subarray(0, maxBytes)) : wav16k;
  const cfg = {
    ReferenceText: referenceText.slice(0, 1500),
    GradingSystem: "HundredMark",
    Granularity: "Word",
    Dimension: "Comprehensive",
    EnableProsodyAssessment: "True",
  };
  const url = `https://${s.keys.azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang === "de" ? "de-DE" : "en-US"}&format=detailed`;
  const res = await check(
    await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": s.keys.azureSpeech,
        "Content-Type": `audio/wav; codecs=audio/pcm; samplerate=${rate}`,
        "Pronunciation-Assessment": Buffer.from(JSON.stringify(cfg)).toString("base64"),
        Accept: "application/json",
      },
      body: new Uint8Array(audio),
    }),
    "Azure pronunciation",
  );
  const j = (await res.json()) as {
    NBest?: { PronunciationAssessment?: { AccuracyScore: number; FluencyScore: number; ProsodyScore?: number; PronScore: number } }[];
  };
  const pa = j.NBest?.[0]?.PronunciationAssessment;
  if (!pa) return null;
  return { accuracy: pa.AccuracyScore, fluency: pa.FluencyScore, prosody: pa.ProsodyScore ?? null, overall: pa.PronScore };
}

function fixWavHeader(buf: Buffer): Buffer {
  const b = Buffer.from(buf);
  b.writeUInt32LE(b.length - 8, 4);
  b.writeUInt32LE(b.length - 44, 40);
  return b;
}

// ---------- Tavus: video interviewer in "echo" mode (we supply the words) ----------

export async function tavusStartConversation(name: string): Promise<{ conversationId: string; url: string }> {
  const s = await getSettings();
  if (!s.keys.tavus) throw new MissingKeyError("Tavus");
  const headers = { "x-api-key": s.keys.tavus, "Content-Type": "application/json" };
  let palId = s.tavus.palId;
  if (!palId) {
    const res = await check(
      await fetch("https://tavusapi.com/v2/pals", {
        method: "POST",
        headers,
        body: JSON.stringify({
          pal_name: "Mock Interview Buddy interviewer",
          pipeline_mode: "echo",
          ...(s.tavus.replicaId ? { default_replica_id: s.tavus.replicaId } : {}),
        }),
      }),
      "Tavus",
    );
    const j = (await res.json()) as { pal_id?: string; persona_id?: string };
    palId = j.pal_id ?? j.persona_id ?? "";
    if (!palId) throw new Error("Tavus did not return a pal_id");
    await updateSettings((st) => {
      st.tavus.palId = palId;
    });
  }
  const res = await check(
    await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({
        pal_id: palId,
        conversation_name: name,
        ...(s.tavus.replicaId ? { replica_id: s.tavus.replicaId } : {}),
      }),
    }),
    "Tavus",
  );
  const j = (await res.json()) as { conversation_id: string; conversation_url: string };
  return { conversationId: j.conversation_id, url: j.conversation_url };
}

export async function tavusEndConversation(conversationId: string) {
  const s = await getSettings();
  if (!s.keys.tavus || !conversationId) return;
  await fetch(`https://tavusapi.com/v2/conversations/${encodeURIComponent(conversationId)}/end`, {
    method: "POST",
    headers: { "x-api-key": s.keys.tavus },
  }).catch(() => undefined);
}

// ---------- Key tests: free metadata endpoints only (no paid usage) ----------

export async function testKey(service: string): Promise<{ ok: boolean; message: string }> {
  const s = await getSettings();
  const k = s.keys;
  const ok = (message: string) => ({ ok: true, message });
  const run = async (url: string, headers: Record<string, string>, method = "GET") => {
    const res = await fetch(url, { method, headers });
    if (res.ok) return ok("Key works");
    return { ok: false, message: `Rejected (${res.status}): ${(await res.text()).slice(0, 200)}` };
  };
  try {
    switch (service) {
      case "anthropic":
        if (!k.anthropic) return { ok: false, message: "No key saved" };
        return run("https://api.anthropic.com/v1/models?limit=1", { "x-api-key": k.anthropic, "anthropic-version": "2023-06-01" });
      case "elevenlabs":
        if (!k.elevenlabs) return { ok: false, message: "No key saved" };
        return run("https://api.elevenlabs.io/v1/voices?page_size=1", { "xi-api-key": k.elevenlabs });
      case "openai":
        if (!k.openai) return { ok: false, message: "No key saved" };
        return run("https://api.openai.com/v1/models", { Authorization: `Bearer ${k.openai}` });
      case "deepgram":
        if (!k.deepgram) return { ok: false, message: "No key saved" };
        return run("https://api.deepgram.com/v1/projects", { Authorization: `Token ${k.deepgram}` });
      case "hume":
        if (!k.hume) return { ok: false, message: "No key saved" };
        return run("https://api.hume.ai/v0/batch/jobs?limit=1", { "X-Hume-Api-Key": k.hume });
      case "azure":
        if (!k.azureSpeech) return { ok: false, message: "No key saved" };
        return run(`https://${k.azureRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, { "Ocp-Apim-Subscription-Key": k.azureSpeech, "Content-Length": "0" }, "POST");
      case "tavus":
        if (!k.tavus) return { ok: false, message: "No key saved" };
        return run("https://tavusapi.com/v2/replicas?limit=1", { "x-api-key": k.tavus });
      case "adzuna":
        if (!k.adzunaAppKey || !k.adzunaAppId) return { ok: false, message: "Save both the app ID and the app key" };
        return run(`https://api.adzuna.com/v1/api/jobs/de/search/1?app_id=${encodeURIComponent(k.adzunaAppId)}&app_key=${encodeURIComponent(k.adzunaAppKey)}&results_per_page=1`, {});
      default:
        return { ok: false, message: "Unknown service" };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
