// GET タスク一覧 / POST タスク登録
// 担当: @lovemeasure / 仕様: docs/api.md
import { createTask, listTasks } from "@/features/task/server";
import { apiError, ok, parseJson } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { CreateTaskRequest, TaskStatus } from "@/lib/schemas";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "unauthorized", "ログインが必要です");
  }

  const status = new URL(request.url).searchParams.get("status");
  const parsed = TaskStatus.optional().safeParse(status ?? undefined);
  if (!parsed.success) {
    return apiError(400, "validation_error", "タスクの状態が不正です");
  }
  try {
    return ok({ tasks: await listTasks(parsed.data, user.id) });
  } catch {
    return apiError(500, "internal_error", "タスク一覧を取得できませんでした");
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "unauthorized", "ログインが必要です");
  }

  const parsed = await parseJson(request, CreateTaskRequest);
  if (!parsed.ok) return parsed.response;
  try {
    return ok({ task: await createTask(parsed.data, user.id) }, { status: 201 });
  } catch {
    return apiError(500, "internal_error", "タスクを登録できませんでした");
  }
}
