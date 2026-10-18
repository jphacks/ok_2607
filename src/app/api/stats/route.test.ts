import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/stats/route";

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

beforeEach(() => databaseFetch.mockReset());

describe("経験値の集計 API", () => {
  it("完了したクエストの保存済み経験値と件数を返す", async () => {
    databaseFetch.mockResolvedValueOnce(
      Response.json([{ xp_earned: 30 }, { xp_earned: 45 }, { xp_earned: 0 }]),
    );
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ totalXp: 75, completedQuests: 3 });
    const [url] = databaseFetch.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("status")).toBe("eq.completed");
  });

  it("完了したクエストがなければ合計・件数ともにゼロ", async () => {
    databaseFetch.mockResolvedValueOnce(Response.json([]));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ totalXp: 0, completedQuests: 0 });
  });

  it("DB の取得上限を超える履歴も合算する", async () => {
    databaseFetch
      .mockResolvedValueOnce(Response.json(Array.from({ length: 1000 }, () => ({ xp_earned: 1 }))))
      .mockResolvedValueOnce(Response.json([{ xp_earned: 25 }]));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ totalXp: 1025, completedQuests: 1001 });
    expect(databaseFetch).toHaveBeenCalledTimes(2);
    const [url] = databaseFetch.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("offset")).toBe("1000");
  });

  it("DB 障害は秘密情報なしの 500 として返す", async () => {
    databaseFetch.mockResolvedValueOnce(
      Response.json({ message: "secret-service-key", code: "XX000" }, { status: 500 }),
    );
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "経験値を取得できませんでした" },
    });
  });

  it.each([null, [{ xp_earned: "30" }], [{ xp_earned: -10 }]])(
    "不正な保存データ %j を架空の経験値に置き換えない",
    async (data) => {
      databaseFetch.mockResolvedValueOnce(Response.json(data));
      const response = await GET();
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: { code: "internal_error", message: "経験値を取得できませんでした" },
      });
    },
  );

  it("未ログイン時は 401 unauthorized を返す", async () => {
    const { getCurrentUser } = await import("@/lib/auth");
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("unauthorized");
  });
});
