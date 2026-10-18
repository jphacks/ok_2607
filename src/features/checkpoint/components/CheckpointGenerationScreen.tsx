"use client";

import React, { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ApiError, Checkpoint, UpdateCheckpointFieldsRequest } from "@/lib/schemas";
import { OperationProgress } from "@/components/ui/OperationProgress";
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
  level = 1,
  onStartQuest,
}: CheckpointGenerationScreenProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(initialCheckpoints);
  const [isLoading, setIsLoading] = useState(initialCheckpoints.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const activeEdit = useRef<string | null>(null);
  const savingEdit = useRef(false);

  // 親チェックポイント（parentId が null の全体像）のみを抽出してソート
  const parentCheckpoints = checkpoints
    .filter((cp) => cp.parentId === null)
    .sort((a, b) => a.position - b.position);

  const isMountedRef = useRef(true);
  const isGeneratingRef = useRef(false);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const generate = React.useCallback(async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quests/${questId}/checkpoints/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "ロードマップの生成に失敗しました");
      }
      const parsed = Checkpoint.array().nonempty().safeParse(data?.checkpoints);
      if (
        !parsed.success ||
        !parsed.data.some((cp) => cp.parentId === null) ||
        parsed.data.some((cp) => cp.parentId === null && !cp.title.trim())
      ) {
        throw new Error("チェックポイントの生成結果が不正です");
      }
      if (isMountedRef.current) {
        setCheckpoints(parsed.data);
        setIsFallback(data.isFallback === true);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "予期せぬエラーが発生しました");
      }
    } finally {
      isGeneratingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [questId]);

  // 初期チェックポイントがない場合は自動生成
  React.useEffect(() => {
    if (initialCheckpoints.length > 0) return;
    void generate();
  }, [generate, initialCheckpoints.length]);

  const handleStart = () => {
    if (activeEdit.current !== null || savingEdit.current) return;
    startNavigation(() => {
      if (onStartQuest) {
        onStartQuest();
      } else {
        router.push(`/quests/${questId}`);
      }
    });
  };

  const handleEditStart = (cp: Checkpoint) => {
    if (activeEdit.current !== null || savingEdit.current) return;
    activeEdit.current = cp.id;
    setEditError(null);
    setEditingId(cp.id);
    setEditTitle(cp.title);
  };

  const handleEditSave = async (id: string) => {
    if (activeEdit.current !== id || savingEdit.current) return;
    const parsed = UpdateCheckpointFieldsRequest.safeParse({ title: editTitle });
    if (!parsed.success) {
      setEditError("名前は空白を除いて1〜200文字で入力してください。");
      return;
    }
    savingEdit.current = true;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      let saved: Checkpoint;
      if (questId === "demo" || id.startsWith("demo-")) {
        const original = checkpoints.find((cp) => cp.id === id);
        if (!original) throw new Error("マイルストーンが見つかりません。");
        saved = { ...original, title: parsed.data.title! };
      } else {
        const response = await fetch(`/api/checkpoints/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const failure = ApiError.safeParse(body);
          throw new Error(
            failure.success ? failure.data.error.message : "名前を保存できませんでした。",
          );
        }
        const result = z.object({ checkpoint: Checkpoint }).safeParse(body);
        if (
          !result.success ||
          result.data.checkpoint.id !== id ||
          result.data.checkpoint.questId !== questId
        ) {
          throw new Error("保存結果を確認できませんでした。");
        }
        saved = result.data.checkpoint;
      }
      setCheckpoints((previous) => previous.map((cp) => (cp.id === id ? saved : cp)));
      activeEdit.current = null;
      setEditingId(null);
    } catch (cause) {
      setEditError(
        cause instanceof TypeError
          ? "通信に失敗しました。接続を確認して、もう一度保存してください。"
          : cause instanceof Error
            ? cause.message
            : "通信に失敗しました。",
      );
    } finally {
      savingEdit.current = false;
      setIsSavingEdit(false);
    }
  };

  const cancelEdit = () => {
    if (savingEdit.current) return;
    activeEdit.current = null;
    setEditingId(null);
    setEditError(null);
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#101320] text-white">
      <main className="flex min-h-screen w-full max-w-3xl flex-col justify-between px-5 py-4 font-dotgothic sm:px-8 sm:py-8 lg:px-12 lg:py-10">
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

          {/* フォールバック時の案内バナー */}
          {!isLoading && !error && isFallback && (
            <div
              data-testid="fallback-banner"
              className="mt-4 rounded border border-gold-border/40 bg-panel p-3 text-xs text-gold-accent"
            >
              <p className="flex items-center gap-1.5 font-bold">
                <span>✦</span> 基本のロードマップを作成しました
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                AIに接続できなかったため定型プランを用意しました。各マイルストーンをタップして自由に編集できます。
              </p>
            </div>
          )}

          {/* チェックポイントリスト */}
          <div className="mt-4 space-y-3">
            {initialCheckpoints.length === 0 && (
              <OperationProgress
                title="冒険の道筋を準備中"
                steps={[
                  { label: "クエスト詳細の読み込み", status: "complete" },
                  {
                    label: "AIによる道筋の生成・保存",
                    status: error ? "error" : isLoading ? "running" : "complete",
                  },
                ]}
              />
            )}

            {error && (
              <div className="rounded border border-red-500 bg-red-950/40 p-4 text-center text-sm text-red-200">
                <p className="font-bold">生成に失敗しました</p>
                <p className="mt-1 text-xs opacity-90">{error}</p>
                <button
                  type="button"
                  onClick={() => void generate()}
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
                            aria-label="マイルストーン名"
                            maxLength={200}
                            disabled={isSavingEdit}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => void handleEditSave(cp.id)}
                            onKeyDown={(e) => {
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleEditSave(cp.id);
                              }
                              if (e.key === "Escape") cancelEdit();
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

          {editError && (
            <div className="mt-4 space-y-2">
              <p role="alert" className="text-sm text-danger">
                {editError}
              </p>
              <PixelButton
                variant="secondary"
                disabled={isSavingEdit}
                onClick={() => editingId && void handleEditSave(editingId)}
              >
                もう一度保存する
              </PixelButton>
            </div>
          )}

          {/* 編集可能ガイダンス */}
          {!isLoading && !error && (
            <p className="mt-4 flex items-center justify-center gap-1 text-center text-xs text-[#a8b3cf]">
              <span className="text-[#f2c36b]">✧</span>{" "}
              {isFallback
                ? "基本のマイルストーンはタップして自由に編集できます"
                : "AIが提案したマイルストーンは編集できます"}
            </p>
          )}
        </div>

        {/* 下部アクションボタン & 装飾バー */}
        <div className="mt-6 pb-2">
          {isNavigating && (
            <div className="mb-4">
              <OperationProgress
                title="クエストへ移動中"
                steps={[{ label: "移動先のデータの読み込み", status: "running" }]}
              />
            </div>
          )}
          <PixelButton
            onClick={handleStart}
            disabled={
              isLoading ||
              isNavigating ||
              Boolean(error) ||
              editingId !== null ||
              isSavingEdit ||
              parentCheckpoints.length === 0
            }
          >
            クエストを開始する
          </PixelButton>

          <DecorativeTileBar className="mt-5" />
        </div>
      </main>
    </div>
  );
}
