import { apiError, ok } from "@/lib/api-response";
import { getQuestCandidates, QuestSelectionError } from "@/features/quest/server";

export async function GET() {
  try {
    return ok(await getQuestCandidates());
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
