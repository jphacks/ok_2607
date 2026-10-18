// POST AI チェックポイント生成
// 担当: @miyagunimikihiro / 仕様: docs/api.md
import { z } from "zod";
import {
  createFallbackCheckpointPlan,
  generateCheckpointPlan,
} from "@/features/checkpoint/generate";
import { getQuestWithTask, saveCheckpointPlanToDb } from "@/features/checkpoint/service";
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

  // クエストとタスクを取得
  let questDetail;
  try {
    questDetail = await getQuestWithTask(supabase, questId, user.id);
  } catch {
    return apiError(500, "internal_error", "クエスト情報の取得に失敗しました");
  }

  if (!questDetail) {
    return apiError(404, "not_found", "指定されたクエストが見つかりません");
  }

  if (questDetail.quest.status !== "in_progress") {
    return apiError(409, "conflict", "進行中でないクエストのチェックポイントは生成できません");
  }

  // AI チェックポイント生成（失敗時は定型プランにフォールバック）
  let plan;
  let isFallback = false;
  try {
    plan = await generateCheckpointPlan(questDetail.task.title);
  } catch (error) {
    console.warn("AI generation failed, falling back to default plan:", error);
    plan = createFallbackCheckpointPlan(questDetail.task.title);
    isFallback = true;
  }

  // DB に保存
  try {
    const checkpoints = await saveCheckpointPlanToDb(supabase, questId, plan);
    return ok({ checkpoints, isFallback });
  } catch {
    return apiError(500, "internal_error", "チェックポイントの保存に失敗しました");
  }
}
