import type { Checkpoint, Quest, Task } from "@/lib/schemas";

export interface DbCheckpointRow {
  id: string;
  quest_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  position: number;
  is_done: boolean;
  done_at: string | null;
  created_at?: string;
}

export interface DbQuestRow {
  id: string;
  task_id: string;
  status: "in_progress" | "completed" | "abandoned";
  is_urgent: boolean;
  xp_earned: number;
  started_at: string;
  completed_at: string | null;
}

export interface DbTaskRow {
  id: string;
  title: string;
  due_at: string | null;
  weight: number;
  status: "active" | "in_quest" | "done" | "discarded";
  shown_count: number;
  skipped_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * DB の snake_case 行オブジェクトを API/ドメイン用の Checkpoint (camelCase) に変換する。
 */
export function mapDbCheckpointToSchema(row: DbCheckpointRow): Checkpoint {
  return {
    id: row.id,
    questId: row.quest_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    position: row.position,
    isDone: row.is_done,
    doneAt: row.done_at,
  };
}

/**
 * DB の snake_case 行オブジェクトを API/ドメイン用の Quest (camelCase) に変換する。
 */
export function mapDbQuestToSchema(row: DbQuestRow): Quest {
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status,
    isUrgent: row.is_urgent,
    xpEarned: row.xp_earned,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

/**
 * DB の snake_case 行オブジェクトを API/ドメイン用の Task (camelCase) に変換する。
 */
export function mapDbTaskToSchema(row: DbTaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    weight: row.weight,
    status: row.status,
    shownCount: row.shown_count,
    skippedCount: row.skipped_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * チェックポイントの配列を親・子の階層順（親の position 昇順、各親の下で子の position 昇順）に整列する。
 */
export function sortCheckpointsInTreeOrder(checkpoints: Checkpoint[]): Checkpoint[] {
  const parents = checkpoints
    .filter((cp) => cp.parentId === null)
    .sort((a, b) => a.position - b.position);

  const childrenByParent = new Map<string, Checkpoint[]>();
  const orphans: Checkpoint[] = [];

  for (const cp of checkpoints) {
    if (cp.parentId !== null) {
      const list = childrenByParent.get(cp.parentId);
      if (list) {
        list.push(cp);
      } else {
        childrenByParent.set(cp.parentId, [cp]);
      }
    }
  }

  // 各親の子を position 順にソート
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  const result: Checkpoint[] = [];
  const visitedChildIds = new Set<string>();

  for (const parent of parents) {
    result.push(parent);
    const children = childrenByParent.get(parent.id) ?? [];
    for (const child of children) {
      result.push(child);
      visitedChildIds.add(child.id);
    }
  }

  // 万が一親が見つからない孤児レコードがある場合のフォールバック
  for (const cp of checkpoints) {
    if (cp.parentId !== null && !visitedChildIds.has(cp.id)) {
      orphans.push(cp);
    }
  }
  orphans.sort((a, b) => a.position - b.position);
  result.push(...orphans);

  return result;
}
