import { describe, expect, it } from "vitest";
import type { Checkpoint } from "@/lib/schemas";
import {
  mapDbCheckpointToSchema,
  mapDbQuestToSchema,
  mapDbTaskToSchema,
  sortCheckpointsInTreeOrder,
} from "./types";

describe("checkpoint types and mappers", () => {
  it("mapDbCheckpointToSchema で正しく camelCase に変換できる", () => {
    const row = {
      id: "cp-1",
      quest_id: "q-1",
      parent_id: null,
      title: "タイトル",
      description: "説明",
      position: 1,
      is_done: false,
      done_at: null,
    };
    expect(mapDbCheckpointToSchema(row)).toEqual({
      id: "cp-1",
      questId: "q-1",
      parentId: null,
      title: "タイトル",
      description: "説明",
      position: 1,
      isDone: false,
      doneAt: null,
    });
  });

  it("mapDbQuestToSchema で正しく camelCase に変換できる", () => {
    const row = {
      id: "q-1",
      task_id: "t-1",
      status: "in_progress" as const,
      is_urgent: true,
      xp_earned: 50,
      started_at: "2026-10-17T00:00:00Z",
      completed_at: null,
    };
    expect(mapDbQuestToSchema(row)).toEqual({
      id: "q-1",
      taskId: "t-1",
      status: "in_progress",
      isUrgent: true,
      xpEarned: 50,
      startedAt: "2026-10-17T00:00:00Z",
      completedAt: null,
    });
  });

  it("mapDbTaskToSchema で正しく camelCase に変換できる", () => {
    const row = {
      id: "t-1",
      title: "タスク",
      due_at: "2026-10-20T00:00:00Z",
      weight: 1.5,
      status: "active" as const,
      shown_count: 3,
      skipped_count: 1,
      created_at: "2026-10-17T00:00:00Z",
      updated_at: "2026-10-17T00:00:00Z",
    };
    expect(mapDbTaskToSchema(row)).toEqual({
      id: "t-1",
      title: "タスク",
      dueAt: "2026-10-20T00:00:00Z",
      weight: 1.5,
      status: "active",
      shownCount: 3,
      skippedCount: 1,
      createdAt: "2026-10-17T00:00:00Z",
      updatedAt: "2026-10-17T00:00:00Z",
    });
  });

  it("sortCheckpointsInTreeOrder で親と子が階層順に並ぶ", () => {
    const checkpoints: Checkpoint[] = [
      {
        id: "child-2-1",
        questId: "q-1",
        parentId: "parent-2",
        title: "ステップ2-1",
        description: null,
        position: 1,
        isDone: false,
        doneAt: null,
      },
      {
        id: "parent-2",
        questId: "q-1",
        parentId: null,
        title: "全体像2",
        description: null,
        position: 2,
        isDone: false,
        doneAt: null,
      },
      {
        id: "child-1-2",
        questId: "q-1",
        parentId: "parent-1",
        title: "ステップ1-2",
        description: null,
        position: 2,
        isDone: false,
        doneAt: null,
      },
      {
        id: "parent-1",
        questId: "q-1",
        parentId: null,
        title: "全体像1",
        description: null,
        position: 1,
        isDone: false,
        doneAt: null,
      },
      {
        id: "child-1-1",
        questId: "q-1",
        parentId: "parent-1",
        title: "ステップ1-1",
        description: null,
        position: 1,
        isDone: false,
        doneAt: null,
      },
    ];

    const sorted = sortCheckpointsInTreeOrder(checkpoints);
    expect(sorted.map((c) => c.id)).toEqual([
      "parent-1",
      "child-1-1",
      "child-1-2",
      "parent-2",
      "child-2-1",
    ]);
  });
});
