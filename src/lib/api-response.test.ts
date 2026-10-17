import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiError, notImplemented, parseJson } from "@/lib/api-response";

const Body = z.object({ title: z.string().min(1) });

function jsonRequest(body: string) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("parseJson", () => {
  it("スキーマに合う JSON を返す", async () => {
    const result = await parseJson(jsonRequest('{"title":"本を読む"}'), Body);
    expect(result).toEqual({ ok: true, data: { title: "本を読む" } });
  });

  it("JSON として壊れていれば 400 invalid_json", async () => {
    const result = await parseJson(jsonRequest("{"), Body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toMatchObject({ error: { code: "invalid_json" } });
    }
  });

  it("スキーマに合わなければ 400 validation_error", async () => {
    const result = await parseJson(jsonRequest('{"title":""}'), Body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(await result.response.json()).toMatchObject({ error: { code: "validation_error" } });
    }
  });
});

describe("apiError / notImplemented", () => {
  it("決まった形のエラーを返す", async () => {
    const res = apiError(404, "not_found", "見つかりません");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "見つかりません" } });
  });

  it("未実装は 501 で担当者を含む", async () => {
    const res = notImplemented("@tutayadx");
    expect(res.status).toBe(501);
    expect((await res.json()).error.message).toContain("@tutayadx");
  });
});
