import "server-only";
import { z } from "zod";
import {
  StatsResponse,
  Task,
  type CreateTaskRequest,
  type TaskStatus,
  type UpdateTaskRequest,
} from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";

const TaskRow = z
  .object({
    id: Task.shape.id,
    title: Task.shape.title,
    due_at: Task.shape.dueAt,
    weight: Task.shape.weight,
    status: Task.shape.status,
    shown_count: Task.shape.shownCount,
    skipped_count: Task.shape.skippedCount,
    created_at: Task.shape.createdAt,
    updated_at: Task.shape.updatedAt,
  })
  .transform((data): Task => ({
    id: data.id,
    title: data.title,
    dueAt: data.due_at,
    weight: data.weight,
    status: data.status,
    shownCount: data.shown_count,
    skippedCount: data.skipped_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }));

const taskColumns = "id,title,due_at,weight,status,shown_count,skipped_count,created_at,updated_at";
const pageSize = 1000;

export function taskFromRow(row: unknown): Task {
  return TaskRow.parse(row);
}

export async function listTasks(status?: TaskStatus): Promise<Task[]> {
  const client = supabaseServer();
  const tasks: Task[] = [];
  // PostgREST の取得上限で古いタスクが一覧から消えないよう、全ページを読む。
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from("tasks").select(taskColumns);
    query = status === undefined ? query.neq("status", "discarded") : query.eq("status", status);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("タスク一覧を取得できませんでした");
    const rows = z.array(TaskRow).parse(data);
    tasks.push(...rows);
    if (rows.length < pageSize) return tasks;
  }
}

export async function createTask(input: CreateTaskRequest): Promise<Task> {
  const { data, error } = await supabaseServer()
    .from("tasks")
    .insert({ title: input.title, due_at: input.dueAt ?? null })
    .select(taskColumns)
    .single();
  if (error) throw new Error("タスクを登録できませんでした");
  return taskFromRow(data);
}

export async function updateTask(id: string, input: UpdateTaskRequest): Promise<Task | null> {
  const patch: { title?: string; due_at?: string | null; status?: TaskStatus } = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await supabaseServer()
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select(taskColumns)
    .maybeSingle();
  if (error) throw new Error("タスクを更新できませんでした");
  return data === null ? null : taskFromRow(data);
}

export async function deleteTask(id: string): Promise<boolean> {
  const { data, error } = await supabaseServer()
    .from("tasks")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("タスクを削除できませんでした");
  if (data === null) return false;
  z.object({ id: Task.shape.id }).parse(data);
  return true;
}

const CompletedQuestRow = z.object({
  xp_earned: z.number().int().nonnegative(),
});

export async function getStats(): Promise<StatsResponse> {
  const client = supabaseServer();
  let totalXp = 0;
  let completedQuests = 0;
  // 完了済みクエストの保存値だけを集計する。未完了の経験値は含めない。
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("quests")
      .select("xp_earned")
      .eq("status", "completed")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("経験値を取得できませんでした");
    const rows = z.array(CompletedQuestRow).parse(data);
    for (const row of rows) totalXp += row.xp_earned;
    completedQuests += rows.length;
    if (rows.length < pageSize) return StatsResponse.parse({ totalXp, completedQuests });
  }
}
