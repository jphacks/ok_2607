import type { Checkpoint } from "@/lib/schemas";

/**
 * チェックポイントを 1 つずつ順番に進めるためのルール。
 *
 * - 対象は親チェックポイント（parentId が null）だけ。position 順に並べる
 * - 「今やること」は position 順で最初の未完了の 1 つ
 * - チェックできるのは「今やること」だけ
 * - 外せる（チェック解除）のは「今やること」の直前の完了済み（全部終わっていれば最後の 1 つ）だけ
 * - それ以外はロックする
 */
export type CheckpointStepState = "done" | "current" | "locked";

export interface CheckpointStep {
  checkpoint: Checkpoint;
  /** 表示上の状態 */
  state: CheckpointStepState;
  /** いまクリックしたときに isDone を切り替えてよいか */
  canToggle: boolean;
}

export interface CheckpointFocus {
  steps: CheckpointStep[];
  /** 今やるチェックポイント。全部終わっていれば null */
  current: Checkpoint | null;
  completedCount: number;
  totalCount: number;
  isAllCompleted: boolean;
}

/** 親チェックポイントを position 順に並べる */
export function sortParentCheckpoints(checkpoints: Checkpoint[]): Checkpoint[] {
  return checkpoints.filter((cp) => cp.parentId === null).sort((a, b) => a.position - b.position);
}

/** 親チェックポイントの並びから、今やるもの・チェック可能なもの・解除可能なものを決める */
export function computeCheckpointFocus(checkpoints: Checkpoint[]): CheckpointFocus {
  const parents = sortParentCheckpoints(checkpoints);
  const currentIndex = parents.findIndex((cp) => !cp.isDone);
  // 今やるものの直前（全部終わっていれば最後）が解除可能
  const undoableIndex = currentIndex === -1 ? parents.length - 1 : currentIndex - 1;

  const steps = parents.map((cp, index): CheckpointStep => {
    if (index === currentIndex) {
      return { checkpoint: cp, state: "current", canToggle: true };
    }
    // 今やるものより前は必ず完了済み
    if (currentIndex === -1 || index < currentIndex) {
      return { checkpoint: cp, state: "done", canToggle: index === undoableIndex };
    }
    // 今やるものより後ろは、データ上完了済みでもロック扱いにする
    return { checkpoint: cp, state: "locked", canToggle: false };
  });

  const completedCount = parents.filter((cp) => cp.isDone).length;
  const totalCount = parents.length;

  return {
    steps,
    current: currentIndex === -1 ? null : parents[currentIndex],
    completedCount,
    totalCount,
    isAllCompleted: totalCount > 0 && completedCount === totalCount,
  };
}

/** 今やるチェックポイントの子（具体的な行動）を position 順に返す */
export function childCheckpointsOf(checkpoints: Checkpoint[], parentId: string): Checkpoint[] {
  return checkpoints
    .filter((cp) => cp.parentId === parentId)
    .sort((a, b) => a.position - b.position);
}
