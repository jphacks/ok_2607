// GET 3択の候補取得（締切が近いタスクがあれば緊急クエスト1択）
// 担当: @ki-mutaku / 仕様: docs/api.md
import { apiError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { getQuestCandidates, QuestSelectionError } from "@/features/quest/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "unauthorized", "ログインが必要です");
  }

  try {
    return ok(await getQuestCandidates(undefined, user.id));
  } catch (error) {
    if (error instanceof QuestSelectionError) {
      return apiError(
        error.status,
        error.status === 400 ? "validation_error" : "conflict",
        error.message,
      );
    }
    return apiError(500, "internal_error", "クエストの候補を取得できませんでした");
  }
}
