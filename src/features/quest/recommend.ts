import type { QuestCandidatesResponse, Task } from "@/lib/schemas";

type RecommendationOptions = {
  now?: Date;
  random?: () => number;
};

/** 緊急の最短期限を優先し、それ以外はreject回数の逆数に比例して重複なく抽選する。 */
export function recommendTasks(
  tasks: readonly Task[],
  { now = new Date(), random = Math.random }: RecommendationOptions = {},
): Pick<QuestCandidatesResponse, "isUrgent" | "candidates"> {
  const active: Task[] = [];
  const nowMs = now.getTime();
  const cutoff = nowMs + 24 * 60 * 60 * 1000;
  let urgent: Task | undefined;
  let earliestDeadline = Infinity;

  for (const task of tasks) {
    if (task.status !== "active") continue;
    if (task.dueAt !== null) {
      const deadline = Date.parse(task.dueAt);
      if (deadline < nowMs) continue;
      if (deadline <= cutoff && deadline < earliestDeadline) {
        urgent = task;
        earliestDeadline = deadline;
      }
    }
    active.push(task);
  }

  if (urgent) return { isUrgent: true, candidates: [urgent] };

  const candidates: Task[] = [];
  while (candidates.length < 3 && active.length > 0) {
    const totalScore = active.reduce((total, task) => total + 1 / (task.skippedCount + 1), 0);
    // [0, 総スコア) の抽選は、各スコアを総和で正規化した確率と等価。
    let remainingScore = random() * totalScore;
    let index = active.length - 1;
    for (let position = 0; position < active.length; position += 1) {
      remainingScore -= 1 / (active[position].skippedCount + 1);
      if (remainingScore < 0) {
        index = position;
        break;
      }
    }
    candidates.push(active[index]);
    active.splice(index, 1);
  }

  return { isUrgent: false, candidates };
}
