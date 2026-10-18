// GET 獲得経験値などの集計
// 担当: @lovemeasure / 仕様: docs/api.md
import { getStats } from "@/features/task/server";
import { apiError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "unauthorized", "ログインが必要です");
  }

  try {
    return ok(await getStats(user.id));
  } catch {
    return apiError(500, "internal_error", "経験値を取得できませんでした");
  }
}
