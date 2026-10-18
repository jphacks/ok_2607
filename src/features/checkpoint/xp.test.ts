import { describe, expect, it } from "vitest";
import { calculateLevel, calculateQuestXp } from "./xp";

describe("calculateQuestXp", () => {
  it("完了チェックポイントが 0 件のときは基本経験値 20 を返す", () => {
    expect(calculateQuestXp({ completedCheckpointsCount: 0 })).toBe(20);
  });

  it("完了チェックポイント数に応じて加算される (基本 20 + 1 件につき 10)", () => {
    expect(calculateQuestXp({ completedCheckpointsCount: 1 })).toBe(30);
    expect(calculateQuestXp({ completedCheckpointsCount: 3 })).toBe(50);
  });

  it("負の件数が渡された場合は 0 件として扱う", () => {
    expect(calculateQuestXp({ completedCheckpointsCount: -1 })).toBe(20);
  });

  it("緊急クエスト (isUrgent: true) の場合は 1.5 倍（四捨五入）になる", () => {
    // (20 + 10 * 1) * 1.5 = 45
    expect(calculateQuestXp({ completedCheckpointsCount: 1, isUrgent: true })).toBe(45);
    // (20 + 10 * 2) * 1.5 = 60
    expect(calculateQuestXp({ completedCheckpointsCount: 2, isUrgent: true })).toBe(60);
    // (20 + 10 * 0) * 1.5 = 30
    expect(calculateQuestXp({ completedCheckpointsCount: 0, isUrgent: true })).toBe(30);
  });
});

describe("calculateLevel", () => {
  it("経験値が 0 の初期状態では Lv.1、進捗率 0%、次まで 50 XP", () => {
    const result = calculateLevel(0);
    expect(result.level).toBe(1);
    expect(result.currentLevelXp).toBe(0);
    expect(result.nextLevelXp).toBe(50);
    expect(result.requiredXp).toBe(50);
    expect(result.progressRatio).toBe(0);
  });

  it("負の経験値や不正値が渡された場合は 0 XP（Lv.1）として扱う", () => {
    expect(calculateLevel(-100).level).toBe(1);
    expect(calculateLevel(Number.NaN).level).toBe(1);
  });

  it("Lv.1 の途中の経験値（25 XP）で進捗率 50%（0.5）となる", () => {
    const result = calculateLevel(25);
    expect(result.level).toBe(1);
    expect(result.currentLevelXp).toBe(25);
    expect(result.nextLevelXp).toBe(25);
    expect(result.progressRatio).toBe(0.5);
  });

  it("Lv.2 の閾値（50 XP）で Lv.2 に上がり、進捗率 0%、次まで 70 XP", () => {
    const result = calculateLevel(50);
    expect(result.level).toBe(2);
    expect(result.currentLevelXp).toBe(0);
    expect(result.nextLevelXp).toBe(70);
    expect(result.requiredXp).toBe(70);
    expect(result.progressRatio).toBe(0);
  });

  it("Lv.3 の閾値（120 XP: 50 + 70）で Lv.3 に上がり、進捗率 0%、次まで 90 XP", () => {
    const result = calculateLevel(120);
    expect(result.level).toBe(3);
    expect(result.currentLevelXp).toBe(0);
    expect(result.nextLevelXp).toBe(90);
    expect(result.requiredXp).toBe(90);
    expect(result.progressRatio).toBe(0);
  });

  it("Lv.3 の途中の経験値（200 XP）で正しく計算される", () => {
    // 120 XP で Lv.3、必要 90 XP。200 XP は 120 + 80 XP なので現在 80 XP、次まで 10 XP
    const result = calculateLevel(200);
    expect(result.level).toBe(3);
    expect(result.currentLevelXp).toBe(80);
    expect(result.nextLevelXp).toBe(10);
    expect(result.progressRatio).toBeCloseTo(80 / 90);
  });
});
