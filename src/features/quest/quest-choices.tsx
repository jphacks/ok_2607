"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx, vibrate } from "@/components/ui/sound";
import type { QuestCandidatesResponse, Task } from "@/lib/schemas";

/** カードを 1 枚ずつ配る間隔 */
const DEAL_INTERVAL_MS = 80;
export function QuestChoices({
  choices,
  pending,
  error,
  startReady = !pending && !error,
  rerollDisabled = false,
  presentationId,
  onAddTask,
  onHome,
  onRetry,
  onStart,
  onResumeQuest,
  onReroll = onRetry,
}: {
  choices: QuestCandidatesResponse | null;
  pending: boolean;
  error: string;
  startReady?: boolean;
  rerollDisabled?: boolean;
  presentationId?: number;
  onReroll?: () => void;
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
  // 挑戦を決めた後、選ばなかったカードを崩して消す
  const [leaving, setLeaving] = useState(false);
  const renderTimeRef = useRef<number>(Date.now());
  // 提示の保存応答によるメタ情報更新では、直前の選択を解除しない。
  const presentation = presentationId ?? choices;
  const hasCandidates = Boolean(
    choices && !choices.inProgressQuest && choices.candidates.length > 0,
  );

  useEffect(() => {
    renderTimeRef.current = Date.now();
    setIsInstantChoice(false);
    setSelectedId(null);
    setLeaving(false);
    setStartError("");
    if (hasCandidates) playSfx("flip");
  }, [presentation, hasCandidates]);

  const selected = choices?.candidates.find((task) => task.id === selectedId) ?? null;
  // 候補が並んでいるときだけ、見出しの右に再抽選アイコンを出す。
  const canRetry = Boolean(
    choices && !error && !choices.inProgressQuest && choices.candidates.length > 0,
  );

  function handleSelectTask(taskId: string) {
    if (starting) return;
    const elapsed = Date.now() - renderTimeRef.current;
    setIsInstantChoice(elapsed <= 3000);
    setSelectedId(taskId);
    setStartError("");
    playSfx("select");
    vibrate(20);
  }
  async function start() {
    if (!selected || starting || pending || !startReady || error) return;
    setStarting(true);
    setStartError("");
    setLeaving(true);
    try {
      await onStart(selected);
    } catch (cause) {
      setLeaving(false);
      setStartError(cause instanceof Error ? cause.message : "クエストを開始できませんでした。");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section aria-labelledby="quest-heading" aria-busy={pending}>
      <div className="screen-heading mb-4 min-h-0">
        <div className="min-w-0">
          <h1 id="quest-heading">
            {choices?.inProgressQuest ? "進行中のクエスト" : "クエストを選べ"}
          </h1>
          <p>
            {choices?.inProgressQuest
              ? "まずは挑戦中のクエストに集中しよう"
              : choices?.isUrgent
                ? "締切の近いクエストも含めて、挑戦するタスクを選択"
                : "直感を信じて、最初に目が留まったものをタップ！"}
          </p>
        </div>
        {canRetry ? (
          <button
            type="button"
            aria-label="候補を再抽選する"
            title="候補を再抽選する"
            onClick={onReroll}
            disabled={pending || starting || rerollDisabled || Boolean(error)}
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-gold-border/60 bg-panel text-2xl leading-none text-gold-accent transition-colors hover:bg-panel-active disabled:cursor-wait disabled:opacity-60"
          >
            <span aria-hidden="true" className={pending ? "motion-safe:animate-spin" : ""}>
              ↻
            </span>
          </button>
        ) : (
          <span className="pixel-slime" aria-hidden="true" />
        )}
      </div>
      {error && (
        <div className="pixel-panel p-5">
          <p role="alert" className="text-sm leading-6 text-danger">
            {error}
          </p>
          <button
            className="secondary-button mt-4 w-full"
            onClick={onRetry}
            disabled={pending || starting}
          >
            もう一度読み込む
          </button>
        </div>
      )}
      {!choices ? (
        error ? null : (
          <p role="status" className="pixel-panel p-6 text-sm text-muted">
            クエストの候補を読み込んでいます…
          </p>
        )
      ) : choices.inProgressQuest ? (
        <div className="pixel-panel p-6">
          <h2 className="text-base text-gold-accent">クエストに挑戦中</h2>
          <p className="mb-6 mt-3 text-sm leading-7 text-muted">
            進行中のクエストがあります。新しいクエストを選ぶ前に、今のクエストを進めましょう。
          </p>
          <div className="space-y-3">
            {onResumeQuest && (
              <button
                className="gold-button w-full"
                disabled={pending || starting}
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
          <h2 className="text-base text-gold-accent">クエストの種を登録しよう</h2>
          <p className="mb-6 mt-3 text-sm leading-7 text-muted">
            選べるタスクがまだありません。
            <br />
            やりたいことを追加すると、ここにクエストの候補が現れます。
          </p>
          <button className="gold-button w-full" onClick={onAddTask}>
            ＋ 新しいタスクを追加
          </button>
        </div>
      ) : (
        <>
          <fieldset
            className={`space-y-2.5 ${isInstantChoice && selected ? "animate-shake" : ""}`}
            disabled={starting}
          >
            <legend className="sr-only">挑戦するタスクを1つ選ぶ</legend>
            {choices.candidates.map((task, index) => {
              const checked = selectedId === task.id;
              // 1つ選んだら、選ばれていないカードははっきり暗くする（タップで選び直せる）。
              const dimmed = selectedId !== null && !checked;
              const isUrgent = choices.isUrgent && index === 0;
              const dealDelay = `${index * DEAL_INTERVAL_MS}ms`;
              return (
                // 外側でカードを配って表に返し、内側（label）で緊急・選択・退場の演出をする
                <div
                  key={task.id}
                  className="animate-card-flip"
                  style={{ animationDelay: dealDelay }}
                >
                  <label
                    data-selected={checked}
                    data-dimmed={dimmed}
                    style={{ animationDelay: checked || leaving ? undefined : dealDelay }}
                    className={`pixel-panel relative block cursor-pointer px-4 py-3 transition-all duration-200 motion-reduce:transition-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-accent ${
                      leaving && !checked
                        ? "pointer-events-none animate-dissolve"
                        : checked
                          ? "z-10 animate-pop scale-[1.02] border-[3px] border-gold-accent bg-panel-active shadow-[0_0_16px_var(--color-gold-accent)] motion-reduce:scale-100"
                          : `${isUrgent ? "border-2 border-urgent animate-urgent-pulse" : ""} ${
                              dimmed
                                ? "opacity-40 grayscale hover:opacity-70"
                                : "hover:bg-panel-active active:scale-[0.99]"
                            }`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="w-7 shrink-0 pt-0.5 text-center text-[26px] leading-none text-gold-accent"
                      >
                        {isUrgent ? "♨" : index === 0 ? "⚔" : index === 1 ? "✦" : "✧"}
                      </span>
                      <div className="min-w-0 flex-1">
                        {/* タイトルを中央に大きく太字で配置（直感ファースト） */}
                        {/* 長いタイトルでも画面に収まるよう 2 行で切る */}
                        <p className="line-clamp-2 break-words font-dotgothic text-base font-bold leading-6 text-text">
                          {task.title}
                        </p>
                        {/* 詳細・メタ情報はトーンを抑えて配置 */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted/80">
                          {isUrgent && <span>緊急クエスト ・ 締切間近</span>}
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
                        <input
                          type="radio"
                          name="quest"
                          value={task.id}
                          checked={checked}
                          onChange={() => handleSelectTask(task.id)}
                          className="sr-only"
                        />
                      </div>
                    </div>
                    {checked && isInstantChoice && (
                      <span
                        data-testid="instant-choice-badge"
                        className="absolute -top-2 right-3 animate-stamp border-2 border-neon-pink bg-surface px-2 font-dotgothic text-sm font-bold text-neon-pink"
                      >
                        即決!!
                      </span>
                    )}
                  </label>
                </div>
              );
            })}
          </fieldset>
          {startError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {startError}
            </p>
          )}
          <button
            className="gold-button mt-4 w-full text-left"
            disabled={starting || pending || !startReady || Boolean(error) || !selected}
            onClick={start}
          >
            {starting ? "クエストを開始中…" : "このクエストに挑戦する"}
          </button>
        </>
      )}
    </section>
  );
}
