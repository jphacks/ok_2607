"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DecorativeTileBar, PixelHeader } from "./PixelHeader";
import { PixelButton } from "./PixelButton";
import { PixelCard } from "./PixelCard";
import { TreasureChestPixelArt } from "./TreasureChestPixelArt";

interface QuestClearScreenProps {
  questId: string;
  taskTitle: string;
  completedCheckpointsCount?: number;
  totalCheckpointsCount?: number;
  xpGained?: number;
  nextLevelXp?: number;
  level?: number;
  onNextQuest?: () => void;
}

export function QuestClearScreen({
  questId,
  taskTitle,
  completedCheckpointsCount = 5,
  totalCheckpointsCount = 5,
  xpGained = 120,
  nextLevelXp = 80,
  level = 4,
  onNextQuest,
}: QuestClearScreenProps) {
  const router = useRouter();

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
      className="flex min-h-screen w-full flex-col items-center bg-[#101320] text-white"
    >
      {/* スマホ画面サイズのコンテナ (max-w-md: ~390px-448px) */}
      <main className="flex min-h-screen w-full max-w-md flex-col justify-between px-5 py-4 font-dotgothic">
        {/* 上部ヘッダー */}
        <div>
          <PixelHeader level={level} />
          <DecorativeTileBar className="my-2" />

          {/* 宝箱アニメーション & クリア見出し */}
          <div className="mt-8 flex flex-col items-center text-center">
            <TreasureChestPixelArt size={54} />

            <h1 className="mt-6 text-3xl font-bold tracking-wider text-[#f2c36b] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              QUEST CLEAR!
            </h1>
            <p className="mt-2 text-xl font-bold tracking-wide text-white">クエスト達成！</p>
          </div>

          {/* リザルトカード */}
          <div className="mt-8">
            <PixelCard as="div" className="px-5 py-6">
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white">{taskTitle}</h2>

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
        <div className="mt-8 flex flex-col items-center space-y-4 pb-2">
          <PixelButton onClick={handleNextQuest}>次の冒険へ</PixelButton>

          <Link href="/" className="text-sm text-[#a9b6c9] transition-colors hover:text-white">
            ホームに戻る
          </Link>

          <DecorativeTileBar className="mt-4" />
        </div>
      </main>
    </div>
  );
}
