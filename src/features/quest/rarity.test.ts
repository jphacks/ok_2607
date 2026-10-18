import { describe, expect, it } from "vitest";
import { getRarity, RARITY_LABEL } from "@/features/quest/rarity";

describe("getRarity", () => {
  it.each([
    [0, "common"],
    [1, "common"],
    [2, "rare"],
    [4, "rare"],
    [5, "mythic"],
    [99, "mythic"],
  ] as const)("reject回数 %i なら %s", (skippedCount, expected) => {
    expect(getRarity(skippedCount, false)).toBe(expected);
  });

  it("緊急クエストは reject回数に関係なく urgent", () => {
    expect(getRarity(0, true)).toBe("urgent");
    expect(getRarity(10, true)).toBe("urgent");
  });

  it("負の数や NaN は common として扱う", () => {
    expect(getRarity(-1, false)).toBe("common");
    expect(getRarity(Number.NaN, false)).toBe("common");
  });
});

describe("RARITY_LABEL", () => {
  it("レア度ごとの表示名", () => {
    expect(RARITY_LABEL).toEqual({ common: "通常", rare: "レア", mythic: "幻", urgent: "緊急" });
  });
});
