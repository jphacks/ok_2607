import React from "react";
import { DecorativeTileBar, PixelHeader } from "./PixelHeader";
import { HeroPixelArt } from "./HeroPixelArt";

interface QuestLoadingScreenProps {
  message?: string;
  subMessage?: string;
  level?: number;
}

export function QuestLoadingScreen({
  message = "冒険の書をひらいている…",
  subMessage = "ダンジョンへ向かっています…",
  level = 4,
}: QuestLoadingScreenProps) {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center bg-surface text-text"
      role="status"
      aria-live="polite"
      aria-label={`読み込み中: ${message}`}
    >
      <main className="flex min-h-screen w-full max-w-3xl flex-col justify-between px-5 py-4 font-dotgothic sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        {/* 上部ヘッダー & 装飾バー */}
        <div>
          <PixelHeader level={level} />
          <DecorativeTileBar className="my-2" />
        </div>

        {/* 画面中央: レトロゲーム風ローディングアニメーション */}
        <div className="my-auto flex flex-col items-center justify-center py-12 text-center">
          {/* 主人公キャラクター & バウンス演出 */}
          <div className="relative flex flex-col items-center justify-center">
            <div className="animate-bounce motion-reduce:animate-none">
              <HeroPixelArt size={64} />
            </div>
            {/* キャラクターの足元影 */}
            <div className="mt-1 h-1.5 w-10 rounded-full bg-line-dim/60" aria-hidden="true" />
          </div>

          {/* LOADING バッジ */}
          <div className="mt-6">
            <span className="inline-block border border-gold-border/60 bg-panel px-3 py-1 text-xs font-bold tracking-widest text-gold-accent">
              LOADING
            </span>
          </div>

          {/* メッセージ表示 */}
          <h1 className="mt-4 text-lg font-bold tracking-wide text-text sm:text-xl">{message}</h1>
          <p className="mt-1.5 text-xs text-muted sm:text-sm">{subMessage}</p>

          {/* 点滅するドットインジケーター */}
          <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
            <span
              className="h-2 w-2 animate-pulse bg-gold-accent motion-reduce:animate-none"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-2 w-2 animate-pulse bg-gold-accent motion-reduce:animate-none"
              style={{ animationDelay: "200ms" }}
            />
            <span
              className="h-2 w-2 animate-pulse bg-gold-accent motion-reduce:animate-none"
              style={{ animationDelay: "400ms" }}
            />
          </div>
        </div>

        {/* 下部装飾バー */}
        <div className="pb-2">
          <DecorativeTileBar className="mt-5" />
        </div>
      </main>
    </div>
  );
}
