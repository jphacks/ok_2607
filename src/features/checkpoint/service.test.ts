import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { CheckpointPlan } from "./generate";
import {
  getQuestDetail,
  getQuestWithTask,
  saveCheckpointPlanToDb,
  updateCheckpointStatus,
} from "./service";

describe("checkpoint service", () => {
  describe("getQuestWithTask", () => {
    it("クエストとタスクが存在する場合、情報を取得できる", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "quests") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "quest-1",
                  task_id: "task-1",
                  status: "in_progress",
                  is_urgent: false,
                  xp_earned: 0,
                  started_at: "2026-10-17T00:00:00Z",
                  completed_at: null,
                },
                error: null,
              }),
            };
          }
          if (table === "tasks") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "task-1",
                  title: "レポート作成",
                  due_at: "2026-10-20T00:00:00Z",
                  status: "in_quest",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const result = await getQuestWithTask(mockSupabase, "quest-1");
      expect(result).not.toBeNull();
      expect(result?.quest.id).toBe("quest-1");
      expect(result?.task.title).toBe("レポート作成");
    });

    it("クエストが存在しない場合、null を返す", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as unknown as SupabaseClient;

      const result = await getQuestWithTask(mockSupabase, "non-existent");
      expect(result).toBeNull();
    });
  });

  describe("saveCheckpointPlanToDb", () => {
    it("既存チェックポイントを削除し、親子チェックポイントを正しく保存して返す", async () => {
      const plan: CheckpointPlan = {
        milestones: [
          {
            title: "全体像1",
            description: "説明1",
            steps: [
              { title: "ステップ1-1", description: "子説明1-1" },
              { title: "ステップ1-2", description: null },
            ],
          },
        ],
      };

      const mockDelete = vi.fn().mockReturnThis();
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });

      const mockInsertParent = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "parent-uuid-1",
              quest_id: "quest-1",
              parent_id: null,
              title: "全体像1",
              description: "説明1",
              position: 1,
              is_done: false,
              done_at: null,
            },
            error: null,
          }),
        }),
      });

      const mockInsertSteps = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            {
              id: "child-uuid-1",
              quest_id: "quest-1",
              parent_id: "parent-uuid-1",
              title: "ステップ1-1",
              description: "子説明1-1",
              position: 1,
              is_done: false,
              done_at: null,
            },
            {
              id: "child-uuid-2",
              quest_id: "quest-1",
              parent_id: "parent-uuid-1",
              title: "ステップ1-2",
              description: null,
              position: 2,
              is_done: false,
              done_at: null,
            },
          ],
          error: null,
        }),
      });

      let insertCallCount = 0;
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "checkpoints") {
            return {
              delete: mockDelete.mockReturnValue({ eq: mockDeleteEq }),
              insert: vi.fn((payload) => {
                insertCallCount++;
                if (insertCallCount === 1) {
                  return mockInsertParent(payload);
                }
                return mockInsertSteps(payload);
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const results = await saveCheckpointPlanToDb(mockSupabase, "quest-1", plan);

      expect(mockDeleteEq).toHaveBeenCalledWith("quest_id", "quest-1");
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        id: "parent-uuid-1",
        questId: "quest-1",
        parentId: null,
        title: "全体像1",
        description: "説明1",
        position: 1,
        isDone: false,
        doneAt: null,
      });
      expect(results[1]).toEqual({
        id: "child-uuid-1",
        questId: "quest-1",
        parentId: "parent-uuid-1",
        title: "ステップ1-1",
        description: "子説明1-1",
        position: 1,
        isDone: false,
        doneAt: null,
      });
      expect(results[2]).toEqual({
        id: "child-uuid-2",
        questId: "quest-1",
        parentId: "parent-uuid-1",
        title: "ステップ1-2",
        description: null,
        position: 2,
        isDone: false,
        doneAt: null,
      });
    });

    it("削除時にエラーが返った場合、例外を投げる", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: new Error("DB delete failed") }),
          }),
        }),
      } as unknown as SupabaseClient;

      await expect(
        saveCheckpointPlanToDb(mockSupabase, "quest-1", { milestones: [] }),
      ).rejects.toThrow("既存チェックポイントの削除に失敗しました");
    });
  });

  describe("getQuestDetail", () => {
    it("クエスト、タスク、チェックポイント一覧を階層順で取得できる", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "quests") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "quest-1",
                  task_id: "task-1",
                  status: "in_progress",
                  is_urgent: false,
                  xp_earned: 0,
                  started_at: "2026-10-17T00:00:00Z",
                  completed_at: null,
                },
                error: null,
              }),
            };
          }
          if (table === "tasks") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "task-1",
                  title: "本を読む",
                  due_at: null,
                  weight: 1.0,
                  status: "in_quest",
                  shown_count: 1,
                  skipped_count: 0,
                  created_at: "2026-10-17T00:00:00Z",
                  updated_at: "2026-10-17T00:00:00Z",
                },
                error: null,
              }),
            };
          }
          if (table === "checkpoints") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "child-1",
                    quest_id: "quest-1",
                    parent_id: "parent-1",
                    title: "ステップ1",
                    description: null,
                    position: 1,
                    is_done: false,
                    done_at: null,
                  },
                  {
                    id: "parent-1",
                    quest_id: "quest-1",
                    parent_id: null,
                    title: "全体像1",
                    description: null,
                    position: 1,
                    is_done: false,
                    done_at: null,
                  },
                ],
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const result = await getQuestDetail(mockSupabase, "quest-1");
      expect(result).not.toBeNull();
      expect(result?.quest.id).toBe("quest-1");
      expect(result?.task.id).toBe("task-1");
      expect(result?.checkpoints).toHaveLength(2);
      // 親が最初に来て、その後に子が来る
      expect(result?.checkpoints[0].id).toBe("parent-1");
      expect(result?.checkpoints[1].id).toBe("child-1");
    });

    it("クエストが存在しない場合は null を返す", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as unknown as SupabaseClient;

      const result = await getQuestDetail(mockSupabase, "non-existent");
      expect(result).toBeNull();
    });
  });

  describe("updateCheckpointStatus", () => {
    it("isDone: true でチェックポイントを更新できる", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "cp-1",
              quest_id: "q-1",
              parent_id: null,
              title: "全体像",
              description: null,
              position: 1,
              is_done: true,
              done_at: "2026-10-17T06:00:00Z",
            },
            error: null,
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await updateCheckpointStatus(mockSupabase, "cp-1", true);

      expect(result).not.toBeNull();
      expect(result?.isDone).toBe(true);
      expect(result?.doneAt).toBe("2026-10-17T06:00:00Z");
    });

    it("チェックポイントが存在しない場合は null を返す", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as unknown as SupabaseClient;

      const result = await updateCheckpointStatus(mockSupabase, "non-existent", true);
      expect(result).toBeNull();
    });

    it("DB 更新でエラーが発生した場合は例外をスローする", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ error: new Error("DB update error") }),
        }),
      } as unknown as SupabaseClient;

      await expect(updateCheckpointStatus(mockSupabase, "cp-1", true)).rejects.toThrow(
        "チェックポイントの更新に失敗しました",
      );
    });
  });
});
