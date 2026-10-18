import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUEST_CACHE_TTL_MS,
  clearQuestCache,
  questCacheKey,
  readQuestCache,
  writeQuestCache,
} from "@/features/quest/cache";
import type { Task } from "@/lib/schemas";

const task: Task = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "本人だけのタスク",
  dueAt: null,
  status: "active",
  shownCount: 1,
  skippedCount: 2,
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
};
const snapshot = {
  tasks: [task],
  choices: { candidates: [task], isUrgent: false, inProgressQuest: null },
};

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("クエストの短期キャッシュ", () => {
  it("ユーザー別に保存し、60秒の有効期限ちょうどで破棄する", () => {
    writeQuestCache("hero", snapshot, 1_000);
    expect(readQuestCache("hero", 1_000 + QUEST_CACHE_TTL_MS - 1)).toEqual({
      ...snapshot,
      savedAt: 1_000,
    });
    expect(readQuestCache("other", 1_000)).toBeNull();
    expect(readQuestCache("hero", 1_000 + QUEST_CACHE_TTL_MS)).toBeNull();
    expect(window.localStorage.getItem(questCacheKey("hero"))).toBeNull();
  });

  it.each([
    "not-json",
    JSON.stringify({ version: 0, userId: "hero", savedAt: 1_000, ...snapshot }),
    JSON.stringify({ version: 1, userId: "other", savedAt: 1_000, ...snapshot }),
    JSON.stringify({ version: 1, userId: "hero", savedAt: 2_000, ...snapshot }),
    JSON.stringify({ version: 1, userId: "hero", savedAt: 1_000, ...snapshot, tasks: [] }),
    JSON.stringify({
      version: 1,
      userId: "hero",
      savedAt: 1_000,
      ...snapshot,
      tasks: [{ ...task, skippedCount: "invalid" }],
    }),
  ])("破損・旧版・所有者違い・未来日時・不整合の保存を信頼しない（%s）", (raw) => {
    window.localStorage.setItem(questCacheKey("hero"), raw);
    expect(readQuestCache("hero", 1_000)).toBeNull();
    expect(window.localStorage.getItem(questCacheKey("hero"))).toBeNull();
  });

  it("未確認の候補や重複タスクは保存しない", () => {
    writeQuestCache("hero", snapshot, 1_000);
    writeQuestCache("hero", { ...snapshot, tasks: [{ ...task, title: "古い内容" }] }, 1_000);
    expect(readQuestCache("hero", 1_000)).toBeNull();
    writeQuestCache("hero", { ...snapshot, tasks: [task, task] }, 1_000);
    expect(readQuestCache("hero", 1_000)).toBeNull();
  });

  it("進行中クエストは対応するタスクと一緒に復元する", () => {
    const inProgress = {
      tasks: [{ ...task, status: "in_quest" as const }],
      choices: {
        isUrgent: false,
        candidates: [],
        inProgressQuest: {
          id: "10000000-0000-4000-8000-000000000002",
          taskId: task.id,
          status: "in_progress" as const,
          isUrgent: false,
          xpEarned: 0,
          startedAt: task.createdAt,
          completedAt: null,
        },
      },
    };
    writeQuestCache("hero", inProgress, 1_000);
    expect(readQuestCache("hero", 1_000)).toEqual({ ...inProgress, savedAt: 1_000 });
    clearQuestCache("hero");
    expect(readQuestCache("hero", 1_000)).toBeNull();
  });

  it("保存領域が利用できないときも読み込み・保存・破棄は例外を出さない", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException("保存できません", "SecurityError");
      });
    }
    expect(() => writeQuestCache("hero", snapshot, 1_000)).not.toThrow();
    expect(readQuestCache("hero", 1_000)).toBeNull();
    expect(() => clearQuestCache("hero")).not.toThrow();
  });
});
