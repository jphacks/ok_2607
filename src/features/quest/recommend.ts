import type { QuestCandidatesResponse, Task } from "@/lib/schemas";

type RecommendationOptions = {
  now?: Date;
  random?: () => number;
};

/** 最短期限を先頭に確保し、残りは重みに比例して重複なく抽選する。 */
export function recommendTasks(
  tasks: readonly Task[],
  { now = new Date(), random = Math.random }: RecommendationOptions = {},
): Pick<QuestCandidatesResponse, "isUrgent" | "candidates"> {
  const active: Task[] = [];
  const nowMs = now.getTime();
  const cutoff = nowMs + 24 * 60 * 60 * 1000;
  let earliestDeadlineIndex = -1;
  let earliestDeadline = Infinity;

  for (const task of tasks) {
    if (task.status !== "active") continue;
    if (task.dueAt !== null) {
      const deadline = Date.parse(task.dueAt);
      if (deadline < nowMs) continue;
      if (deadline < earliestDeadline) {
        earliestDeadlineIndex = active.length;
        earliestDeadline = deadline;
      }
    }
    active.push(task);
  }

  const candidates = earliestDeadlineIndex < 0 ? [] : active.splice(earliestDeadlineIndex, 1);
  while (candidates.length < 3 && active.length > 0) {
    const totalWeight = active.reduce((total, task) => total + task.weight, 0);
    let index: number;
    if (totalWeight === 0) {
      // 重みが全て0でも候補を失わないよう、残りから等確率で選ぶ。
      index = Math.floor(random() * active.length);
    } else {
      let remainingWeight = random() * totalWeight;
      index = active.length - 1;
      for (let position = 0; position < active.length; position += 1) {
        remainingWeight -= active[position].weight;
        if (remainingWeight < 0) {
          index = position;
          break;
        }
      }
    }
    candidates.push(active[index]);
    active.splice(index, 1);
  }

  return { isUrgent: earliestDeadline <= cutoff, candidates };
}
