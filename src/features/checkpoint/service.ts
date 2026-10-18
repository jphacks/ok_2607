import type { SupabaseClient } from "@supabase/supabase-js";
import type { Checkpoint, CompleteQuestResponse, QuestDetailResponse } from "@/lib/schemas";
import type { CheckpointPlan } from "./generate";
import {
  type DbCheckpointRow,
  type DbQuestRow,
  mapDbCheckpointToSchema,
  mapDbQuestToSchema,
  mapDbTaskToSchema,
  sortCheckpointsInTreeOrder,
} from "./types";
import { calculateQuestXp } from "./xp";

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
  userId: string,
): Promise<QuestTaskDetail | null> {
  const { data: questRow, error: questError } = await supabase
    .from("quests")
    .select("id, task_id, status, is_urgent, xp_earned, started_at, completed_at")
    .eq("id", questId)
    .eq("user_id", userId)
    .maybeSingle();

  if (questError) {
    throw new Error(`クエストの取得に失敗しました: ${questError.message}`);
  }
  if (!questRow) {
    return null;
  }

  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, due_at, status")
    .eq("id", questRow.task_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskError) {
    throw new Error(`タスクの取得に失敗しました: ${taskError.message}`);
  }
  if (!taskRow) {
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
 * 生成したプランを DB に保存する（既存のチェックポイントを原子的に置換）。
 * PostgreSQL の replace_quest_checkpoints RPC を呼ぶことで 1 つのトランザクションとして実行され、
 * 途中失敗時にロールバックされて既存データ損失を防ぐ。
 */
export async function saveCheckpointPlanToDb(
  supabase: SupabaseClient,
  questId: string,
  plan: CheckpointPlan,
): Promise<Checkpoint[]> {
  const { data: rows, error } = await supabase.rpc("replace_quest_checkpoints", {
    p_quest_id: questId,
    p_milestones: plan.milestones,
  });

  if (error) {
    throw new Error(`チェックポイントの原子的置換に失敗しました: ${error.message}`);
  }

  const rawCheckpoints = ((rows as DbCheckpointRow[]) ?? []).map(mapDbCheckpointToSchema);
  return sortCheckpointsInTreeOrder(rawCheckpoints);
}

/**
 * クエスト詳細、紐づくタスク、およびチェックポイント一覧を取得する。
 */
export async function getQuestDetail(
  supabase: SupabaseClient,
  questId: string,
  userId: string,
): Promise<QuestDetailResponse | null> {
  const { data: questRow, error: questError } = await supabase
    .from("quests")
    .select("id, task_id, status, is_urgent, xp_earned, started_at, completed_at")
    .eq("id", questId)
    .eq("user_id", userId)
    .maybeSingle();

  if (questError) {
    throw new Error(`クエストの取得に失敗しました: ${questError.message}`);
  }
  if (!questRow) {
    return null;
  }

  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, due_at, status, shown_count, skipped_count, created_at, updated_at")
    .eq("id", questRow.task_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskError) {
    throw new Error(`タスクの取得に失敗しました: ${taskError.message}`);
  }
  if (!taskRow) {
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

export interface UpdateCheckpointFieldsInput {
  title?: string;
  isDone?: boolean;
}

/**
 * チェックポイントの項目（title / isDone / doneAt）を更新する。
 */
export async function updateCheckpointFields(
  supabase: SupabaseClient,
  checkpointId: string,
  fields: UpdateCheckpointFieldsInput,
  userId: string,
): Promise<Checkpoint | null> {
  const { data: checkpointRow, error: checkpointError } = await supabase
    .from("checkpoints")
    .select("quest_id")
    .eq("id", checkpointId)
    .maybeSingle();

  if (checkpointError) {
    throw new Error(`チェックポイントの取得に失敗しました: ${checkpointError.message}`);
  }
  if (!checkpointRow || !(await getQuestWithTask(supabase, checkpointRow.quest_id, userId))) {
    return null;
  }

  const updates: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    updates.title = fields.title;
  }
  if (fields.isDone !== undefined) {
    updates.is_done = fields.isDone;
    updates.done_at = fields.isDone ? new Date().toISOString() : null;
  }

  const { data: updatedRow, error } = await supabase
    .from("checkpoints")
    .update(updates)
    .eq("id", checkpointId)
    .eq("quest_id", checkpointRow.quest_id)
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

/**
 * チェックポイントの達成状態（isDone / doneAt）を更新する。
 */
export async function updateCheckpointStatus(
  supabase: SupabaseClient,
  checkpointId: string,
  isDone: boolean,
  userId: string,
): Promise<Checkpoint | null> {
  return updateCheckpointFields(supabase, checkpointId, { isDone }, userId);
}

export type CompleteQuestResult =
  | { type: "success"; data: CompleteQuestResponse }
  | { type: "not_found" }
  | { type: "conflict"; message: string };

/**
 * クエストを完了状態にし、紐づくタスクを完了（done）にし、経験値を獲得する。
 * ストアドプロシージャ `complete_quest` を呼び出してトランザクション内で原子的に実行する。
 */
export async function completeQuest(
  supabase: SupabaseClient,
  questId: string,
  userId: string,
): Promise<CompleteQuestResult> {
  // 元タスクも含め、認証済みユーザーの所有物だけを操作する。
  const detail = await getQuestWithTask(supabase, questId, userId);
  if (!detail) {
    return { type: "not_found" };
  }
  const questRow = detail.quest;
  if (questRow.status !== "in_progress") {
    return {
      type: "conflict",
      message: `クエストは進行中ではありません（現在のステータス: ${questRow.status}）`,
    };
  }

  // 2. 完了しているチェックポイント数を取得
  const { data: checkpointRows, error: checkpointError } = await supabase
    .from("checkpoints")
    .select("id, is_done")
    .eq("quest_id", questId);

  if (checkpointError) {
    throw new Error(`チェックポイント一覧の取得に失敗しました: ${checkpointError.message}`);
  }

  const completedCheckpoints = (checkpointRows ?? []).filter((cp) => cp.is_done).length;

  // 3. 経験値を計算
  const xpEarned = calculateQuestXp({
    isUrgent: questRow.isUrgent,
    completedCheckpointsCount: completedCheckpoints,
  });

  // 4. ストアドプロシージャ complete_quest を呼び出して原子的更新
  const { data: rpcData, error: rpcError } = await supabase.rpc("complete_quest", {
    p_quest_id: questId,
    p_xp_earned: xpEarned,
    p_user_id: userId,
  });

  if (rpcError) {
    throw new Error(`クエストの完了処理に失敗しました: ${rpcError.message}`);
  }

  if (!rpcData) {
    return {
      type: "conflict",
      message: "クエストの完了に失敗しました（すでに完了または中止されている可能性があります）",
    };
  }

  const rawQuest = rpcData.quest as DbQuestRow;
  const totalXp = Number(rpcData.total_xp ?? 0);

  return {
    type: "success",
    data: {
      quest: mapDbQuestToSchema(rawQuest),
      xpGained: xpEarned,
      totalXp,
    },
  };
}
