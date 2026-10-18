import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { getStats } from "@/features/task/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getQuestDetail } from "@/features/checkpoint/service";
import QuestPage from "./page";
import QuestCheckpointsPage from "./checkpoints/page";
import QuestClearPage from "./clear/page";

vi.mock("@/features/task/server", () => ({ getStats: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("@/features/checkpoint/service", () => ({ getQuestDetail: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/features/checkpoint/components/QuestProgressScreen", () => ({
  QuestProgressScreen: vi.fn(),
}));
vi.mock("@/features/checkpoint/components/CheckpointGenerationScreen", () => ({
  CheckpointGenerationScreen: vi.fn(),
}));
vi.mock("@/features/checkpoint/components/QuestClearScreen", () => ({ QuestClearScreen: vi.fn() }));

const detail = {
  quest: {
    id: "quest-1",
    taskId: "task-1",
    status: "in_progress" as const,
    isUrgent: false,
    xpEarned: 0,
    startedAt: "2026-10-17T00:00:00Z",
    completedAt: null,
  },
  task: {
    id: "task-1",
    title: "本人のタスク",
    dueAt: null,
    status: "in_quest" as const,
    shownCount: 0,
    skippedCount: 0,
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
  },
  checkpoints: [],
};

describe.each([
  { name: "進行", page: QuestPage },
  { name: "生成", page: QuestCheckpointsPage },
  { name: "クリア", page: QuestClearPage },
])("クエスト SSR $name", ({ page }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "owner" } as User);
  });
  it("未認証なら DB 操作前にホームへリダイレクトする", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    await expect(page({ params: Promise.resolve({ id: "quest-1" }) })).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith("/");
    expect(supabaseServer).not.toHaveBeenCalled();
    expect(getQuestDetail).not.toHaveBeenCalled();
    expect(getStats).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });
  it("認証済み本人の ID でのみ取得する", async () => {
    vi.mocked(getQuestDetail).mockResolvedValueOnce(
      page === QuestClearPage
        ? { ...detail, quest: { ...detail.quest, status: "completed" } }
        : detail,
    );
    vi.mocked(getStats).mockResolvedValueOnce({ totalXp: 120, completedQuests: 1 });
    const result = await page({ params: Promise.resolve({ id: "quest-1" }) });
    expect(getQuestDetail).toHaveBeenCalledWith(undefined, "quest-1", "owner");
    expect(getStats).toHaveBeenCalledWith("owner");
    expect(result.props.taskTitle).toBe("本人のタスク");
    expect(result.props.level).toBe(3);
  });
  it("他ユーザーまたは不存在なら notFound にする", async () => {
    vi.mocked(getQuestDetail).mockResolvedValueOnce(null);
    await expect(page({ params: Promise.resolve({ id: "quest-1" }) })).rejects.toThrow("notFound");
    expect(notFound).toHaveBeenCalledOnce();
  });
  it("累計経験値が 0 XP（Lv. 1）のとき level に 1 が渡される", async () => {
    vi.mocked(getQuestDetail).mockResolvedValueOnce(
      page === QuestClearPage
        ? { ...detail, quest: { ...detail.quest, status: "completed" } }
        : detail,
    );
    vi.mocked(getStats).mockResolvedValueOnce({ totalXp: 0, completedQuests: 0 });
    const result = await page({ params: Promise.resolve({ id: "quest-1" }) });
    expect(result.props.level).toBe(1);
  });
  it("getStats が失敗してもデフォルト Lv. 1 でフォールバック表示できる", async () => {
    vi.mocked(getQuestDetail).mockResolvedValueOnce(
      page === QuestClearPage
        ? { ...detail, quest: { ...detail.quest, status: "completed" } }
        : detail,
    );
    vi.mocked(getStats).mockRejectedValueOnce(new Error("stats error"));
    const result = await page({ params: Promise.resolve({ id: "quest-1" }) });
    expect(result.props.level).toBe(1);
  });
  it("公開デモは固定データを表示し認証と DB を呼ばない", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const result = await page({ params: Promise.resolve({ id: "demo" }) });
    expect(result.props.questId).toBe("demo");
    expect(result.props.level).toBe(4);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(supabaseServer).not.toHaveBeenCalled();
    expect(getQuestDetail).not.toHaveBeenCalled();
    expect(getStats).not.toHaveBeenCalled();
  });
});
