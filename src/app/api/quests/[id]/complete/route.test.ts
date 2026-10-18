import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/features/checkpoint/service", () => ({
  completeQuest: vi.fn(),
}));

import { completeQuest } from "@/features/checkpoint/service";

describe("POST /api/quests/[id]/complete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "authenticated-user" } as User);
  });

  it("未認証なら入力検証前に 401 を返し DB とサービスを呼ばない", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const response = await POST(
      new Request("http://localhost/api?userId=other", { method: "POST" }),
      {
        params: Promise.resolve({ id: "invalid" }),
      },
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthorized");
    expect(supabaseServer).not.toHaveBeenCalled();
    expect(completeQuest).not.toHaveBeenCalled();
  });

  it("他ユーザーまたは不存在の対象は同じ 404 とし Cookie のユーザー ID を渡す", async () => {
    vi.mocked(completeQuest).mockResolvedValueOnce({ type: "not_found" });
    const request = new Request("http://localhost/api?userId=other", {
      method: "POST",
      body: JSON.stringify({ userId: "other" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "11111111-1111-4111-a111-111111111111" }),
    });
    expect(response.status).toBe(404);
    expect(completeQuest).toHaveBeenCalledWith(
      undefined,
      "11111111-1111-4111-a111-111111111111",
      "authenticated-user",
    );
  });

  it("無効な UUID の場合は 400 validation_error を返す", async () => {
    const request = new Request("http://localhost:3000/api/quests/invalid-id/complete", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("クエストが存在しない場合は 404 not_found を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(completeQuest).mockResolvedValueOnce({ type: "not_found" });

    const request = new Request(`http://localhost:3000/api/quests/${validUuid}/complete`, {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("クエストが進行中でない場合は 409 conflict を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(completeQuest).mockResolvedValueOnce({
      type: "conflict",
      message: "クエストは進行中ではありません",
    });

    const request = new Request(`http://localhost:3000/api/quests/${validUuid}/complete`, {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toContain("進行中ではありません");
  });

  it("service 処理で例外が発生した場合は 500 internal_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(completeQuest).mockRejectedValueOnce(new Error("DB error"));

    const request = new Request(`http://localhost:3000/api/quests/${validUuid}/complete`, {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("クエストの完了処理に失敗しました");
    expect(JSON.stringify(body)).not.toContain("DB error");
  });

  it("正常に完了した場合は 200 とともにクエスト、獲得XP、合計XP を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    const mockData = {
      quest: {
        id: validUuid,
        taskId: "22222222-2222-4222-a222-222222222222",
        status: "completed" as const,
        isUrgent: false,
        xpEarned: 40,
        startedAt: "2026-10-17T00:00:00Z",
        completedAt: "2026-10-17T01:00:00Z",
      },
      xpGained: 40,
      totalXp: 140,
    };

    vi.mocked(completeQuest).mockResolvedValueOnce({
      type: "success",
      data: mockData,
    });

    const request = new Request(`http://localhost:3000/api/quests/${validUuid}/complete`, {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.quest.id).toBe(validUuid);
    expect(body.quest.status).toBe("completed");
    expect(body.xpGained).toBe(40);
    expect(body.totalXp).toBe(140);
  });
});
