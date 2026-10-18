// POST クエスト完了 & 経験値付与
// 担当: @miyagunimikihiro / 仕様: docs/api.md
import { z } from "zod";
import { completeQuest } from "@/features/checkpoint/service";
import { apiError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

const ParamsSchema = z.object({
  id: z.string().uuid("無効なクエスト ID です"),
});

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const questId = parsedParams.data.id;
  const supabase = supabaseServer();

  try {
    const result = await completeQuest(supabase, questId, user.id);

    if (result.type === "not_found") {
      return apiError(404, "not_found", "指定されたクエストが見つかりません");
    }

    if (result.type === "conflict") {
      return apiError(409, "conflict", result.message);
    }

    return ok(result.data);
  } catch {
    return apiError(500, "internal_error", "クエストの完了処理に失敗しました");
  }
}
