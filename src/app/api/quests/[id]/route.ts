// GET クエスト詳細（タスクとチェックポイントを含む）
// 担当: @miyagunimikihiro / 仕様: docs/api.md
import { z } from "zod";
import { getQuestDetail } from "@/features/checkpoint/service";
import { apiError, ok } from "@/lib/api-response";
import { supabaseServer } from "@/lib/supabase/server";

const ParamsSchema = z.object({
  id: z.string().uuid("無効なクエスト ID です"),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const detail = await getQuestDetail(supabase, questId);
    if (!detail) {
      return apiError(404, "not_found", "指定されたクエストが見つかりません");
    }

    return ok(detail);
  } catch (error) {
    return apiError(
      500,
      "internal_error",
      `クエスト詳細の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
