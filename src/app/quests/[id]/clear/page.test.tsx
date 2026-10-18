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
});
