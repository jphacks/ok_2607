"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { Checkpoint } from "@/lib/schemas";
import { DecorativeTileBar, PixelHeader } from "./PixelHeader";
import { MagePixelArt } from "./MagePixelArt";
import { PixelButton } from "./PixelButton";
import { PixelCard } from "./PixelCard";

interface CheckpointGenerationScreenProps {
  questId: string;
  taskTitle: string;
  initialCheckpoints?: Checkpoint[];
  level?: number;
  onStartQuest?: () => void;
}

export function CheckpointGenerationScreen({
  questId,
  taskTitle,
  initialCheckpoints = [],
  level = 4,
  onStartQuest,
}: CheckpointGenerationScreenProps) {
  const router = useRouter();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(initialCheckpoints);
  const [isLoading, setIsLoading] = useState(initialCheckpoints.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // 親チェックポイント（parentId が null の全体像）のみを抽出してソート
  const parentCheckpoints = checkpoints
    .filter((cp) => cp.parentId === null)
    .sort((a, b) => a.position - b.position);

  // 初期チェックポイントがない場合は自動生成
  React.useEffect(() => {
    if (initialCheckpoints.length > 0) return;

    let isMounted = true;
    async function generate() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/quests/${questId}/checkpoints/generate`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "チェックポイントの生成に失敗しました");
        }
        if (isMounted) {
          setCheckpoints(data.checkpoints || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "予期せぬエラーが発生しました");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    generate();
    return () => {
      isMounted = false;
    };
  }, [questId, initialCheckpoints.length]);

  const handleStart = () => {
    if (onStartQuest) {
      onStartQuest();
    } else {
      router.push(`/quests/${questId}`);
    }
  };

  const handleEditStart = (cp: Checkpoint) => {
    setEditingId(cp.id);
    setEditTitle(cp.title);
  };

  const handleEditSave = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    const updated = checkpoints.map((cp) => (cp.id === id ? { ...cp, title: editTitle } : cp));
    setCheckpoints(updated);
    setEditingId(null);

    // サーバーに更新を通知（オプショナル。失敗しても画面上は保持）
    try {
      await fetch(`/api/checkpoints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });
    } catch {
      // ログ出力のみ
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#101320] text-white">
      {/* スマホ画面サイズのコンテナ (max-w-md: ~390px-448px) */}
      <main className="flex min-h-screen w-full max-w-md flex-col justify-between px-5 py-4 font-dotgothic">
        {/* 上部ヘッダー */}
        <div>
          <PixelHeader level={level} />
          <DecorativeTileBar className="my-2" />

          {/* 見出し & 魔道士キャラクター */}
          <div className="mt-4 flex items-start justify-between">
            <div className="flex-1 pr-2">
              <h1 className="text-xl font-bold tracking-wide text-white">AIが冒険の道筋を描く</h1>
              <div className="mt-2">
                <span className="text-[11px] font-bold tracking-wider text-[#f2c36b]">
                  MAIN QUEST
                </span>
                <p className="mt-0.5 text-base font-bold text-white">{taskTitle}</p>
              </div>
            </div>
            <div className="flex-shrink-0 pt-1">
              <MagePixelArt size={52} />
            </div>
          </div>

          {/* チェックポイントリスト */}
          <div className="mt-5 space-y-3">
            {isLoading && (
              <div className="flex flex-col items-center justify-center space-y-3 py-12 text-[#f2c36b]">
                <div className="h-6 w-6 animate-spin border-2 border-[#f2c36b] border-t-transparent" />
                <p className="animate-pulse text-sm">魔道士がクエストを分解中...</p>
              </div>
            )}

            {error && (
              <div className="rounded border border-red-500 bg-red-950/40 p-4 text-center text-sm text-red-200">
                <p className="font-bold">生成に失敗しました</p>
                <p className="mt-1 text-xs opacity-90">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 border border-red-400 px-3 py-1 text-xs hover:bg-red-900/50"
                >
                  再試行する
                </button>
              </div>
            )}

            {!isLoading &&
              !error &&
              parentCheckpoints.map((cp, idx) => {
                const stepNum = String(idx + 1).padStart(2, "0");
                const isEditing = editingId === cp.id;

                return (
                  <PixelCard
                    key={cp.id}
                    as="div"
                    className="cursor-pointer transition-colors hover:border-[#ffe18d]"
                    onClick={() => !isEditing && handleEditStart(cp)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-dotgothic text-base font-bold text-[#f2c36b]">
                        {stepNum}
                      </span>
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleEditSave(cp.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSave(cp.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="w-full rounded border border-[#f2c36b] bg-[#101320] px-2 py-0.5 text-sm text-white focus:outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <h2 className="truncate text-sm font-bold text-white">{cp.title}</h2>
                            <p className="text-[11px] text-[#a8b3cf]">
                              {cp.description || "到達すべき状態"}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </PixelCard>
                );
              })}
          </div>

          {/* 編集可能ガイダンス */}
          {!isLoading && !error && (
            <p className="mt-4 flex items-center justify-center gap-1 text-center text-xs text-[#a8b3cf]">
              <span className="text-[#f2c36b]">✧</span> AIが提案したチェックポイントは編集できます
            </p>
          )}
        </div>

        {/* 下部アクションボタン & 装飾バー */}
        <div className="mt-6 pb-2">
          <PixelButton
            onClick={handleStart}
            disabled={isLoading || Boolean(error) || parentCheckpoints.length === 0}
          >
            クエストを開始する
          </PixelButton>

          <DecorativeTileBar className="mt-5" />
        </div>
      </main>
    </div>
  );
}
