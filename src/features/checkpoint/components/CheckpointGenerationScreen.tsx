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
  onStartQuest?: (checkpoints?: Checkpoint[]) => void;
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

  // 編集モード関連のステート
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const activeEdit = useRef<string | null>(null);
  const savingEdit = useRef(false);

  // 追加モード関連のステート
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

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
        if (isMounted) {
          setCheckpoints(parsed.data);
          setIsFallback(data.isFallback === true);
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
    if (activeEdit.current !== null || savingEdit.current) return;
    startNavigation(() => {
      if (onStartQuest) {
        onStartQuest(parentCheckpoints);
      } else {
        router.push(`/quests/${questId}`);
      }
    });
  };

  const handleEditStart = (cp: Checkpoint) => {
    if (activeEdit.current !== null || savingEdit.current) return;
    activeEdit.current = cp.id;
    setEditingId(cp.id);
    setEditTitle(cp.title);
    setEditError(null);
  };

  const cancelEdit = () => {
    if (savingEdit.current) return;
    activeEdit.current = null;
    setEditingId(null);
    setEditTitle("");
    setEditError(null);
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
      const original = checkpoints.find((cp) => cp.id === id);
      if (!original) throw new Error("チェックポイントが見つかりません。");

      let saved: Checkpoint;
      // デモクエストまたはクライアント生成されたチェックポイントの場合はローカル反映のみ
      if (questId === "demo" || id.startsWith("demo-") || id.startsWith("custom-")) {
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
        saved = {
          ...result.data.checkpoint,
          position: original.position,
        };
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

  // ステップの並び替え（上へ移動）
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const reordered = [...parentCheckpoints];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;

    // position を再割り当て
    const updatedParents = reordered.map((cp, idx) => ({ ...cp, position: idx }));
    const nonParents = checkpoints.filter((cp) => cp.parentId !== null);
    setCheckpoints([...updatedParents, ...nonParents]);
  };

  // ステップの並び替え（下へ移動）
  const handleMoveDown = (index: number) => {
    if (index >= parentCheckpoints.length - 1) return;
    const reordered = [...parentCheckpoints];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;

    // position を再割り当て
    const updatedParents = reordered.map((cp, idx) => ({ ...cp, position: idx }));
    const nonParents = checkpoints.filter((cp) => cp.parentId !== null);
    setCheckpoints([...updatedParents, ...nonParents]);
  };

  // チェックポイントの新規追加
  const handleAddCheckpoint = () => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    const nextPosition =
      parentCheckpoints.length > 0
        ? Math.max(...parentCheckpoints.map((cp) => cp.position)) + 1
        : 0;

    const newCp: Checkpoint = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `custom-${crypto.randomUUID()}`
          : `custom-${Date.now()}`,
      questId,
      parentId: null,
      title: trimmedTitle,
      description: "到達すべき状態",
      position: nextPosition,
      isDone: false,
      doneAt: null,
    };

    setCheckpoints((prev) => [...prev, newCp]);
    setNewTitle("");
    setIsAdding(false);
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-surface text-text">
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
                <span className="text-[11px] font-bold tracking-wider text-gold-accent">
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
                AIに接続できなかったため定型プランを用意しました。各ステップを自由に追加・編集・並び替えできます。
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
                const isFirst = idx === 0;
                const isLast = idx === parentCheckpoints.length - 1;

                return (
                  <PixelCard key={cp.id} as="div" className="transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-dotgothic text-base font-bold text-gold-accent">
                        {stepNum}
                      </span>
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              aria-label="チェックポイント名"
                              maxLength={200}
                              disabled={isSavingEdit}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.nativeEvent.isComposing) return;
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleEditSave(cp.id);
                                }
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                              className="w-full rounded border border-gold-accent bg-field px-2.5 py-1 text-sm text-text focus:outline-none"
                              placeholder="チェックポイントのタイトル"
                            />
                            {editError && <p className="text-xs text-danger">{editError}</p>}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleEditSave(cp.id)}
                                disabled={isSavingEdit}
                                className="border border-gold-accent bg-gold-accent/20 px-3 py-0.5 text-xs font-bold text-gold-accent hover:bg-gold-accent hover:text-gold-ink active:translate-y-0.5 transition-colors"
                              >
                                {isSavingEdit ? "保存中..." : "保存"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isSavingEdit}
                                className="border border-line-dim bg-panel px-3 py-0.5 text-xs text-muted hover:text-text active:translate-y-0.5 transition-colors"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h2 className="truncate text-sm font-bold text-white">{cp.title}</h2>
                              <p className="text-[11px] text-muted">
                                {cp.description || "到達すべき状態"}
                              </p>
                            </div>
                            {/* 操作アクションボタン: ▲, ▼, 編集 */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="上へ移動"
                                onClick={() => handleMoveUp(idx)}
                                disabled={isFirst || editingId !== null || isSavingEdit}
                                className="border border-line-dim bg-panel px-1.5 py-0.5 text-xs text-muted hover:border-gold-accent hover:text-gold-accent disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-0.5 transition-colors"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                aria-label="下へ移動"
                                onClick={() => handleMoveDown(idx)}
                                disabled={isLast || editingId !== null || isSavingEdit}
                                className="border border-line-dim bg-panel px-1.5 py-0.5 text-xs text-muted hover:border-gold-accent hover:text-gold-accent disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-0.5 transition-colors"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                aria-label="編集"
                                onClick={() => handleEditStart(cp)}
                                disabled={editingId !== null || isSavingEdit}
                                className="border border-line-dim bg-panel px-2 py-0.5 text-xs text-gold-accent hover:border-gold-accent hover:bg-gold-accent/10 disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-0.5 transition-colors"
                              >
                                ✎ 編集
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </PixelCard>
                );
              })}

            {/* 新規チェックポイント追加フォーム or ボタン */}
            {!isLoading && !error && (
              <div>
                {isAdding ? (
                  <div className="border border-dashed border-gold-accent bg-panel p-3">
                    <p className="text-xs font-bold text-gold-accent">
                      ＋ 新しいチェックポイントを追加
                    </p>
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        maxLength={200}
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return;
                          if (e.key === "Enter") handleAddCheckpoint();
                          if (e.key === "Escape") {
                            setIsAdding(false);
                            setNewTitle("");
                          }
                        }}
                        autoFocus
                        placeholder="例: 参考資料を1本選ぶ"
                        className="w-full rounded border border-gold-accent bg-field px-2.5 py-1 text-sm text-text focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddCheckpoint}
                          disabled={!newTitle.trim()}
                          className="border border-gold-accent bg-gold-accent/20 px-3 py-1 text-xs font-bold text-gold-accent hover:bg-gold-accent hover:text-gold-ink disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-0.5 transition-colors"
                        >
                          追加
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAdding(false);
                            setNewTitle("");
                          }}
                          className="border border-line-dim bg-panel px-3 py-1 text-xs text-muted hover:text-text active:translate-y-0.5 transition-colors"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="flex w-full items-center justify-center gap-1.5 border-2 border-dashed border-line-dim bg-panel/40 py-2.5 text-xs font-bold text-gold-accent hover:border-gold-accent hover:bg-panel active:translate-y-0.5 transition-colors"
                  >
                    <span>＋</span> チェックポイントを追加
                  </button>
                )}
              </div>
            )}
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
            <p className="mt-4 flex items-center justify-center gap-1 text-center text-xs text-muted">
              <span className="text-gold-accent">✧</span>{" "}
              {isFallback
                ? "基本ステップは自由に追加・編集・並び替えできます"
                : "AIが提案したチェックポイントは自由に追加・編集・並び替えできます"}
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
