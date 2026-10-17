// POST クエスト開始（選択の記録と重みの更新）
// 担当: @ki-mutaku / 仕様: docs/api.md
import { apiError, ok, parseJson } from "@/lib/api-response";
import { StartQuestRequest } from "@/lib/schemas";
import { QuestSelectionError, startQuest } from "@/features/quest/server";

export async function POST(request: Request) {
  const parsed = await parseJson(request, StartQuestRequest);
  if (!parsed.ok) return parsed.response;

  try {
    return ok({ quest: await startQuest(parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof QuestSelectionError) {
      return apiError(
        error.status,
        error.status === 400 ? "validation_error" : "conflict",
        error.message,
      );
    }
    return apiError(500, "internal_error", "クエストを開始できませんでした");
  }
}
