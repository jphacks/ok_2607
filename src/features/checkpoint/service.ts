import type { SupabaseClient } from "@supabase/supabase-js";
import type { Checkpoint, QuestDetailResponse } from "@/lib/schemas";
import type { CheckpointPlan } from "./generate";
import {
  mapDbCheckpointToSchema,
  mapDbQuestToSchema,
  mapDbTaskToSchema,
  sortCheckpointsInTreeOrder,
} from "./types";

export interface QuestTaskDetail {
  quest: {
    id: string;
    taskId: string;
    status: "in_progress" | "completed" | "abandoned";
    isUrgent: boolean;
    xpEarned: number;
    startedAt: string;
    completedAt: string | null;
  };
  task: {
    id: string;
    title: string;
    dueAt: string | null;
    status: string;
  };
}

/**
 * クエストとその元タスクの情報を取得する。
 */
export async function getQuestWithTask(
  supabase: SupabaseClient,
  questId: string,
): Promise<QuestTaskDetail | null> {
  const { data: questRow, error: questError } = await supabase
    .from("quests")
    .select("id, task_id, status, is_urgent, xp_earned, started_at, completed_at")
    .eq("id", questId)
    .maybeSingle();

  if (questError || !questRow) {
    return null;
  }

  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, due_at, status")
    .eq("id", questRow.task_id)
    .maybeSingle();

  if (taskError || !taskRow) {
    return null;
  }

  return {
    quest: {
      id: questRow.id,
      taskId: questRow.task_id,
      status: questRow.status,
      isUrgent: questRow.is_urgent,
      xpEarned: questRow.xp_earned,
      startedAt: questRow.started_at,
      completedAt: questRow.completed_at,
    },
    task: {
      id: taskRow.id,
      title: taskRow.title,
      dueAt: taskRow.due_at,
      status: taskRow.status,
    },
  };
}

/**
 * 生成したプランを DB に保存する（既存のチェックポイントを置換）。
 */
export async function saveCheckpointPlanToDb(
  supabase: SupabaseClient,
  questId: string,
  plan: CheckpointPlan,
): Promise<Checkpoint[]> {
  // 既存のチェックポイントを削除（cascade により子も削除される）
  const { error: deleteError } = await supabase
    .from("checkpoints")
    .delete()
    .eq("quest_id", questId);

  if (deleteError) {
    throw new Error(`既存チェックポイントの削除に失敗しました: ${deleteError.message}`);
  }

  const createdCheckpoints: Checkpoint[] = [];

  for (let i = 0; i < plan.milestones.length; i++) {
    const milestone = plan.milestones[i];

    // 親（全体像）のチェックポイントを登録
    const { data: parentData, error: parentError } = await supabase
      .from("checkpoints")
      .insert({
        quest_id: questId,
        parent_id: null,
        title: milestone.title,
        description: milestone.description ?? null,
        position: i + 1,
        is_done: false,
      })
      .select()
      .single();

    if (parentError || !parentData) {
      throw new Error(`親チェックポイントの保存に失敗しました: ${parentError?.message}`);
    }

    createdCheckpoints.push(mapDbCheckpointToSchema(parentData));

    // 子（具体的な行動）のチェックポイントを登録
    if (milestone.steps.length > 0) {
      const stepRows = milestone.steps.map((step, stepIndex) => ({
        quest_id: questId,
        parent_id: parentData.id,
        title: step.title,
        description: step.description ?? null,
        position: stepIndex + 1,
        is_done: false,
      }));

      const { data: stepsData, error: stepsError } = await supabase
        .from("checkpoints")
        .insert(stepRows)
        .select();

      if (stepsError || !stepsData) {
        throw new Error(`子チェックポイントの保存に失敗しました: ${stepsError?.message}`);
      }

      createdCheckpoints.push(...stepsData.map(mapDbCheckpointToSchema));
    }
  }

  return createdCheckpoints;
}

/**
 * クエスト詳細、紐づくタスク、およびチェックポイント一覧を取得する。
 */
export async function getQuestDetail(
  supabase: SupabaseClient,
  questId: string,
): Promise<QuestDetailResponse | null> {
  const { data: questRow, error: questError } = await supabase
    .from("quests")
    .select("id, task_id, status, is_urgent, xp_earned, started_at, completed_at")
    .eq("id", questId)
    .maybeSingle();

  if (questError || !questRow) {
    return null;
  }

  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, due_at, weight, status, shown_count, skipped_count, created_at, updated_at")
    .eq("id", questRow.task_id)
    .maybeSingle();

  if (taskError || !taskRow) {
    return null;
  }

  const { data: checkpointRows, error: checkpointError } = await supabase
    .from("checkpoints")
    .select("id, quest_id, parent_id, title, description, position, is_done, done_at")
    .eq("quest_id", questId);

  if (checkpointError) {
    throw new Error(`チェックポイント一覧の取得に失敗しました: ${checkpointError.message}`);
  }

  const rawCheckpoints = (checkpointRows ?? []).map(mapDbCheckpointToSchema);
  const checkpoints = sortCheckpointsInTreeOrder(rawCheckpoints);

  return {
    quest: mapDbQuestToSchema(questRow),
    task: mapDbTaskToSchema(taskRow),
    checkpoints,
  };
}

/**
 * チェックポイントの達成状態（isDone / doneAt）を更新する。
 */
export async function updateCheckpointStatus(
  supabase: SupabaseClient,
  checkpointId: string,
  isDone: boolean,
): Promise<Checkpoint | null> {
  const { data: updatedRow, error } = await supabase
    .from("checkpoints")
    .update({
      is_done: isDone,
      done_at: isDone ? new Date().toISOString() : null,
    })
    .eq("id", checkpointId)
    .select("id, quest_id, parent_id, title, description, position, is_done, done_at")
    .maybeSingle();

  if (error) {
    throw new Error(`チェックポイントの更新に失敗しました: ${error.message}`);
  }

  if (!updatedRow) {
    return null;
  }

  return mapDbCheckpointToSchema(updatedRow);
}
