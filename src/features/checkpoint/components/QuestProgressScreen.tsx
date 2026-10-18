"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, type Checkpoint } from "@/lib/schemas";
import { type CheckpointStep, childCheckpointsOf, computeCheckpointFocus } from "../order";
import { DecorativeTileBar, PixelHeader } from "./PixelHeader";
import { HeroPixelArt } from "./HeroPixelArt";
import { PixelButton } from "./PixelButton";
import { PixelCheckbox } from "./PixelCheckbox";
import { PixelProgressBar } from "./PixelProgressBar";
import { RoadmapSheet } from "./RoadmapSheet";

interface QuestProgressScreenProps {
  questId: string;
  taskTitle: string;
  initialCheckpoints: Checkpoint[];
  level?: number;
  onCompleteQuest?: () => void;
}

/** この件数以上のときは、完了済みと先の項目を畳んでスクロールなしで収める */
const COMPACT_THRESHOLD = 7;
/** 畳むときに表示する先の項目の数 */
const VISIBLE_LOCKED_IN_COMPACT = 2;

export function QuestProgressScreen({
  questId,
  taskTitle,
  initialCheckpoints,
  level = 4,
  onCompleteQuest,
}: QuestProgressScreenProps) {
  const router = useRouter();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(initialCheckpoints);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // 同じ描画のあいだの連打も防ぐため、通信中かどうかは ref でも持つ
  const pendingRef = useRef(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const closeRoadmap = useCallback(() => setIsRoadmapOpen(false), []);

  const focus = computeCheckpointFocus(checkpoints);
  const { steps, current, completedCount, totalCount, isAllCompleted } = focus;
  const currentStep = steps.find((step) => step.state === "current");
  const currentChildren = current ? childCheckpointsOf(checkpoints, current.id) : [];

  const doneSteps = steps.filter((step) => step.state === "done");
  const lockedSteps = steps.filter((step) => step.state === "locked");
  const isCompact = totalCount >= COMPACT_THRESHOLD;
  // 畳むときは、取り消し用に最後の完了済みだけ残す
  const foldedDoneCount = isCompact ? Math.max(0, doneSteps.length - 1) : 0;
  const visibleDoneSteps = doneSteps.slice(foldedDoneCount);
  const visibleLockedSteps = isCompact
    ? lockedSteps.slice(0, VISIBLE_LOCKED_IN_COMPACT)
    : lockedSteps;
  const foldedLockedCount = lockedSteps.length - visibleLockedSteps.length;

  // マイルストーンの完了状態トグル（順番どおりのものだけ）
  const handleToggle = async (step: CheckpointStep) => {
    if (!step.canToggle || pendingRef.current) {
      return;
    }
    const { id, isDone: currentStatus } = step.checkpoint;
    const nextStatus = !currentStatus;
    const setStatus = (isDone: boolean) =>
      setCheckpoints((prev) => prev.map((cp) => (cp.id === id ? { ...cp, isDone } : cp)));

    // 楽観的更新
    setStatus(nextStatus);
    setError(null);

    // デモ用チェックポイント（または demo クエスト）の場合は API 呼び出しを行わずローカル更新のみ
    if (questId === "demo" || id.startsWith("demo-")) {
      return;
    }

    // 通信中は他の操作を受け付けない（連打で順番を飛ばさないため）
    pendingRef.current = true;
    setPendingId(id);
    try {
      const res = await fetch(`/api/checkpoints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: nextStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setStatus(currentStatus);
        setError(errorData?.error?.message || "マイルストーンの更新に失敗しました。");
      }
    } catch {
      setStatus(currentStatus);
      setError("通信エラーが発生しました。");
    } finally {
      pendingRef.current = false;
      setPendingId(null);
    }
  };

  // クエスト完了
  const handleComplete = async () => {
    if (pendingRef.current || !isAllCompleted) return;
    if (onCompleteQuest) {
      onCompleteQuest();
      return;
    }

    // デモクエストの場合は API 呼び出しを行わずにクリア画面へ遷移
    if (questId === "demo") {
      router.push("/quests/demo/clear");
      return;
    }

    pendingRef.current = true;
    setIsCompleting(true);
    setError(null);
    let completed = false;

    try {
      const res = await fetch(`/api/quests/${questId}/complete`, {
        method: "POST",
      });

      if (res.ok) {
        completed = true;
        router.push(`/quests/${questId}/clear`);
      } else {
        const body: unknown = await res.json().catch(() => null);
        const parsed = ApiError.safeParse(body);
        setError(
          parsed.success
            ? parsed.data.error.message
            : "完了を保存できませんでした。もう一度お試しください。",
        );
      }
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
    } finally {
      if (!completed) {
        pendingRef.current = false;
        setIsCompleting(false);
      }
    }
  };

  return (
    <div className="flex min-h-dvh w-full flex-col items-center bg-surface text-text">
      <main className="flex min-h-dvh w-full max-w-3xl flex-col px-5 py-3 font-dotgothic sm:px-8 sm:py-6 lg:px-12 lg:py-8">
        <PixelHeader level={level} />
        <DecorativeTileBar className="my-1" />

        {/* 見出し & 主人公キャラクター */}
        <div className="mt-2 flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[11px] font-bold tracking-wider text-gold-accent">
              QUEST IN PROGRESS
            </span>
            <h1 className="mt-0.5 line-clamp-2 text-lg font-bold tracking-wide break-words text-text">
              {taskTitle}
            </h1>
          </div>
          <div className="flex-shrink-0">
            <HeroPixelArt size={44} />
          </div>
        </div>

        <div className="mt-3">
          <PixelProgressBar completed={completedCount} total={totalCount} />
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setIsRoadmapOpen(true)}
              aria-haspopup="dialog"
              className="-my-2 min-h-11 px-2 text-xs text-gold-text hover:text-gold-accent"
            >
              🗺 ロードマップを見る
            </button>
          </div>
        </div>

        {/* マイルストーン: 今やる 1 つだけを強調し、他は小さく表示する */}
        <ol className="mt-4 flex flex-1 flex-col gap-1.5" aria-label="マイルストーン">
          {foldedDoneCount > 0 && (
            <li className="px-2 text-xs text-muted opacity-70">✓ {foldedDoneCount} 件完了</li>
          )}

          {visibleDoneSteps.map((step) => (
            <li key={step.checkpoint.id}>
              <SmallStepRow step={step} onToggle={handleToggle} />
            </li>
          ))}

          {current ? (
            <li>
              <div
                role="group"
                aria-label="今やること"
                onClick={() => currentStep && void handleToggle(currentStep)}
                className="my-1 cursor-pointer border-4 border-gold-accent bg-panel-active p-4 shadow-md transition-transform active:translate-y-0.5"
              >
                <p className="text-xs font-bold tracking-wider text-gold-accent">▶ 今やること</p>
                <div className="mt-2 flex items-center gap-3">
                  <h2 className="line-clamp-3 min-w-0 flex-1 text-xl leading-snug font-bold break-words text-text">
                    {current.title}
                  </h2>
                  <PixelCheckbox
                    checked={false}
                    disabled={pendingId !== null || isCompleting}
                    onChange={() => currentStep && void handleToggle(currentStep)}
                  />
                </div>
                {currentChildren.length > 0 && (
                  <ul className="mt-3 space-y-0.5 border-t border-line-dim pt-2">
                    {currentChildren.map((child) => (
                      <li key={child.id} className="line-clamp-1 text-xs text-muted">
                        ・{child.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ) : (
            totalCount > 0 && (
              <li className="my-1 border-4 border-gold-accent bg-panel-active p-4 text-center">
                <p className="text-base font-bold text-gold-accent">
                  すべてのマイルストーンを達成！
                </p>
                <p className="mt-1 text-xs text-muted">クエストを完了しよう</p>
              </li>
            )
          )}

          {visibleLockedSteps.map((step) => (
            <li key={step.checkpoint.id}>
              <SmallStepRow step={step} onToggle={handleToggle} />
            </li>
          ))}

          {foldedLockedCount > 0 && (
            <li className="px-2 text-xs text-muted opacity-60">🔒 ほか {foldedLockedCount} 件</li>
          )}
        </ol>

        {error && (
          <p role="alert" className="mt-2 text-center text-xs text-danger">
            {error}
          </p>
        )}

        {/* 下部アクションボタン & 装飾バー */}
        <div className="mt-4 pb-1">
          <PixelButton
            onClick={handleComplete}
            disabled={pendingId !== null || isCompleting || !isAllCompleted}
            className={isAllCompleted ? "motion-safe:animate-pulse" : ""}
          >
            {isCompleting ? "完了処理中..." : "クエストを完了する"}
          </PixelButton>
          <DecorativeTileBar className="mt-3" />
        </div>
      </main>
      <RoadmapSheet
        open={isRoadmapOpen}
        onClose={closeRoadmap}
        taskTitle={taskTitle}
        checkpoints={checkpoints}
      />
    </div>
  );
}

interface SmallStepRowProps {
  step: CheckpointStep;
  onToggle: (step: CheckpointStep) => void;
}

/** 完了済み・先の項目を 1 行で小さく表示する。順番外のものはロックする */
function SmallStepRow({ step, onToggle }: SmallStepRowProps) {
  const isDone = step.state === "done";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={step.state === "done"}
      aria-disabled={!step.canToggle}
      onClick={() => onToggle(step)}
      className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs ${
        isDone ? "text-muted opacity-70" : "text-muted opacity-50"
      } ${step.canToggle ? "cursor-pointer hover:opacity-100" : "cursor-default"}`}
    >
      <span aria-hidden="true" className="w-4 flex-shrink-0 text-center">
        {isDone ? "✓" : "🔒"}
      </span>
      <span className={`line-clamp-1 min-w-0 flex-1 break-all ${isDone ? "line-through" : ""}`}>
        {step.checkpoint.title}
      </span>
      {step.canToggle && <span className="flex-shrink-0 text-[10px] text-gold-text">戻す</span>}
    </button>
  );
}
