"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { Checkpoint } from "@/lib/schemas";
import { DecorativeTileBar, PixelHeader } from "./PixelHeader";
import { HeroPixelArt } from "./HeroPixelArt";
import { PixelButton } from "./PixelButton";
import { PixelCard } from "./PixelCard";
import { PixelCheckbox } from "./PixelCheckbox";
import { PixelProgressBar } from "./PixelProgressBar";

interface QuestProgressScreenProps {
  questId: string;
  taskTitle: string;
  initialCheckpoints: Checkpoint[];
  level?: number;
  onCompleteQuest?: () => void;
}

export function QuestProgressScreen({
  questId,
  taskTitle,
  initialCheckpoints,
  level = 4,
  onCompleteQuest,
}: QuestProgressScreenProps) {
  const router = useRouter();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(initialCheckpoints);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 親チェックポイント（parentId が null の全体像）のみを抽出してソート
  const parentCheckpoints = checkpoints
    .filter((cp) => cp.parentId === null)
    .sort((a, b) => a.position - b.position);

  const completedCount = parentCheckpoints.filter((cp) => cp.isDone).length;
  const totalCount = parentCheckpoints.length;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  // チェックポイントの完了状態トグル
  const handleToggleCheckpoint = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    // 楽観的更新
    setCheckpoints((prev) => prev.map((cp) => (cp.id === id ? { ...cp, isDone: nextStatus } : cp)));
    setError(null);

    // デモ用チェックポイント（または demo クエスト）の場合は API 呼び出しを行わずローカル更新のみ
    if (questId === "demo" || id.startsWith("demo-")) {
      return;
    }

    try {
      const res = await fetch(`/api/checkpoints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: nextStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        // 失敗時はロールバック
        setCheckpoints((prev) =>
          prev.map((cp) => (cp.id === id ? { ...cp, isDone: currentStatus } : cp)),
        );
        setError(errorData?.error?.message || "チェックポイントの更新に失敗しました。");
      }
    } catch {
      // ネットワークエラー時もロールバック
      setCheckpoints((prev) =>
        prev.map((cp) => (cp.id === id ? { ...cp, isDone: currentStatus } : cp)),
      );
      setError("通信エラーが発生しました。");
    }
  };

  // クエスト完了
  const handleComplete = async () => {
    if (onCompleteQuest) {
      onCompleteQuest();
      return;
    }

    // デモクエストの場合は API 呼び出しを行わずにクリア画面へ遷移
    if (questId === "demo") {
      router.push("/quests/demo/clear");
      return;
    }

    setIsCompleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/quests/${questId}/complete`, {
        method: "POST",
      });

      if (res.ok) {
        router.push(`/quests/${questId}/clear`);
      } else {
        // API 未実装または失敗時でもクリア画面へ進む（デモ・フォールバック対応）
        router.push(`/quests/${questId}/clear`);
      }
    } catch {
      router.push(`/quests/${questId}/clear`);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#101320] text-white">
      {/* スマホ画面サイズのコンテナ (max-w-md: ~390px-448px) */}
      <main className="flex min-h-screen w-full max-w-md flex-col justify-between px-5 py-4 font-dotgothic">
        {/* 上部ヘッダー & 見出し */}
        <div>
          <PixelHeader level={level} />
          <DecorativeTileBar className="my-2" />

          {/* 見出し & 主人公キャラクター */}
          <div className="mt-4 flex items-start justify-between">
            <div className="flex-1 pr-2">
              <span className="text-[11px] font-bold tracking-wider text-[#f2c36b]">
                QUEST IN PROGRESS
              </span>
              <h1 className="mt-0.5 text-lg font-bold tracking-wide text-white">{taskTitle}</h1>
            </div>
            <div className="flex-shrink-0 pt-1">
              <HeroPixelArt size={52} />
            </div>
          </div>

          {/* 進捗バー */}
          <div className="mt-5">
            <PixelProgressBar completed={completedCount} total={totalCount} />
          </div>

          {/* チェックポイントリスト */}
          <div className="mt-6 space-y-3">
            {parentCheckpoints.map((cp) => {
              return (
                <PixelCard
                  key={cp.id}
                  as="div"
                  onClick={() => handleToggleCheckpoint(cp.id, cp.isDone)}
                  className={`cursor-pointer transition-colors hover:border-[#ffe18d] ${
                    cp.isDone ? "bg-[#1d2235]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <PixelCheckbox
                      checked={cp.isDone}
                      onChange={() => handleToggleCheckpoint(cp.id, cp.isDone)}
                    />
                    <div className="min-w-0 flex-1">
                      <h2
                        className={`text-sm font-bold transition-colors ${
                          cp.isDone ? "text-[#a8b3cf] line-through opacity-85" : "text-white"
                        }`}
                      >
                        {cp.title}
                      </h2>
                    </div>
                  </div>
                </PixelCard>
              );
            })}
          </div>

          {error && <p className="mt-4 text-center text-xs text-red-400">{error}</p>}
        </div>

        {/* 下部アクションボタン & 装飾バー */}
        <div className="mt-6 pb-2">
          <PixelButton onClick={handleComplete} disabled={isCompleting || !isAllCompleted}>
            {isCompleting ? "完了処理中..." : "クエストを完了する"}
          </PixelButton>

          <DecorativeTileBar className="mt-5" />
        </div>
      </main>
    </div>
  );
}
