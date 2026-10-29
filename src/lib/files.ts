// Turns uploaded files / URLs into text (or a PDF for Claude to read directly).

export interface Extracted {
  text?: string;
  pdfBase64?: string;
  fileName: string;
}

const MAX_BYTES = 15 * 1024 * 1024;

export async function extractUpload(file: File): Promise<Extracted> {
  if (file.size > MAX_BYTES) throw new Error("File is larger than 15 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name || "upload";
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    return { pdfBase64: buf.toString("base64"), fileName: name };
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value, fileName: name };
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/")) {
    return { text: buf.toString("utf8"), fileName: name };
  }
  throw new Error("Upload a PDF, DOCX or TXT file.");
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export async function fetchUrlText(url: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) links are supported.");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/.test(u.hostname)) throw new Error("Local addresses are not allowed.");
  const res = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "Accept-Language": "de,en;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Could not open the link (HTTP ${res.status}). Paste the ad text instead.`);
  const html = (await res.text()).slice(0, 2_000_000);
  const text = htmlToText(html);
  if (text.length < 200) throw new Error("The page had almost no readable text (it may need a login or JavaScript). Paste the ad text instead.");
  return text.slice(0, 40000);
}
