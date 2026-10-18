import "server-only";
import { z } from "zod";
import { Quest } from "@/lib/schemas";
import type { QuestCandidatesResponse, StartQuestRequest } from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import { listTasks, taskFromRow } from "@/features/task/server";
import { recommendTasks } from "@/features/quest/recommend";

const QuestRow = z.object({
  id: Quest.shape.id,
  task_id: Quest.shape.taskId,
  status: Quest.shape.status,
  is_urgent: Quest.shape.isUrgent,
  xp_earned: Quest.shape.xpEarned,
  started_at: Quest.shape.startedAt,
  completed_at: Quest.shape.completedAt,
});

export class QuestSelectionError extends Error {
  constructor(
    public readonly status: 400 | 409,
    message: string,
  ) {
    super(message);
    this.name = "QuestSelectionError";
  }
}

export function questFromRow(row: unknown): Quest {
  const parsed = QuestRow.parse(row);
  return Quest.parse({
    id: parsed.id,
    taskId: parsed.task_id,
    status: parsed.status,
    isUrgent: parsed.is_urgent,
    xpEarned: parsed.xp_earned,
    startedAt: parsed.started_at,
    completedAt: parsed.completed_at,
  });
}

function throwDatabaseError(error: { code: string }): never {
  if (error.code === "22023") {
    throw new QuestSelectionError(400, "選択したタスクと提示したタスクが一致しません");
  }
  if (error.code === "P0001") {
    throw new QuestSelectionError(409, "タスクの状態が変わったか、進行中のクエストがあります");
  }
  throw error;
}

export async function getQuestCandidates(
  options?: Parameters<typeof recommendTasks>[1],
  userId?: string | null,
): Promise<QuestCandidatesResponse> {
  const client = supabaseServer();
  let lookupQuery = client.from("quests").select("*").eq("status", "in_progress");
  if (userId) {
    lookupQuery = lookupQuery.eq("user_id", userId);
  }
  const { data: inProgress, error: lookupError } = await lookupQuery.maybeSingle();
  if (lookupError) throw lookupError;
  if (inProgress) {
    return {
      isUrgent: false,
      candidates: [],
      inProgressQuest: questFromRow(inProgress),
    };
  }

  const result = recommendTasks(await listTasks("active", userId), options);
  if (result.candidates.length === 0) return { ...result, inProgressQuest: null };

  const { data, error } = await client.rpc("record_quest_candidates", {
    p_task_ids: result.candidates.map((task) => task.id),
  });
  if (error) throwDatabaseError(error);

  const updated = z.array(z.unknown()).parse(data).map(taskFromRow);
  const byId = new Map(updated.map((task) => [task.id, task]));
  return {
    isUrgent: result.isUrgent,
    inProgressQuest: null,
    candidates: result.candidates.map((task) => {
      const saved = byId.get(task.id);
      if (!saved) throw new Error("提示回数を更新したタスクが見つかりません");
      return saved;
    }),
  };
}

export async function startQuest(input: StartQuestRequest, userId?: string | null): Promise<Quest> {
  if (
    new Set(input.shownTaskIds).size !== input.shownTaskIds.length ||
    !input.shownTaskIds.includes(input.selectedTaskId)
  ) {
    throw new QuestSelectionError(400, "提示したタスクを重複なく指定し、その中から選んでください");
  }

  const { data, error } = await supabaseServer()
    .rpc("start_quest", {
      p_selected_task_id: input.selectedTaskId,
      p_shown_task_ids: input.shownTaskIds,
      p_user_id: userId ?? null,
    })
    .single();
  if (error) throwDatabaseError(error);
  return questFromRow(data);
}
