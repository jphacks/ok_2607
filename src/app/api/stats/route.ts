// GET 獲得経験値などの集計
// 担当: @lovemeasure / 仕様: docs/api.md
import { getStats } from "@/features/task/server";
import { apiError, ok } from "@/lib/api-response";

export async function GET() {
  try {
    return ok(await getStats());
  } catch {
    return apiError(500, "internal_error", "経験値を取得できませんでした");
  }
}
