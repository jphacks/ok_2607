import type { QuestCandidatesResponse, Task } from "@/lib/schemas";

type RecommendationOptions = {
  now?: Date;
  random?: () => number;
};

/** 緊急の最短期限を優先し、それ以外は重みに比例して重複なく抽選する。 */
export function recommendTasks(
  tasks: readonly Task[],
  { now = new Date(), random = Math.random }: RecommendationOptions = {},
): QuestCandidatesResponse {
  const active = tasks.filter((task) => task.status === "active");
  const cutoff = now.getTime() + 24 * 60 * 60 * 1000;
  let urgent: Task | undefined;
  let earliestDeadline = Infinity;

  for (const task of active) {
    if (task.dueAt === null) continue;
    const deadline = Date.parse(task.dueAt);
    if (deadline <= cutoff && deadline < earliestDeadline) {
      urgent = task;
      earliestDeadline = deadline;
    }
  }

  if (urgent) return { isUrgent: true, candidates: [urgent] };

  const candidates: Task[] = [];
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

  return { isUrgent: false, candidates };
}
