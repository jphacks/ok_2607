// PATCH チェックポイント項目の更新（達成状態・タイトル）
// 担当: @miyagunimikihiro / 仕様: docs/api.md
import { z } from "zod";
import { updateCheckpointFields } from "@/features/checkpoint/service";
import { apiError, ok, parseJson } from "@/lib/api-response";
import { UpdateCheckpointFieldsRequest } from "@/lib/schemas";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

const ParamsSchema = z.object({
  id: z.string().uuid("無効なチェックポイント ID です"),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "unauthorized", "ログインが必要です");
  }

  const resolvedParams = await params;
  const parsedParams = ParamsSchema.safeParse(resolvedParams);

  if (!parsedParams.success) {
    return apiError(
      400,
      "validation_error",
      parsedParams.error.issues[0]?.message ?? "パラメータが不正です",
    );
  }

  const parsedBody = await parseJson(request, UpdateCheckpointFieldsRequest);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const checkpointId = parsedParams.data.id;
  const supabase = supabaseServer();

  try {
    const updated = await updateCheckpointFields(supabase, checkpointId, parsedBody.data, user.id);

    if (!updated) {
      return apiError(404, "not_found", "指定されたチェックポイントが見つかりません");
    }

    return ok({ checkpoint: updated });
  } catch {
    return apiError(500, "internal_error", "チェックポイントの更新に失敗しました");
  }
}
