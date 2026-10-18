"use client";

import React, { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DecorativeTileBar, PixelHeader } from "./PixelHeader";
import { PixelButton } from "./PixelButton";
import { PixelCard } from "./PixelCard";
import { TreasureChestPixelArt } from "./TreasureChestPixelArt";
import { ConfettiBurst, prefersReducedMotion } from "./ConfettiBurst";

interface QuestClearScreenProps {
  questId: string;
  taskTitle: string;
  completedCheckpointsCount?: number;
  totalCheckpointsCount?: number;
  xpGained?: number;
  nextLevelXp?: number;
  level?: number;
  isLevelUp?: boolean;
  onNextQuest?: () => void;
}

export function QuestClearScreen({
  questId,
  taskTitle,
  completedCheckpointsCount = 5,
  totalCheckpointsCount = 5,
  xpGained = 120,
  nextLevelXp = 80,
  level = 1,
  isLevelUp = false,
  onNextQuest,
}: QuestClearScreenProps) {
  const router = useRouter();
  const chest = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  // 宝箱とタイトルを軽くポップさせて登場させる（描画前に始めてちらつきを抑える）
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const pop = [
      { opacity: 0, transform: "scale(0.6)" },
      { opacity: 1, transform: "scale(1.12)", offset: 0.6 },
      { opacity: 1, transform: "scale(1)" },
    ];
    const animations = [
      chest.current?.animate?.(pop, { duration: 420, easing: "ease-out", fill: "backwards" }),
      title.current?.animate?.(pop, {
        duration: 420,
        delay: 140,
        easing: "ease-out",
        fill: "backwards",
      }),
    ];
    return () => animations.forEach((animation) => animation?.cancel());
  }, []);

  const handleNextQuest = () => {
    if (onNextQuest) {
      onNextQuest();
    } else {
      router.push("/");
    }
  };

  return (
    <div
      data-quest-id={questId}
      className="flex min-h-dvh w-full flex-col items-center bg-[#101320] text-white"
    >
      <ConfettiBurst />
      <main className="flex min-h-dvh w-full max-w-3xl flex-col justify-between px-5 py-4 font-dotgothic sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        {/* 上部ヘッダー */}
        <div>
          <PixelHeader level={level} />
          <DecorativeTileBar className="my-2" />

          {/* 宝箱アニメーション & クリア見出し */}
          <div className="mt-5 flex flex-col items-center text-center sm:mt-8">
            <div ref={chest}>
              <TreasureChestPixelArt size={54} />
            </div>

            <h1
              ref={title}
              className="mt-4 text-3xl font-bold tracking-wider text-[#f2c36b] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            >
              QUEST CLEAR!
            </h1>
            <p className="mt-2 text-xl font-bold tracking-wide text-white">クエスト達成！</p>

            {isLevelUp && (
              <div
                role="status"
                aria-label="レベルアップ"
                className="mt-4 flex items-center justify-center gap-2 rounded border border-[#f2c36b] bg-[#2a2215] px-4 py-2 font-bold text-[#f2c36b] shadow-[0_0_10px_rgba(242,195,107,0.3)] animate-pulse"
              >
                <span aria-hidden="true">★</span>
                <span className="tracking-wide">LEVEL UP! Lv. {level} に到達！</span>
                <span aria-hidden="true">★</span>
              </div>
            )}
          </div>

          {/* リザルトカード */}
          <div className="mt-5 sm:mt-8">
            <PixelCard as="div" className="px-5 py-5 sm:py-6">
              <div className="space-y-4">
                <h2 className="line-clamp-2 text-base font-bold text-white">{taskTitle}</h2>

                <p className="flex items-center gap-2 text-sm font-bold text-[#83d9b2]">
                  <span>✓</span> チェックポイント {completedCheckpointsCount} /{" "}
                  {totalCheckpointsCount}
                </p>

                <div className="pt-2">
                  <div className="text-2xl font-bold tracking-wide text-[#f2c36b]">
                    ＋ {xpGained} XP
                  </div>
                  <p className="mt-1 text-xs text-[#a9b6c9]">次のレベルまであと {nextLevelXp} XP</p>
                </div>
              </div>
            </PixelCard>
          </div>
        </div>

        {/* 下部アクションボタン & ホームリンク */}
        <div className="mt-5 flex flex-col items-center space-y-3 pb-2 sm:mt-8 sm:space-y-4">
          <PixelButton onClick={handleNextQuest}>次のクエストへ</PixelButton>

          <Link href="/" className="text-sm text-[#a9b6c9] transition-colors hover:text-white">
            ホームに戻る
          </Link>

          <DecorativeTileBar className="mt-2 sm:mt-4" />
        </div>
      </main>
    </div>
  );
}
