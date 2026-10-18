"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestCandidatesResponse, Task } from "@/lib/schemas";
export function QuestChoices({
  choices,
  pending,
  error,
  onAddTask,
  onHome,
  onRetry,
  onStart,
  onResumeQuest,
}: {
  choices: QuestCandidatesResponse | null;
  pending: boolean;
  error: string;
  onAddTask: () => void;
  onHome: () => void;
  onRetry: () => void;
  onStart: (task: Task) => Promise<void>;
  onResumeQuest?: (questId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [isInstantChoice, setIsInstantChoice] = useState(false);
  const renderTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    renderTimeRef.current = Date.now();
    setIsInstantChoice(false);
    setSelectedId(null);
  }, [choices]);

  const selected = choices?.candidates.find((task) => task.id === selectedId) ?? null;

  function handleSelectTask(taskId: string) {
    if (starting || pending) return;
    const elapsed = Date.now() - renderTimeRef.current;
    setIsInstantChoice(elapsed <= 3000);
    setSelectedId(taskId);
    setStartError("");
  }
  async function start() {
    if (!selected || starting) return;
    setStarting(true);
    setStartError("");
    try {
      await onStart(selected);
    } catch (cause) {
      setStartError(cause instanceof Error ? cause.message : "クエストを開始できませんでした。");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section aria-labelledby="quest-heading" aria-busy={pending}>
      <div className="screen-heading">
        <div>
          <h1 id="quest-heading">
            {choices?.inProgressQuest ? "進行中の冒険" : "今日の冒険を選べ"}
          </h1>
          <p>
            {choices?.inProgressQuest
              ? "まずは挑戦中のクエストに集中しよう"
              : choices?.isUrgent
                ? "締切の近い冒険も含めて、挑戦するタスクを選択"
                : "直感を信じて、最初に目が留まったものをタップ！"}
          </p>
        </div>
        <span className="pixel-slime" aria-hidden="true" />
      </div>
      {error ? (
        <div className="pixel-panel p-5">
          <p role="alert" className="text-sm leading-6 text-[#ffb5a9]">
            {error}
          </p>
          <button className="secondary-button mt-4 w-full" onClick={onRetry} disabled={pending}>
            もう一度読み込む
          </button>
        </div>
      ) : !choices ? (
        <p role="status" className="pixel-panel p-6 text-sm text-[#a4a8bc]">
          冒険の候補を読み込んでいます…
        </p>
      ) : choices.inProgressQuest ? (
        <div className="pixel-panel p-6">
          <h2 className="text-base text-[#f3ca70]">クエストに挑戦中</h2>
          <p className="mb-6 mt-3 text-sm leading-7 text-[#a4a8bc]">
            進行中のクエストがあります。新しい冒険を選ぶ前に、今のクエストを進めましょう。
          </p>
          <div className="space-y-3">
            {onResumeQuest && (
              <button
                className="gold-button w-full"
                onClick={() => onResumeQuest(choices.inProgressQuest!.id)}
              >
                進行中のクエスト画面を開く
              </button>
            )}
            <button className="secondary-button w-full" onClick={onHome}>
              ステータスで確認する
            </button>
          </div>
        </div>
      ) : choices.candidates.length === 0 ? (
        <div className="pixel-panel p-6">
          <h2 className="text-base text-[#f3ca70]">冒険の種を登録しよう</h2>
          <p className="mb-6 mt-3 text-sm leading-7 text-[#a4a8bc]">
            選べるタスクがまだありません。
            <br />
            やりたいことを追加すると、ここに冒険の候補が現れます。
          </p>
          <button className="gold-button w-full" onClick={onAddTask}>
            ＋ 新しいタスクを追加
          </button>
        </div>
      ) : (
        <>
          <fieldset className="space-y-3.5" disabled={starting || pending}>
            <legend className="sr-only">挑戦するタスクを1つ選ぶ</legend>
            {choices.candidates.map((task, index) => {
              const checked = selectedId === task.id;
              return (
                <label
                  key={task.id}
                  onClick={() => handleSelectTask(task.id)}
                  style={{ animationDelay: `${index * 80}ms` }}
                  className={`pixel-panel animate-card-draw relative block min-h-[120px] cursor-pointer px-5 py-4 transition-all hover:bg-panel-active active:scale-[0.99] ${
                    checked ? "quest-selected shadow-[0_0_12px_var(--color-gold-accent)]" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden="true"
                      className="w-7 shrink-0 pt-0.5 text-center text-[28px] leading-none text-gold-accent"
                    >
                      {choices.isUrgent && index === 0
                        ? "♨"
                        : index === 0
                          ? "⚔"
                          : index === 1
                            ? "✦"
                            : "✧"}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* タイトルを中央に大きく太字で配置（直感ファースト） */}
                      <p className="break-words font-dotgothic text-base font-bold leading-6 text-text">
                        {task.title}
                      </p>
                      {/* 詳細・メタ情報はトーンを抑えて配置 */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted/80">
                        <span>
                          {choices.isUrgent && index === 0
                            ? "緊急クエスト ・ 締切間近"
                            : "今日のクエスト候補"}
                        </span>
                        <span aria-label={`reject回数 ${task.skippedCount}回`}>
                          ❌{task.skippedCount}
                        </span>
                        {task.dueAt && (
                          <span className="text-success/90">
                            期限{" "}
                            {new Intl.DateTimeFormat("ja-JP", {
                              month: "numeric",
                              day: "numeric",
                            }).format(new Date(task.dueAt))}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-gold-text">
                          <input
                            type="radio"
                            name="quest"
                            value={task.id}
                            checked={checked}
                            onChange={() => handleSelectTask(task.id)}
                            className="h-3.5 w-3.5 accent-gold-accent"
                          />
                          {checked ? "選択中" : "選択する"}
                        </span>
                        {checked && isInstantChoice && (
                          <span
                            data-testid="instant-choice-badge"
                            className="animate-pulse font-dotgothic text-xs font-bold text-gold"
                          >
                            ⚡ 直感即決！
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </fieldset>
          {startError && (
            <p role="alert" className="mt-4 text-sm text-[#ffb5a9]">
              {startError}
            </p>
          )}
          <button
            className="gold-button mt-8 w-full text-left"
            disabled={starting || pending || !selected}
            onClick={start}
          >
            {starting ? "クエストを開始中…" : "このクエストに挑戦する"}
          </button>
          <button
            className="mt-4 w-full py-1 text-xs text-[#a4a8bc] hover:text-[#f3ca70] disabled:opacity-50"
            onClick={onRetry}
            disabled={pending || starting}
          >
            ↻　{pending ? "抽選中…" : "再抽選する"}
          </button>
        </>
      )}
    </section>
  );
}
