// PATCH タスク編集 / DELETE タスク削除
// 担当: @lovemeasure / 仕様: docs/api.md
import { deleteTask, updateTask } from "@/features/task/server";
import { apiError, ok, parseJson } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { Task, UpdateTaskRequest, type UpdateTaskResponse } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "unauthorized", "ログインが必要です");
  }

  const { id } = await context.params;
  if (!Task.shape.id.safeParse(id).success) {
    return apiError(400, "validation_error", "タスク ID が不正です");
  }
  const parsed = await parseJson(request, UpdateTaskRequest);
  if (!parsed.ok) return parsed.response;
  try {
    const task = await updateTask(id, parsed.data, user.id);
    if (task === null) return apiError(404, "not_found", "タスクが見つかりません");
    return ok<UpdateTaskResponse>({ task });
  } catch {
    return apiError(500, "internal_error", "タスクを更新できませんでした");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "unauthorized", "ログインが必要です");
  }

  const { id } = await context.params;
  if (!Task.shape.id.safeParse(id).success) {
    return apiError(400, "validation_error", "タスク ID が不正です");
  }
  try {
    if (!(await deleteTask(id, user.id))) {
      return apiError(404, "not_found", "タスクが見つかりません");
    }
    return new Response(null, { status: 204 });
  } catch {
    return apiError(500, "internal_error", "タスクを削除できませんでした");
  }
}
