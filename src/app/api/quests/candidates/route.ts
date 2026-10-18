// GET 3択の候補取得（締切が近いタスクがあれば緊急クエスト1択）
// 担当: @ki-mutaku / 仕様: docs/api.md
import { apiError, ok, parseJson } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { RecordQuestCandidatesRequest } from "@/lib/schemas";
import {
  getQuestCandidates,
  recordQuestCandidates,
  QuestSelectionError,
} from "@/features/quest/server";

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

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized", "ログインが必要です");
  const parsed = await parseJson(request, RecordQuestCandidatesRequest);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(await recordQuestCandidates(parsed.data, user.id));
  } catch (error) {
    if (error instanceof QuestSelectionError) {
      return apiError(
        error.status,
        error.status === 400 ? "validation_error" : "conflict",
        error.message,
      );
    }
    return apiError(500, "internal_error", "候補の提示を保存できませんでした");
  }
}
