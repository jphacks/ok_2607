/**
 * API とドメインの共通コントラクト。
 * フロントエンドとバックエンドは必ずこのファイルの型を使う。
 * 変更するときは docs/api.md も同じ PR で更新すること。
 */
import { z } from "zod";

// ---- ドメイン ----

export const TaskStatus = z.enum(["active", "in_quest", "done", "discarded"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Task = z.object({
  id: z.uuid(),
  title: z.string(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  weight: z.number(),
  status: TaskStatus,
  shownCount: z.number().int(),
  skippedCount: z.number().int(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Task = z.infer<typeof Task>;

export const QuestStatus = z.enum(["in_progress", "completed", "abandoned"]);
export type QuestStatus = z.infer<typeof QuestStatus>;

export const Checkpoint = z.object({
  id: z.uuid(),
  questId: z.uuid(),
  parentId: z.uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  isDone: z.boolean(),
  doneAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Checkpoint = z.infer<typeof Checkpoint>;

export const Quest = z.object({
  id: z.uuid(),
  taskId: z.uuid(),
  status: QuestStatus,
  isUrgent: z.boolean(),
  xpEarned: z.number().int(),
  startedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Quest = z.infer<typeof Quest>;

// ---- リクエスト ----

export const CreateTaskRequest = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export type CreateTaskRequest = z.infer<typeof CreateTaskRequest>;

export const UpdateTaskRequest = z
  .object({
    title: z.string().trim().min(1).max(200),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    status: TaskStatus,
  })
  .partial();
export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequest>;

export const StartQuestRequest = z.object({
  selectedTaskId: z.uuid(),
  // 3択で提示されたタスク ID（選ばれなかったものの重みを下げるのに使う）
  shownTaskIds: z.array(z.uuid()).min(1).max(3),
});
export type StartQuestRequest = z.infer<typeof StartQuestRequest>;

export const UpdateCheckpointRequest = z.object({
  isDone: z.boolean(),
});
export type UpdateCheckpointRequest = z.infer<typeof UpdateCheckpointRequest>;

// ---- レスポンス ----

export const QuestCandidatesResponse = z.object({
  // true のとき candidates は締切が近い 1 件だけ（緊急クエスト）
  isUrgent: z.boolean(),
  candidates: z.array(Task).max(3),
});
export type QuestCandidatesResponse = z.infer<typeof QuestCandidatesResponse>;

export const QuestDetailResponse = z.object({
  quest: Quest,
  task: Task,
  checkpoints: z.array(Checkpoint),
});
export type QuestDetailResponse = z.infer<typeof QuestDetailResponse>;

export const StatsResponse = z.object({
  totalXp: z.number().int(),
  completedQuests: z.number().int(),
});
export type StatsResponse = z.infer<typeof StatsResponse>;

export const CompleteQuestResponse = z.object({
  quest: Quest,
  xpGained: z.number().int(),
  totalXp: z.number().int(),
});
export type CompleteQuestResponse = z.infer<typeof CompleteQuestResponse>;

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
