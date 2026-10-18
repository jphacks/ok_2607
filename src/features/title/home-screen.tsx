import type { StatsResponse, Task } from "@/lib/schemas";
import { calculateLevel } from "@/features/checkpoint/xp";

export function HomeScreen({
  tasks,
  stats,
  error,
  inProgressQuestId,
  onQuest,
  onResumeQuest,
}: {
  tasks: Task[];
  stats: StatsResponse | null;
  error: string;
  inProgressQuestId?: string | null;
  onQuest: () => void;
  onResumeQuest?: (questId: string) => void;
}) {
  const current = tasks.find((task) => task.status === "in_quest");
  const completed = tasks.filter((task) => task.status === "done").slice(0, 3);
  return (
    <section aria-labelledby="home-heading">
      <div className="screen-heading">
        <div>
          <h1 id="home-heading">おかえりなさい、冒険者。</h1>
          <p>今日も一歩、前へ進もう。</p>
        </div>
        <span className="pixel-adventurer" aria-hidden="true" />
      </div>
      <button
        className="gold-button mb-6 min-h-20 w-full text-xl font-bold"
        onClick={() => {
          if (current && inProgressQuestId && onResumeQuest) {
            onResumeQuest(inProgressQuestId);
          } else {
            onQuest();
          }
        }}
      >
        <span className="mr-3" aria-hidden="true">
          ⚔
        </span>
        {current && inProgressQuestId ? "進行中の冒険を再開する" : "今日の冒険を始める"}
      </button>
      <div className="pixel-panel mb-4 p-4">
        <h2 className="text-sm">冒険の記録</h2>
        {stats ? (
          <>
            {(() => {
              const levelInfo = calculateLevel(stats.totalXp);
              return (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-base font-bold text-gold-accent">
                      Lv. {levelInfo.level}
                    </span>
                    <span className="text-xs text-muted">
                      次のLvまで {levelInfo.nextLevelXp} XP
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="次のレベルまでの進捗"
                    aria-valuenow={levelInfo.currentLevelXp}
                    aria-valuemin={0}
                    aria-valuemax={levelInfo.requiredXp}
                    className="mt-2 h-2 w-full overflow-hidden rounded bg-field"
                  >
                    <div
                      className="h-full bg-gold transition-all"
                      style={{ width: `${Math.round(levelInfo.progressRatio * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })()}
            <p className="mt-3 font-mono text-sm text-[#f3ca70]">EXP　{stats.totalXp}</p>
            <p className="mt-3 text-xs text-[#a4a8bc]">
              クリアしたクエスト　{stats.completedQuests} 件
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-[#a4a8bc]">
            {error ? "記録を取得できませんでした" : "記録を読み込み中…"}
          </p>
        )}
      </div>
      <div className="pixel-panel mb-6 min-h-[112px] p-4">
        <h2 className="mb-3 text-sm">今日の進捗</h2>
        {current ? (
          <>
            <p className="text-xs text-[#a5d4be]">クエストに挑戦中</p>
            <p className="mt-2 break-words text-sm leading-6">{current.title}</p>
            {inProgressQuestId && onResumeQuest && (
              <button
                className="secondary-button mt-3 w-full text-xs"
                onClick={() => onResumeQuest(inProgressQuestId)}
              >
                ▶ 進行中のクエスト画面を開く
              </button>
            )}
          </>
        ) : (
          <p className="text-xs leading-6 text-[#a4a8bc]">まだクエストを選んでいません</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-[#ffb5a9]">
          {error}
        </p>
      )}
      <h2 className="mb-3 mt-9 text-base">クリアした冒険</h2>
      {completed.length > 0 ? (
        <ul className="space-y-3">
          {completed.map((task) => (
            <li key={task.id} className="pixel-panel p-4">
              <p className="break-words text-sm text-[#a5d4be]">✓　{task.title}</p>
              <p className="mt-2 text-xs text-[#a4a8bc]">クエストクリア</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pixel-panel p-4 text-xs leading-6 text-[#a4a8bc]">
          冒険の記録はここに残ります。
          <br />
          最初の一歩を踏み出しましょう。
        </p>
      )}
    </section>
  );
}
