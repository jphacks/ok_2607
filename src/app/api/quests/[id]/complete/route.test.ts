import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/features/checkpoint/service", () => ({
  completeQuest: vi.fn(),
}));

import { completeQuest } from "@/features/checkpoint/service";

describe("POST /api/quests/[id]/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
