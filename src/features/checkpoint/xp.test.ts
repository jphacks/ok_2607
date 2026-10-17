import { describe, expect, it } from "vitest";
import { calculateQuestXp } from "./xp";

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
