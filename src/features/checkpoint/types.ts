import type { Checkpoint } from "@/lib/schemas";

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
