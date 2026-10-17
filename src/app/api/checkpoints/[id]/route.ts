// PATCH チェックポイント達成状態の更新
// 担当: @miyagunimikihiro / 仕様: docs/api.md
import { z } from "zod";
import { updateCheckpointStatus } from "@/features/checkpoint/service";
import { apiError, ok, parseJson } from "@/lib/api-response";
import { UpdateCheckpointRequest } from "@/lib/schemas";
import { supabaseServer } from "@/lib/supabase/server";

const ParamsSchema = z.object({
  id: z.string().uuid("無効なチェックポイント ID です"),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const parsedParams = ParamsSchema.safeParse(resolvedParams);

  if (!parsedParams.success) {
    return apiError(
      400,
      "validation_error",
      parsedParams.error.issues[0]?.message ?? "パラメータが不正です",
    );
  }

  const parsedBody = await parseJson(request, UpdateCheckpointRequest);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const checkpointId = parsedParams.data.id;
  const supabase = supabaseServer();

  try {
    const updated = await updateCheckpointStatus(supabase, checkpointId, parsedBody.data.isDone);

    if (!updated) {
      return apiError(404, "not_found", "指定されたチェックポイントが見つかりません");
    }

    return ok({ checkpoint: updated });
  } catch {
    return apiError(500, "internal_error", "チェックポイントの更新に失敗しました");
  }
}
