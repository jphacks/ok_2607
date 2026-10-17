import { useState } from "react";
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
  const selected =
    choices?.candidates.find((task) => task.id === selectedId) ?? choices?.candidates[0];

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
                : "3つの運命から、挑戦するタスクを選択"}
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
              ホームで確認する
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
              const checked = selected?.id === task.id;
              return (
                <label
                  key={task.id}
                  className={`pixel-panel block min-h-[128px] cursor-pointer px-4 py-4 transition-colors hover:bg-[#2a3047] ${checked ? "quest-selected" : ""}`}
                >
                  <div className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="w-6 shrink-0 pt-1 text-center text-[26px] leading-none text-[#f3ca70]"
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
                      <p className="break-words text-sm leading-6">{task.title}</p>
                      <p className="mt-1 text-xs text-[#a4a8bc]">
                        {choices.isUrgent && index === 0
                          ? "緊急クエスト ・ 締切間近"
                          : task.dueAt
                            ? "期限ありクエスト"
                            : "あなたが選ぶ、今日のクエスト"}
                      </p>
                      <p className="mt-2 text-xs text-[#a5d4be]">
                        {task.dueAt
                          ? `期限 ${new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(task.dueAt))}`
                          : "期限なし"}
                      </p>
                      <span className="mt-2 flex items-center gap-2 text-xs text-[#e6c875]">
                        <input
                          type="radio"
                          name="quest"
                          value={task.id}
                          checked={checked}
                          onChange={() => {
                            setSelectedId(task.id);
                            setStartError("");
                          }}
                          className="h-3 w-3 accent-[#f3ca70]"
                        />
                        {checked ? "選択中" : "選択する"}
                      </span>
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
            disabled={starting || pending}
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
