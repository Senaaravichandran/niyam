import { describe, expect, it } from "vitest";
import { readJson } from "@/app/api/_lib/sse";

describe("readJson payload limits", () => {
  it("enforces the limit in UTF-8 bytes, not JavaScript characters", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ text: "😀" }),
    });

    const result = await readJson(request, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.res.status).toBe(413);
  });
});
