import { z } from "zod";
import { QuestCandidatesResponse, Task } from "@/lib/schemas";

export const QUEST_CACHE_TTL_MS = 60_000;
const CACHE_VERSION = 1;

const Snapshot = z
  .object({
    version: z.literal(CACHE_VERSION),
    userId: z.string().min(1),
    savedAt: z.number().finite().nonnegative(),
    tasks: z.array(Task),
    choices: QuestCandidatesResponse,
  })
  .superRefine(({ tasks, choices }, context) => {
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const candidateIds = new Set(choices.candidates.map((task) => task.id));
    const consistent =
      byId.size === tasks.length &&
      candidateIds.size === choices.candidates.length &&
      choices.candidates.every(
        (task) =>
          task.status === "active" && JSON.stringify(task) === JSON.stringify(byId.get(task.id)),
      ) &&
      (!choices.isUrgent || choices.candidates.length === 1) &&
      (!choices.inProgressQuest ||
        (choices.candidates.length === 0 &&
          choices.inProgressQuest.status === "in_progress" &&
          byId.get(choices.inProgressQuest.taskId)?.status === "in_quest"));
    if (!consistent) context.addIssue({ code: "custom", message: "候補とタスクが一致しません" });
  });

type QuestSnapshot = Pick<z.infer<typeof Snapshot>, "tasks" | "choices" | "savedAt">;

export function questCacheKey(userId: string): string {
  return `trione:quest:v${CACHE_VERSION}:${encodeURIComponent(userId)}`;
}

export function clearQuestCache(userId: string): void {
  try {
    window.localStorage.removeItem(questCacheKey(userId));
  } catch {
    // 保存領域が利用できなくても、DBからの読み込みは継続する。
  }
}

export function readQuestCache(userId: string, now = Date.now()): QuestSnapshot | null {
  try {
    const raw = window.localStorage.getItem(questCacheKey(userId));
    if (raw === null) return null;
    const parsed = Snapshot.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      parsed.data.userId !== userId ||
      parsed.data.savedAt > now ||
      now - parsed.data.savedAt >= QUEST_CACHE_TTL_MS
    ) {
      clearQuestCache(userId);
      return null;
    }
    return {
      tasks: parsed.data.tasks,
      choices: parsed.data.choices,
      savedAt: parsed.data.savedAt,
    };
  } catch {
    clearQuestCache(userId);
    return null;
  }
}

/** DBで確認済みの、候補と全タスクが一致する状態だけを保存する。 */
export function writeQuestCache(
  userId: string,
  snapshot: Omit<QuestSnapshot, "savedAt">,
  savedAt = Date.now(),
): void {
  try {
    const parsed = Snapshot.safeParse({ ...snapshot, version: CACHE_VERSION, userId, savedAt });
    if (!parsed.success) {
      clearQuestCache(userId);
      return;
    }
    window.localStorage.setItem(questCacheKey(userId), JSON.stringify(parsed.data));
  } catch {
    // プライベートモードや容量制限時はキャッシュなしで動作する。
  }
}
