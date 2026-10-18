import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/features/checkpoint/service", () => ({
  getQuestDetail: vi.fn(),
}));

import { getQuestDetail } from "@/features/checkpoint/service";

describe("GET /api/quests/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "authenticated-user" } as User);
  });

  it("未認証なら入力検証前に 401 を返し DB とサービスを呼ばない", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const response = await GET(
      new Request("http://localhost/api?userId=other", { method: "GET" }),
      {
        params: Promise.resolve({ id: "invalid" }),
      },
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthorized");
    expect(supabaseServer).not.toHaveBeenCalled();
    expect(getQuestDetail).not.toHaveBeenCalled();
  });

  it("他ユーザーまたは不存在の対象は同じ 404 とし Cookie のユーザー ID を渡す", async () => {
    vi.mocked(getQuestDetail).mockResolvedValueOnce(null);
    const request = new Request("http://localhost/api?userId=other", { method: "GET" });
    const response = await GET(request, {
      params: Promise.resolve({ id: "11111111-1111-4111-a111-111111111111" }),
    });
    expect(response.status).toBe(404);
    expect(getQuestDetail).toHaveBeenCalledWith(
      undefined,
      "11111111-1111-4111-a111-111111111111",
      "authenticated-user",
    );
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
