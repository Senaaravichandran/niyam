/**
 * Document intake for the Reader: PDF (text layer), Word (.docx) and plain text become one clean
 * text with one numbered paragraph per line. Scanned PDFs have no text layer; in production they
 * go through OCR (olmOCR for poor scans), which this deployment does not run.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface IntakeResult {
  text: string;
  method: "pdf-text-layer" | "docx" | "plain-text";
  pages?: number;
  chars: number;
}

/** A paragraph starts with "4.", "4.1" or "(a)"; every other line continues the one above. */
const NEW_BLOCK = /^(\d{1,3}(\.\d{1,3})?\.?\s|\([a-z]{1,3}\)\s)/;

/**
 * Re-joins lines that a PDF wrapped mid-sentence. Lines before the first numbered paragraph
 * (reference, date, addressee, title) are kept as they are.
 */
export function reflow(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").replace(/[ \t ]+/g, " ").split("\n").map((l) => l.trim());
  const out: string[] = [];
  let numbered = false;
  for (const line of lines) {
    if (!line) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (NEW_BLOCK.test(line)) {
      numbered = true;
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(line);
      continue;
    }
    // A closing such as "Yours faithfully," ends the numbered body.
    if (/^yours (faithfully|sincerely)/i.test(line)) numbered = false;
    const prev = out[out.length - 1];
    if (numbered && prev) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractDocument(bytes: Uint8Array, name: string, mime = ""): Promise<IntakeResult> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const joined = (Array.isArray(text) ? text : [text]).join("\n");
    if (joined.replace(/\s/g, "").length < 40) {
      throw new Error("This PDF has no text layer (it looks scanned). Scanned circulars go through OCR in production; paste the text or upload a text PDF here.");
    }
    const t = reflow(joined);
    return { text: t, method: "pdf-text-layer", pages: totalPages, chars: t.length };
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const t = reflow(value);
    return { text: t, method: "docx", chars: t.length };
  }
  if (/\.(txt|md|text)$/.test(lower) || mime.startsWith("text/")) {
    const t = reflow(new TextDecoder("utf-8").decode(bytes));
    return { text: t, method: "plain-text", chars: t.length };
  }
  throw new Error("Unsupported file type. Upload a .pdf, .docx, .txt or .md circular.");
}
