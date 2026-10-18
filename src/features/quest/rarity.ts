/*
 * 3択カードのレア度。reject回数が多いタスクほど抽選で出にくい（recommend.ts）ので、
 * 出てきたこと自体を「レア」として演出する。緊急クエストは緊急の見た目を優先する。
 */

export type Rarity = "common" | "rare" | "mythic" | "urgent";

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "通常",
  rare: "レア",
  mythic: "幻",
  urgent: "緊急",
};

const RARE_MIN_SKIPPED = 2;
const MYTHIC_MIN_SKIPPED = 5;

export function getRarity(skippedCount: number, isUrgent: boolean): Rarity {
  if (isUrgent) return "urgent";
  if (skippedCount >= MYTHIC_MIN_SKIPPED) return "mythic";
  if (skippedCount >= RARE_MIN_SKIPPED) return "rare";
  return "common";
}
