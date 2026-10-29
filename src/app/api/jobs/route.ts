import { parseJob } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { extractUpload, fetchUrlText } from "@/lib/files";
import { newId, updateDb } from "@/lib/store";
import { startTask } from "@/lib/tasks";
import type { Job } from "@/lib/types";

export const maxDuration = 300;

export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const fd = await req.formData();
  const file = fd.get("file");
  const url = String(fd.get("url") ?? "").trim();
  const pasted = String(fd.get("text") ?? "").trim();
  let source: Job["source"];
  let input: { text?: string; pdfBase64?: string };
  if (file instanceof File && file.size > 0) {
    source = "file";
    input = await extractUpload(file);
  } else if (url) {
    source = "url";
    input = { text: await fetchUrlText(url) };
  } else if (pasted.length > 80) {
    source = "text";
    input = { text: pasted };
  } else {
    throw new Error("Paste the job ad, upload it, or give a link.");
  }
  const id = newId("job");
  const task = await startTask(u.id, { key: `jobparse:${id}`, kind: "job-read", label: "Reading the job ad", href: `/jobs/${id}` }, async () => {
    const { parsed, text } = await parseJob(input);
    const job: Job = { id, createdAt: new Date().toISOString(), source, url, rawText: text, parsed };
    await updateDb(u.id, (db) => {
      db.jobs.push(job);
    });
  });
  return json({ task });
});
