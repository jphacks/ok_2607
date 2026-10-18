import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/tasks/route";

const { databaseFetch } = vi.hoisted(() => ({ databaseFetch: vi.fn<typeof fetch>() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: "test-user-id", email: "test@example.com" }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () =>
    createClient("https://database.example", "test-service-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: databaseFetch },
    }),
}));

const row = {
  id: "a1111111-1111-4111-8111-111111111111",
  title: "本を読む",
  due_at: null,
  status: "active",
  shown_count: 0,
  skipped_count: 0,
  created_at: "2026-10-17T09:00:00+00:00",
  updated_at: "2026-10-17T09:00:00+00:00",
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => databaseFetch.mockReset());

describe("期限と入力の検証", () => {
  it.each([
    { title: "" },
    { title: "   " },
    { title: "あ".repeat(201) },
    { title: "本を読む", dueAt: "2026-10-20" },
    { title: "本を読む", dueAt: "2026-10-20T23:59:00" },
  ])("不正なタイトル・期限は保存しない: %j", async (input) => {
    const response = await post(input);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "validation_error" } });
    expect(databaseFetch).not.toHaveBeenCalled();
  });

  it("壊れた JSON は 400 invalid_json", async () => {
    const response = await POST(
      new Request("http://localhost/api/tasks", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_json" } });
    expect(databaseFetch).not.toHaveBeenCalled();
  });
});

describe("タスク一覧 API", () => {
  it.each(["", "unknown", "ACTIVE"])("不正な状態 %s は DB を呼ばず 400", async (status) => {
    const response = await GET(new Request(`http://localhost/api/tasks?status=${status}`));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "validation_error", message: "タスクの状態が不正です" },
    });
    expect(databaseFetch).not.toHaveBeenCalled();
  });
});

describe("タスク API のエラー境界", () => {
  it.each(["read", "create"])(
    "DB の %s エラーを秘密情報なしの 500 に変換する",
    async (operation) => {
      databaseFetch.mockResolvedValueOnce(
        Response.json({ message: "secret-service-key", code: "XX000" }, { status: 500 }),
      );
      const response =
        operation === "read"
          ? await GET(new Request("http://localhost/api/tasks"))
          : await post({ title: "本を読む" });
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.code).toBe("internal_error");
      expect(body.error.message).toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(JSON.stringify(body)).not.toContain("secret-service-key");
    },
  );

  it("不正な DB 行を正常なタスクとして公開しない", async () => {
    databaseFetch.mockResolvedValueOnce(Response.json([{ ...row, shown_count: "0" }]));
    const response = await GET(new Request("http://localhost/api/tasks"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "タスク一覧を取得できませんでした" },
    });
  });

  it("未ログイン時は 401 unauthorized を返す", async () => {
    const { getCurrentUser } = await import("@/lib/auth");
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    const getRes = await GET(new Request("http://localhost/api/tasks"));
    expect(getRes.status).toBe(401);
    const getBody = await getRes.json();
    expect(getBody.error.code).toBe("unauthorized");

    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const postRes = await post({ title: "本を読む" });
    expect(postRes.status).toBe(401);
    const postBody = await postRes.json();
    expect(postBody.error.code).toBe("unauthorized");
  });
});
