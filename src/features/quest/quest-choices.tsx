"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx, vibrate } from "@/components/ui/sound";
import type { QuestCandidatesResponse, Task } from "@/lib/schemas";
import { getRarity, RARITY_LABEL, type Rarity } from "./rarity";

/** レア度ごとのカードの枠と、表示中に続く演出（選択中・退場中は別の演出に置き換える） */
const RARITY_CARD_CLASS: Record<Rarity, string> = {
  common: "border-rarity-common",
  rare: "border-2 border-rarity-rare text-rarity-rare animate-rare-glow",
  mythic:
    // background-size を別クラスにすると一括指定に上書きされるため、一括指定の中に書く
    "border-2 border-transparent animate-holo [background:linear-gradient(var(--color-panel),var(--color-panel))_0_0/100%_100%_padding-box,linear-gradient(90deg,var(--color-rarity-mythic),var(--color-neon-pink),var(--color-neon-cyan),var(--color-rarity-mythic))_0_0/200%_100%_border-box]",
  urgent: "border-2 border-urgent animate-urgent-pulse",
};

const RARITY_LABEL_CLASS: Partial<Record<Rarity, string>> = {
  rare: "border-rarity-rare text-rarity-rare",
  mythic: "border-rarity-mythic text-rarity-mythic",
};

/** カードを 1 枚ずつ配る間隔 */
const DEAL_INTERVAL_MS = 80;
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
  // 挑戦を決めた後、選ばなかったカードを崩して消す
  const [leaving, setLeaving] = useState(false);
  const renderTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    renderTimeRef.current = Date.now();
    setIsInstantChoice(false);
    setSelectedId(null);
    setLeaving(false);
    if (choices && !choices.inProgressQuest && choices.candidates.length > 0) playSfx("flip");
  }, [choices]);

  const selected = choices?.candidates.find((task) => task.id === selectedId) ?? null;
  // 候補が並んでいるときだけ、見出しの右に再抽選アイコンを出す。
  const canRetry = Boolean(
    choices && !error && !choices.inProgressQuest && choices.candidates.length > 0,
  );

  function handleSelectTask(taskId: string) {
    if (starting || pending) return;
    const elapsed = Date.now() - renderTimeRef.current;
    setIsInstantChoice(elapsed <= 3000);
    setSelectedId(taskId);
    setStartError("");
    playSfx("select");
    vibrate(20);
  }
  async function start() {
    if (!selected || starting) return;
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
        {canRetry ? (
          <button
            type="button"
            aria-label="候補を再抽選する"
            title="候補を再抽選する"
            onClick={onRetry}
            disabled={pending || starting}
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
      {error ? (
        <div className="pixel-panel p-5">
          <p role="alert" className="text-sm leading-6 text-danger">
            {error}
          </p>
          <button className="secondary-button mt-4 w-full" onClick={onRetry} disabled={pending}>
            もう一度読み込む
          </button>
        </div>
      ) : !choices ? (
        <p role="status" className="pixel-panel p-6 text-sm text-muted">
          冒険の候補を読み込んでいます…
        </p>
      ) : choices.inProgressQuest ? (
        <div className="pixel-panel p-6">
          <h2 className="text-base text-gold-accent">クエストに挑戦中</h2>
          <p className="mb-6 mt-3 text-sm leading-7 text-muted">
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
          <h2 className="text-base text-gold-accent">冒険の種を登録しよう</h2>
          <p className="mb-6 mt-3 text-sm leading-7 text-muted">
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
          <fieldset
            className={`space-y-2.5 ${isInstantChoice && selected ? "animate-shake" : ""}`}
            disabled={starting || pending}
          >
            <legend className="sr-only">挑戦するタスクを1つ選ぶ</legend>
            {choices.candidates.map((task, index) => {
              const checked = selectedId === task.id;
              // 1つ選んだら、選ばれていないカードははっきり暗くする（タップで選び直せる）。
              const dimmed = selectedId !== null && !checked;
              const rarity = getRarity(task.skippedCount, choices.isUrgent && index === 0);
              const rarityLabelClass = RARITY_LABEL_CLASS[rarity];
              const dealDelay = `${index * DEAL_INTERVAL_MS}ms`;
              return (
                // 外側でカードを配って表に返し、内側（label）でレア度・選択・退場の演出をする
                <div
                  key={task.id}
                  className="animate-card-flip"
                  style={{ animationDelay: dealDelay }}
                >
                  <label
                    data-selected={checked}
                    data-dimmed={dimmed}
                    data-rarity={rarity}
                    style={{ animationDelay: checked || leaving ? undefined : dealDelay }}
                    className={`pixel-panel relative block cursor-pointer px-4 py-3 transition-all duration-200 motion-reduce:transition-none ${
                      leaving && !checked
                        ? "pointer-events-none animate-dissolve"
                        : checked
                          ? "z-10 animate-pop scale-[1.02] border-[3px] border-gold-accent bg-panel-active shadow-[0_0_16px_var(--color-gold-accent)] motion-reduce:scale-100"
                          : `${RARITY_CARD_CLASS[rarity]} ${
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
                        {/* 長いタイトルでも画面に収まるよう 2 行で切る */}
                        <p className="line-clamp-2 break-words font-dotgothic text-base font-bold leading-6 text-text">
                          {task.title}
                        </p>
                        {/* 詳細・メタ情報はトーンを抑えて配置 */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted/80">
                          <span>
                            {choices.isUrgent && index === 0
                              ? "緊急クエスト ・ 締切間近"
                              : "今日のクエスト候補"}
                          </span>
                          {rarityLabelClass && (
                            <span
                              className={`border px-1.5 font-dotgothic text-[11px] font-bold leading-4 ${rarityLabelClass}`}
                            >
                              {RARITY_LABEL[rarity]}
                            </span>
                          )}
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
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 text-gold-text">
                            <input
                              type="radio"
                              name="quest"
                              value={task.id}
                              checked={checked}
                              onChange={() => handleSelectTask(task.id)}
                              className="h-3.5 w-3.5 accent-gold-accent"
                            />
                            <span className={checked ? "font-bold text-gold-accent" : ""}>
                              {checked ? "選択中" : "選択する"}
                            </span>
                          </span>
                        </div>
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
            disabled={starting || pending || !selected}
            onClick={start}
          >
            {starting ? "クエストを開始中…" : "このクエストに挑戦する"}
          </button>
        </>
      )}
    </section>
  );
}
