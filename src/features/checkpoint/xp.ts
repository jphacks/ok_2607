export interface CalculateXpParams {
  completedCheckpointsCount: number;
  isUrgent?: boolean;
}

/**
 * クエスト完了時に獲得できる経験値を計算する。
 * - 基本経験値: 20 XP
 * - 完了チェックポイント 1 件につき: +10 XP
 * - 緊急クエスト（isUrgent: true）の場合: 1.5 倍（四捨五入）
 */
export function calculateQuestXp(params: CalculateXpParams): number {
  const base = 20;
  const perCheckpoint = 10;
  let total = base + Math.max(0, params.completedCheckpointsCount) * perCheckpoint;

  if (params.isUrgent) {
    total = Math.round(total * 1.5);
  }

  return total;
}
