import { beforeEach, describe, expect, it, vi } from "vitest";
import { getQuestDetail } from "@/features/checkpoint/service";
import { notFound, redirect } from "next/navigation";
import QuestClearPage from "./page";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "user" })) }));
vi.mock("@/features/task/server", () => ({
  getStats: vi.fn(async () => ({ totalXp: 30, completedQuests: 1 })),
}));
vi.mock("@/features/checkpoint/service", () => ({ getQuestDetail: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn(() => ({})) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

describe("クリア画面の保存状態確認", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["in_progress", "abandoned", "completed"] as const)(
    "%s の状態で正しい画面を選ぶ",
    async (status) => {
      vi.mocked(getQuestDetail).mockResolvedValue({
        quest: {
          id: "q",
          taskId: "t",
          status,
          isUrgent: false,
          xpEarned: 30,
          startedAt: "2026-10-18T00:00:00Z",
          completedAt: null,
        },
        task: {
          id: "t",
          title: "保存済み",
          status: "done",
          dueAt: null,
          shownCount: 0,
          skippedCount: 0,
          createdAt: "2026-10-18T00:00:00Z",
          updatedAt: "2026-10-18T00:00:00Z",
        },
        checkpoints: [],
      });
      const result = QuestClearPage({ params: Promise.resolve({ id: "q" }) });
      if (status === "in_progress") {
        await expect(result).rejects.toThrow("redirect");
        expect(redirect).toHaveBeenCalledWith("/quests/q");
      } else if (status === "abandoned") {
        await expect(result).rejects.toThrow("not-found");
        expect(notFound).toHaveBeenCalled();
      } else {
        expect((await result).props.xpGained).toBe(30);
        expect((await result).props.totalCheckpointsCount).toBe(0);
        expect((await result).props.completedCheckpointsCount).toBe(0);
        expect(redirect).not.toHaveBeenCalled();
        expect(notFound).not.toHaveBeenCalled();
      }
    },
  );

  it("チェックポイントを持たない（親チェックポイントが0件の）完了クエストで totalCheckpointsCount が 0 となる（5 にフォールバックしない）", async () => {
    vi.mocked(getQuestDetail).mockResolvedValue({
      quest: {
        id: "q-zero",
        taskId: "t",
        status: "completed",
        isUrgent: false,
        xpEarned: 50,
        startedAt: "2026-10-18T00:00:00Z",
        completedAt: "2026-10-18T01:00:00Z",
      },
      task: {
        id: "t",
        title: "タスク",
        status: "done",
        dueAt: null,
        shownCount: 0,
        skippedCount: 0,
        createdAt: "2026-10-18T00:00:00Z",
        updatedAt: "2026-10-18T00:00:00Z",
      },
      checkpoints: [],
    });

    const page = await QuestClearPage({ params: Promise.resolve({ id: "q-zero" }) });
    expect(page.props.totalCheckpointsCount).toBe(0);
    expect(page.props.completedCheckpointsCount).toBe(0);
  });

  it("チェックポイントを3件持つ完了クエストで totalCheckpointsCount と completedCheckpointsCount が正しく 3 となる", async () => {
    vi.mocked(getQuestDetail).mockResolvedValue({
      quest: {
        id: "q-three",
        taskId: "t",
        status: "completed",
        isUrgent: false,
        xpEarned: 100,
        startedAt: "2026-10-18T00:00:00Z",
        completedAt: "2026-10-18T01:00:00Z",
      },
      task: {
        id: "t",
        title: "タスク",
        status: "done",
        dueAt: null,
        shownCount: 0,
        skippedCount: 0,
        createdAt: "2026-10-18T00:00:00Z",
        updatedAt: "2026-10-18T00:00:00Z",
      },
      checkpoints: [
        {
          id: "cp-1",
          questId: "q-three",
          parentId: null,
          title: "CP 1",
          description: null,
          position: 0,
          isDone: true,
          doneAt: "2026-10-18T00:10:00Z",
        },
        {
          id: "cp-2",
          questId: "q-three",
          parentId: null,
          title: "CP 2",
          description: null,
          position: 1,
          isDone: true,
          doneAt: "2026-10-18T00:20:00Z",
        },
        {
          id: "cp-3",
          questId: "q-three",
          parentId: null,
          title: "CP 3",
          description: null,
          position: 2,
          isDone: true,
          doneAt: "2026-10-18T00:30:00Z",
        },
        {
          id: "cp-child",
          questId: "q-three",
          parentId: "cp-1",
          title: "Child CP",
          description: null,
          position: 0,
          isDone: true,
          doneAt: "2026-10-18T00:05:00Z",
        },
      ],
    });

    const page = await QuestClearPage({ params: Promise.resolve({ id: "q-three" }) });
    expect(page.props.totalCheckpointsCount).toBe(3);
    expect(page.props.completedCheckpointsCount).toBe(3);
  });
});
