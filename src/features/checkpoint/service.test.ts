import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  completeQuest,
  getQuestDetail,
  getQuestWithTask,
  saveCheckpointPlanToDb,
  updateCheckpoint,
} from "./service";

type Row = Record<string, unknown>;
const date = "2026-10-17T00:00:00Z";
function fixture(
  options: {
    questOwner?: string | null;
    taskOwner?: string | null;
    status?: string;
    urgent?: boolean;
    fail?: string;
    reparent?: boolean;
    checkpoints?: Row[];
  } = {},
) {
  const quest: Row = {
    id: "quest-1",
    task_id: "task-1",
    user_id: options.questOwner === undefined ? "owner" : options.questOwner,
    status: options.status ?? "in_progress",
    is_urgent: options.urgent ?? false,
    xp_earned: 0,
    started_at: date,
    completed_at: null,
  };
  const task: Row = {
    id: "task-1",
    user_id: options.taskOwner === undefined ? "owner" : options.taskOwner,
    title: "本を読む",
    due_at: null,
    status: "in_quest",
    shown_count: 1,
    skipped_count: 0,
    created_at: date,
    updated_at: date,
  };
  const parent: Row = {
    id: "parent-1",
    quest_id: "quest-1",
    parent_id: null,
    title: "全体像",
    description: null,
    position: 1,
    is_done: true,
    done_at: date,
  };
  const child: Row = {
    ...parent,
    id: "child-1",
    parent_id: "parent-1",
    title: "ステップ",
    is_done: false,
    done_at: null,
  };
  const tables: Record<string, Row[]> = {
    quests: [quest],
    tasks: [task],
    checkpoints: options.checkpoints ?? [child, parent],
  };
  const updates = vi.fn();
  const rpc = vi.fn(
    async (
      name: string,
      params: Row,
    ): Promise<{ data: unknown; error: { message: string } | null }> => {
      if (options.fail === "rpc") return { data: null, error: { message: "RPC error" } };
      if (name === "replace_quest_checkpoints") return { data: [child, parent], error: null };
      return {
        data: {
          quest: {
            ...quest,
            status: "completed",
            xp_earned: params.p_xp_earned,
            completed_at: date,
          },
          total_xp: 140,
        },
        error: null,
      };
    },
  );
  const from = vi.fn((table: string) => {
    const filters: [string, unknown][] = [];
    let patch: Row | undefined;
    const result = () => {
      if (options.fail === table || (patch && options.fail === "update"))
        return { data: null, error: { message: "DB error" } };
      const rows = tables[table].filter((row) =>
        filters.every(([key, value]) => row[key] === value),
      );
      if (patch) {
        rows.forEach((row) => Object.assign(row, patch));
        updates(rows.length);
      }
      return { data: rows, error: null };
    };
    const query = {
      select: vi.fn().mockImplementation(() => query),
      eq: vi.fn((key: string, value: unknown) => {
        filters.push([key, value]);
        return query;
      }),
      is: vi.fn((key: string, value: unknown) => {
        filters.push([key, value]);
        return query;
      }),
      update: vi.fn((value: Row) => {
        if (options.reparent) child.quest_id = "foreign-quest";
        patch = value;
        return query;
      }),
      maybeSingle: vi.fn(async () => {
        const response = result();
        return { ...response, data: response.data?.[0] ? { ...response.data[0] } : null };
      }),
      then: <
        TResult1 = { data: Row[] | null; error: { message: string } | null },
        TResult2 = never,
      >(
        resolve?:
          | ((value: {
              data: Row[] | null;
              error: { message: string } | null;
            }) => TResult1 | PromiseLike<TResult1>)
          | null,
        reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  });
  return { db: { from, rpc } as unknown as SupabaseClient, from, rpc, updates, child };
}

describe("checkpoint service の所有者境界", () => {
  it("本人のクエストとタスク、階層順のチェックポイントを取得できる", async () => {
    const { db } = fixture();
    expect((await getQuestWithTask(db, "quest-1", "owner"))?.task.title).toBe("本を読む");
    const detail = await getQuestDetail(db, "quest-1", "owner");
    expect(detail?.checkpoints.map((cp) => cp.id)).toEqual(["parent-1", "child-1"]);
  });

  it.each([
    { questOwner: "other" },
    { questOwner: null },
    { taskOwner: "other" },
    { taskOwner: null },
  ])("他ユーザー・NULL所有者・偽造された親子関係を拒否する: %j", async (options) => {
    const { db, updates, rpc, child } = fixture(options);
    expect(await getQuestWithTask(db, "quest-1", "owner")).toBeNull();
    expect(await getQuestDetail(db, "quest-1", "owner")).toBeNull();
    expect(await updateCheckpoint(db, "child-1", { isDone: true }, "owner")).toBeNull();
    expect(await completeQuest(db, "quest-1", "owner")).toEqual({ type: "not_found" });
    expect(child.is_done).toBe(false);
    expect(updates).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("他ユーザーのクエストではチェックポイントを取得しない", async () => {
    const { db, from } = fixture({ questOwner: "other" });

    expect(await getQuestDetail(db, "quest-1", "owner")).toBeNull();
    expect(from).not.toHaveBeenCalledWith("checkpoints");
  });

  it("元タスクの所有者が異なる場合は並行取得のチェックポイントエラーも公開しない", async () => {
    const { db } = fixture({ taskOwner: "other", fail: "checkpoints" });

    expect(await getQuestDetail(db, "quest-1", "owner")).toBeNull();
  });

  it("存在しない対象は取得・更新・完了できない", async () => {
    const { db, rpc, updates } = fixture();
    expect(await getQuestWithTask(db, "missing", "owner")).toBeNull();
    expect(await getQuestDetail(db, "missing", "owner")).toBeNull();
    expect(await updateCheckpoint(db, "missing", { isDone: true }, "owner")).toBeNull();
    expect(await completeQuest(db, "missing", "owner")).toEqual({ type: "not_found" });
    expect(rpc).not.toHaveBeenCalled();
    expect(updates).not.toHaveBeenCalled();
  });

  it("本人のチェックポイントの達成と取消を保存できる", async () => {
    const { db, child } = fixture();
    const result = await updateCheckpoint(db, "child-1", { isDone: true }, "owner");
    expect(result?.isDone).toBe(true);
    expect(result?.doneAt).toEqual(expect.any(String));
    expect(child.is_done).toBe(true);
    const undone = await updateCheckpoint(db, "child-1", { isDone: false }, "owner");
    expect(undone?.isDone).toBe(false);
    expect(undone?.doneAt).toBeNull();
  });

  it("検証後に別クエストへ移されたチェックポイントは更新しない", async () => {
    const { db, child } = fixture({ reparent: true });
    expect(await updateCheckpoint(db, "child-1", { isDone: true }, "owner")).toBeNull();
    expect(child.is_done).toBe(false);
  });

  it.each([
    { urgent: false, xp: 30 },
    { urgent: true, xp: 45 },
  ])("本人の完了は経験値を計算し RPC に認証ユーザーを渡す: %j", async ({ urgent, xp }) => {
    const { db, rpc } = fixture({ urgent });
    const result = await completeQuest(db, "quest-1", "owner");
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.data.xpGained).toBe(xp);
      expect(result.data.totalXp).toBe(140);
      expect(result.data.quest.status).toBe("completed");
    }
    expect(rpc).toHaveBeenCalledWith("complete_quest", {
      p_quest_id: "quest-1",
      p_xp_earned: xp,
      p_user_id: "owner",
    });
  });

  it("親チェックポイントの完了数のみを対象にして経験値を算出し、子ステップの完了数を加算しない", async () => {
    const parent1: Row = {
      id: "parent-1",
      quest_id: "quest-1",
      parent_id: null,
      title: "親1",
      position: 1,
      is_done: true,
      done_at: date,
    };
    const parent2: Row = {
      id: "parent-2",
      quest_id: "quest-1",
      parent_id: null,
      title: "親2",
      position: 2,
      is_done: true,
      done_at: date,
    };
    const parent3: Row = {
      id: "parent-3",
      quest_id: "quest-1",
      parent_id: null,
      title: "親3",
      position: 3,
      is_done: false,
      done_at: null,
    };
    const child1: Row = {
      id: "child-1",
      quest_id: "quest-1",
      parent_id: "parent-1",
      title: "子1",
      position: 1,
      is_done: true,
      done_at: date,
    };
    const child2: Row = {
      id: "child-2",
      quest_id: "quest-1",
      parent_id: "parent-2",
      title: "子2",
      position: 1,
      is_done: true,
      done_at: date,
    };
    const child3: Row = {
      id: "child-3",
      quest_id: "quest-1",
      parent_id: "parent-1",
      title: "子3",
      position: 2,
      is_done: false,
      done_at: null,
    };
    const child4: Row = {
      id: "child-4",
      quest_id: "quest-1",
      parent_id: "parent-3",
      title: "子4",
      position: 1,
      is_done: false,
      done_at: null,
    };

    const { db, rpc } = fixture({
      checkpoints: [parent1, parent2, parent3, child1, child2, child3, child4],
    });

    const result = await completeQuest(db, "quest-1", "owner");
    expect(result.type).toBe("success");
    if (result.type === "success") {
      // 親チェックポイント完了 2 件分: 基本 20 XP + 2 * 10 XP = 40 XP
      expect(result.data.xpGained).toBe(40);
    }
    expect(rpc).toHaveBeenCalledWith("complete_quest", {
      p_quest_id: "quest-1",
      p_xp_earned: 40,
      p_user_id: "owner",
    });
  });

  it("完了済みは競合として RPC を呼ばない", async () => {
    const { db, rpc } = fixture({ status: "completed" });
    expect((await completeQuest(db, "quest-1", "owner")).type).toBe("conflict");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("RPC が競合を返したら conflict にする", async () => {
    const { db, rpc } = fixture();
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await completeQuest(db, "quest-1", "owner")).type).toBe("conflict");
  });

  it.each(["quests", "tasks", "checkpoints", "rpc"])(
    "完了時の %s エラーを通知する",
    async (fail) => {
      const { db } = fixture({ fail });
      await expect(completeQuest(db, "quest-1", "owner")).rejects.toThrow();
    },
  );
  it.each(["quests", "tasks", "checkpoints"])("詳細取得時の %s エラーを通知する", async (fail) => {
    const { db } = fixture({ fail });
    await expect(getQuestDetail(db, "quest-1", "owner")).rejects.toThrow();
  });
  it.each(["checkpoints", "update"])("更新時の %s エラーを通知する", async (fail) => {
    const { db } = fixture({ fail });
    await expect(updateCheckpoint(db, "child-1", { isDone: true }, "owner")).rejects.toThrow();
  });

  it("生成プランは RPC で原子的に置換して階層順に返す", async () => {
    const { db, rpc } = fixture();
    const plan = { milestones: [{ title: "全体像", steps: [{ title: "ステップ" }] }] };
    const result = await saveCheckpointPlanToDb(db, "quest-1", plan);
    expect(result.map((cp) => cp.id)).toEqual(["parent-1", "child-1"]);
    expect(rpc).toHaveBeenCalledWith("replace_quest_checkpoints", {
      p_quest_id: "quest-1",
      p_milestones: plan.milestones,
    });
  });
  it("生成プラン保存時の RPC エラーを通知する", async () => {
    const { db } = fixture({ fail: "rpc" });
    await expect(saveCheckpointPlanToDb(db, "quest-1", { milestones: [] })).rejects.toThrow(
      "原子的置換",
    );
  });
});

describe("チェックポイント名の部分更新", () => {
  it("名前だけ変更し、達成状態と完了日時を保持する", async () => {
    const { db, child } = fixture();
    child.is_done = true;
    child.done_at = date;
    const result = await updateCheckpoint(db, "child-1", { title: "保存した名前" }, "owner");
    expect(result?.title).toBe("保存した名前");
    expect(child.title).toBe("保存した名前");
    expect(result?.isDone).toBe(true);
    expect(result?.doneAt).toBe(date);
  });
  it("他ユーザーの名前は変更しない", async () => {
    const { db, child, updates } = fixture({ questOwner: "other" });
    expect(await updateCheckpoint(db, "child-1", { title: "変更不可" }, "owner")).toBeNull();
    expect(child.title).toBe("ステップ");
    expect(updates).not.toHaveBeenCalled();
  });
});
