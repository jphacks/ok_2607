import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiGenerationError } from "@/features/checkpoint/generate";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/features/checkpoint/service", () => ({
  getQuestWithTask: vi.fn(),
  saveCheckpointPlanToDb: vi.fn(),
}));

vi.mock("@/features/checkpoint/generate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/checkpoint/generate")>();
  return {
    ...actual,
    generateCheckpointPlan: vi.fn(),
  };
});

import { generateCheckpointPlan } from "@/features/checkpoint/generate";
import { getQuestWithTask, saveCheckpointPlanToDb } from "@/features/checkpoint/service";

describe("POST /api/quests/[id]/checkpoints/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("無効な UUID の場合は 400 validation_error を返す", async () => {
    const request = new Request(
      "http://localhost:3000/api/quests/invalid-id/checkpoints/generate",
      {
        method: "POST",
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("クエストが存在しない場合は 404 not_found を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(getQuestWithTask).mockResolvedValueOnce(null);

    const request = new Request(
      `http://localhost:3000/api/quests/${validUuid}/checkpoints/generate`,
      {
        method: "POST",
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("クエストが進行中でない（completed等）の場合は 409 conflict を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(getQuestWithTask).mockResolvedValueOnce({
      quest: {
        id: validUuid,
        taskId: "task-1",
        status: "completed",
        isUrgent: false,
        xpEarned: 30,
        startedAt: "2026-10-17T00:00:00Z",
        completedAt: "2026-10-17T01:00:00Z",
      },
      task: {
        id: "task-1",
        title: "タスク",
        dueAt: null,
        status: "done",
      },
    });

    const request = new Request(
      `http://localhost:3000/api/quests/${validUuid}/checkpoints/generate`,
      {
        method: "POST",
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("conflict");
  });

  it("AI 生成が失敗した場合は 502 ai_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(getQuestWithTask).mockResolvedValueOnce({
      quest: {
        id: validUuid,
        taskId: "task-1",
        status: "in_progress",
        isUrgent: false,
        xpEarned: 0,
        startedAt: "2026-10-17T00:00:00Z",
        completedAt: null,
      },
      task: {
        id: "task-1",
        title: "タスク",
        dueAt: null,
        status: "in_quest",
      },
    });
    vi.mocked(generateCheckpointPlan).mockRejectedValueOnce(
      new AiGenerationError("Gemini API error"),
    );

    const request = new Request(
      `http://localhost:3000/api/quests/${validUuid}/checkpoints/generate`,
      {
        method: "POST",
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("ai_error");
  });

  it("正常に生成および保存された場合は 200 とチェックポイント配列を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(getQuestWithTask).mockResolvedValueOnce({
      quest: {
        id: validUuid,
        taskId: "task-1",
        status: "in_progress",
        isUrgent: false,
        xpEarned: 0,
        startedAt: "2026-10-17T00:00:00Z",
        completedAt: null,
      },
      task: {
        id: "task-1",
        title: "参考文献を探す",
        dueAt: null,
        status: "in_quest",
      },
    });

    const mockPlan = {
      milestones: [
        {
          title: "全体像1",
          description: null,
          steps: [{ title: "ステップ1", description: null }],
        },
      ],
    };
    vi.mocked(generateCheckpointPlan).mockResolvedValueOnce(mockPlan);

    const mockSavedCheckpoints = [
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
      {
        id: "cp-2",
        questId: validUuid,
        parentId: "cp-1",
        title: "ステップ1",
        description: null,
        position: 1,
        isDone: false,
        doneAt: null,
      },
    ];
    vi.mocked(saveCheckpointPlanToDb).mockResolvedValueOnce(mockSavedCheckpoints);

    const request = new Request(
      `http://localhost:3000/api/quests/${validUuid}/checkpoints/generate`,
      {
        method: "POST",
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.checkpoints).toEqual(mockSavedCheckpoints);
  });

  it("クエスト取得で DB エラーが発生した場合は 500 internal_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(getQuestWithTask).mockRejectedValueOnce(new Error("DB query failure"));

    const request = new Request(
      `http://localhost:3000/api/quests/${validUuid}/checkpoints/generate`,
      {
        method: "POST",
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });

  it("チェックポイント保存で DB エラーが発生した場合は 500 internal_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(getQuestWithTask).mockResolvedValueOnce({
      quest: {
        id: validUuid,
        taskId: "task-1",
        status: "in_progress",
        isUrgent: false,
        xpEarned: 0,
        startedAt: "2026-10-17T00:00:00Z",
        completedAt: null,
      },
      task: {
        id: "task-1",
        title: "タスク",
        dueAt: null,
        status: "in_quest",
      },
    });
    vi.mocked(generateCheckpointPlan).mockResolvedValueOnce({
      milestones: [{ title: "M", steps: [{ title: "S" }] }],
    });
    vi.mocked(saveCheckpointPlanToDb).mockRejectedValueOnce(new Error("RPC transaction failed"));

    const request = new Request(
      `http://localhost:3000/api/quests/${validUuid}/checkpoints/generate`,
      {
        method: "POST",
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });
});
