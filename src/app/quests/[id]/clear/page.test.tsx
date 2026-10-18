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
        expect(redirect).not.toHaveBeenCalled();
        expect(notFound).not.toHaveBeenCalled();
      }
    },
  );

  it("親チェックポイントの完了数に基づいて完了数・全数・獲得XPがクリア画面に渡される", async () => {
    vi.mocked(getQuestDetail).mockResolvedValue({
      quest: {
        id: "q",
        taskId: "t",
        status: "completed",
        isUrgent: false,
        xpEarned: 40,
        startedAt: "2026-10-18T00:00:00Z",
        completedAt: "2026-10-18T01:00:00Z",
      },
      task: {
        id: "t",
        title: "親タスク",
        status: "done",
        dueAt: null,
        shownCount: 1,
        skippedCount: 0,
        createdAt: "2026-10-18T00:00:00Z",
        updatedAt: "2026-10-18T00:00:00Z",
      },
      checkpoints: [
        {
          id: "p1",
          questId: "q",
          parentId: null,
          title: "親1",
          description: null,
          position: 1,
          isDone: true,
          doneAt: "2026-10-18T00:00:00Z",
        },
        {
          id: "p2",
          questId: "q",
          parentId: null,
          title: "親2",
          description: null,
          position: 2,
          isDone: true,
          doneAt: "2026-10-18T00:00:00Z",
        },
        {
          id: "p3",
          questId: "q",
          parentId: null,
          title: "親3",
          description: null,
          position: 3,
          isDone: false,
          doneAt: null,
        },
        {
          id: "c1",
          questId: "q",
          parentId: "p1",
          title: "子1",
          description: null,
          position: 1,
          isDone: true,
          doneAt: "2026-10-18T00:00:00Z",
        },
        {
          id: "c2",
          questId: "q",
          parentId: "p2",
          title: "子2",
          description: null,
          position: 1,
          isDone: true,
          doneAt: "2026-10-18T00:00:00Z",
        },
        {
          id: "c3",
          questId: "q",
          parentId: "p1",
          title: "子3",
          description: null,
          position: 2,
          isDone: false,
          doneAt: null,
        },
        {
          id: "c4",
          questId: "q",
          parentId: "p3",
          title: "子4",
          description: null,
          position: 1,
          isDone: false,
          doneAt: null,
        },
      ],
    });

    const page = await QuestClearPage({ params: Promise.resolve({ id: "q" }) });
    expect(page.props.completedCheckpointsCount).toBe(2);
    expect(page.props.totalCheckpointsCount).toBe(3);
    expect(page.props.xpGained).toBe(40);
  });
});
