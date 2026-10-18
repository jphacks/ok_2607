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

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  requiredXp: number;
  progressRatio: number;
}

/**
 * 累計経験値（totalXp）からプレイヤーのレベル、現在レベル内の進捗、次のレベルまでの必要経験値を計算する。
 *
 * レベル曲線:
 * - Lv.1: 0 〜 49 XP（次まで 50 XP）
 * - Lv.2: 50 〜 119 XP（次まで 70 XP、累計 120 XP で Lv.3）
 * - Lv.3: 120 〜 209 XP（次まで 90 XP、累計 210 XP で Lv.4）
 * - 一般に Lv.L では、次へ上がるのに 50 + (L - 1) * 20 XP が必要
 */
export function calculateLevel(totalXp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0));

  let level = 1;
  let currentLevelBaseXp = 0;
  let requiredXp = 50;

  while (safeXp >= currentLevelBaseXp + requiredXp) {
    currentLevelBaseXp += requiredXp;
    level += 1;
    requiredXp = 50 + (level - 1) * 20;
  }

  const currentLevelXp = safeXp - currentLevelBaseXp;
  const nextLevelXp = requiredXp - currentLevelXp;
  const progressRatio = requiredXp > 0 ? Math.min(1, Math.max(0, currentLevelXp / requiredXp)) : 0;

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    requiredXp,
    progressRatio,
  };
}
