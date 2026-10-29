import { parseResume } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { extractUpload } from "@/lib/files";
import { newId, readDb, updateDb } from "@/lib/store";
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
  const { parsed, text } = await parseResume(input);
  const version = Math.max(0, ...(await readDb(u.id)).resumes.map((r) => r.version)) + 1;
  const resume: Resume = {
    id: newId("cv"),
    version,
    label: String(fd.get("label") ?? "").trim() || `CV v${version}`,
    fileName,
    createdAt: new Date().toISOString(),
    text,
    parsed,
  };
  await updateDb(u.id, (db) => {
    db.resumes.push(resume);
  });
  return json({ resume: { id: resume.id } });
});
