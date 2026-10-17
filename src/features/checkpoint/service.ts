import type { SupabaseClient } from "@supabase/supabase-js";
import type { Checkpoint } from "@/lib/schemas";
import type { CheckpointPlan } from "./generate";
import { mapDbCheckpointToSchema } from "./types";

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
