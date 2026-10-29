import { parseResume } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { extractUpload } from "@/lib/files";
import { FINDER_TASK, refreshFinder } from "@/lib/finder";
import { newId, updateDb } from "@/lib/store";
import { runTask, startTask } from "@/lib/tasks";
import type { Resume } from "@/lib/types";

export const maxDuration = 300;

export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const fd = await req.formData();
  const file = fd.get("file");
  const pasted = String(fd.get("text") ?? "").trim();
  let input: { text?: string; pdfBase64?: string };
  let fileName = "pasted text";
  if (file instanceof File && file.size > 0) {
    const ex = await extractUpload(file);
    input = ex;
    fileName = ex.fileName;
  } else if (pasted.length > 100) {
    input = { text: pasted };
  } else {
    throw new Error("Upload your CV or paste its text.");
  }
  const id = newId("cv");
  const label = String(fd.get("label") ?? "").trim();
  // Claude reads the CV in the background; then the job finder re-ranks openings against it.
  const task = await startTask(u.id, { key: `cvparse:${id}`, kind: "cv-read", label: `Reading ${fileName === "pasted text" ? "your CV" : fileName}`, href: `/cv?id=${id}` }, async () => {
    const { parsed, text } = await parseResume(input);
    await updateDb(u.id, (db) => {
      const version = Math.max(0, ...db.resumes.map((r) => r.version)) + 1;
      const resume: Resume = { id, version, label: label || `CV v${version}`, fileName, createdAt: new Date().toISOString(), text, parsed };
      db.resumes.push(resume);
    });
    await runTask(u.id, FINDER_TASK, async () => {
      await refreshFinder(u.id);
    });
  });
  return json({ task });
});
