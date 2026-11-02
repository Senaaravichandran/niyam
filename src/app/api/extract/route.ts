import { MAX_UPLOAD_BYTES, extractDocument } from "@/niyam/intake";
import { allowRequest, clientIp, tooMany } from "../_lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST multipart/form-data { file }: returns the circular's text, reflowed for the Reader. */
export async function POST(req: Request) {
  if (!allowRequest(clientIp(req))) return tooMany();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send the circular as multipart/form-data with a `file` field" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Missing `file`" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "File is larger than 4 MB" }, { status: 413 });
  try {
    const res = await extractDocument(new Uint8Array(await file.arrayBuffer()), file.name, file.type);
    return Response.json({ ...res, text: res.text.slice(0, 20_000), truncated: res.text.length > 20_000, name: file.name });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
