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

    it("クエスト取得で DB エラーが発生した場合、例外をスローする", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ error: new Error("DB connection error") }),
        }),
      } as unknown as SupabaseClient;

      await expect(getQuestWithTask(mockSupabase, "quest-1")).rejects.toThrow(
        "クエストの取得に失敗しました",
      );
    });
  });

  describe("saveCheckpointPlanToDb", () => {
    it("replace_quest_checkpoints RPC を呼び出して原子的に置換し、チェックポイント配列を返す", async () => {
      const plan: CheckpointPlan = {
        milestones: [
          {
            title: "全体像1",
            description: "説明1",
            steps: [{ title: "ステップ1-1", description: "子説明1-1" }],
          },
        ],
      };

      const mockRows = [
        {
          id: "parent-uuid-1",
          quest_id: "quest-1",
          parent_id: null,
          title: "全体像1",
          description: "説明1",
          position: 1,
          is_done: false,
          done_at: null,
        },
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
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: mockRows,
          error: null,
        }),
      } as unknown as SupabaseClient;

      const results = await saveCheckpointPlanToDb(mockSupabase, "quest-1", plan);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("replace_quest_checkpoints", {
        p_quest_id: "quest-1",
        p_milestones: plan.milestones,
      });
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("parent-uuid-1");
      expect(results[1].id).toBe("child-uuid-1");
    });

    it("RPC 呼び出しでエラーが発生した場合、例外をスローする", async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("Transaction aborted"),
        }),
      } as unknown as SupabaseClient;

      await expect(
        saveCheckpointPlanToDb(mockSupabase, "quest-1", { milestones: [] }),
      ).rejects.toThrow("チェックポイントの原子的置換に失敗しました");
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

    it("クエスト詳細取得で DB エラーが発生した場合、例外をスローする", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ error: new Error("DB connection error") }),
        }),
      } as unknown as SupabaseClient;

      await expect(getQuestDetail(mockSupabase, "quest-1")).rejects.toThrow(
        "クエストの取得に失敗しました",
      );
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
