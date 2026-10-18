import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/features/checkpoint/service", () => ({
  getQuestDetail: vi.fn(),
}));

import { getQuestDetail } from "@/features/checkpoint/service";

describe("GET /api/quests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("無効な UUID の場合は 400 validation_error を返す", async () => {
    const request = new Request("http://localhost:3000/api/quests/invalid-id");
    const response = await GET(request, {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("クエストが存在しない場合は 404 not_found を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(getQuestDetail).mockResolvedValueOnce(null);

    const request = new Request(`http://localhost:3000/api/quests/${validUuid}`);
    const response = await GET(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("正常にクエスト詳細を取得できた場合は 200 と詳細データを返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    const mockDetail = {
      quest: {
        id: validUuid,
        taskId: "task-1",
        status: "in_progress" as const,
        isUrgent: false,
        xpEarned: 0,
        startedAt: "2026-10-17T00:00:00Z",
        completedAt: null,
      },
      task: {
        id: "task-1",
        title: "本を読む",
        dueAt: null,
        status: "in_quest" as const,
        shownCount: 1,
        skippedCount: 0,
        createdAt: "2026-10-17T00:00:00Z",
        updatedAt: "2026-10-17T00:00:00Z",
      },
      checkpoints: [
        {
          id: "cp-1",
          questId: validUuid,
          parentId: null,
          title: "全体像1",
          description: null,
          position: 1,
          isDone: false,
          doneAt: null,
        },
      ],
    };

    vi.mocked(getQuestDetail).mockResolvedValueOnce(mockDetail);

    const request = new Request(`http://localhost:3000/api/quests/${validUuid}`);
    const response = await GET(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockDetail);
  });

  it("DB 処理等で例外が発生した場合は 500 internal_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(getQuestDetail).mockRejectedValueOnce(new Error("DB error"));

    const request = new Request(`http://localhost:3000/api/quests/${validUuid}`);
    const response = await GET(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });
});
