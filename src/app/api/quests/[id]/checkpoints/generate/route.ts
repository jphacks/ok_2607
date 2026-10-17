// POST AI チェックポイント生成
// 担当: @miyagunimikihiro / 仕様: docs/api.md
import { z } from "zod";
import { AiGenerationError, generateCheckpointPlan } from "@/features/checkpoint/generate";
import { getQuestWithTask, saveCheckpointPlanToDb } from "@/features/checkpoint/service";
import { apiError, ok } from "@/lib/api-response";
import { supabaseServer } from "@/lib/supabase/server";

const ParamsSchema = z.object({
  id: z.string().uuid("無効なクエスト ID です"),
});

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // クエストとタスクを取得
  const questDetail = await getQuestWithTask(supabase, questId);
  if (!questDetail) {
    return apiError(404, "not_found", "指定されたクエストが見つかりません");
  }

  if (questDetail.quest.status !== "in_progress") {
    return apiError(409, "conflict", "進行中でないクエストのチェックポイントは生成できません");
  }

  // AI チェックポイント生成
  let plan;
  try {
    plan = await generateCheckpointPlan(questDetail.task.title);
  } catch (error) {
    if (error instanceof AiGenerationError) {
      return apiError(502, "ai_error", error.message);
    }
    return apiError(
      502,
      "ai_error",
      `チェックポイントの生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // DB に保存
  try {
    const checkpoints = await saveCheckpointPlanToDb(supabase, questId, plan);
    return ok({ checkpoints });
  } catch (error) {
    return apiError(
      500,
      "internal_error",
      `チェックポイントの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
