"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { HomeScreen } from "@/features/title/home-screen";
import { TaskList } from "@/features/task/task-list";
import { QuestChoices } from "@/features/quest/quest-choices";
import { PixelBottomNav, type NavTabId } from "@/components/ui/PixelBottomNav";
import {
  ApiError,
  CreateTaskResponse,
  UpdateTaskResponse,
  StartQuestResponse,
  TasksResponse,
  QuestCandidatesResponse,
  StatsResponse,
  type Task,
  type Quest,
  type CreateTaskRequest,
} from "@/lib/schemas";

type Tab = NavTabId;

async function requestApi(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    throw new Error("通信に失敗しました。接続を確認して、もう一度お試しください。");
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = ApiError.safeParse(body);
    throw new Error(error.success ? error.data.error.message : "データを取得できませんでした。");
  }
  return response;
}

async function requestJson<S extends z.ZodType>(
  url: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const response = await requestApi(url, init);
  const body: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("サーバーからの応答を読み取れませんでした。");
  return parsed.data;
}

export function QuestApp() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("quest");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [taskError, setTaskError] = useState("");
  const [choices, setChoices] = useState<QuestCandidatesResponse | null>(null);
  // 候補の再抽選・無効化では、既存クエストの再開情報を失わない。
  const [inProgressQuest, setInProgressQuest] = useState<Quest | null>(null);
  const [choiceError, setChoiceError] = useState("");
  const [choicePending, setChoicePending] = useState(true);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsError, setStatsError] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const choiceVersion = useRef(0);
  const inProgressVersion = useRef(0);
  const statsVersion = useRef(0);
  const needsChoices = useRef(false);

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    setTaskError("");
    try {
      const result = await requestJson("/api/tasks", TasksResponse, { signal, cache: "no-store" });
      setTasks(result.tasks);
    } catch (cause) {
      if (!signal?.aborted)
        setTaskError(cause instanceof Error ? cause.message : "タスクを取得できませんでした。");
    }
  }, []);

  const loadChoices = useCallback(async (signal?: AbortSignal) => {
    const version = ++choiceVersion.current;
    const progressVersion = ++inProgressVersion.current;
    setChoicePending(true);
    setChoiceError("");
    try {
      const result = await requestJson("/api/quests/candidates", QuestCandidatesResponse, {
        signal,
        cache: "no-store",
      });
      // 候補を無効化しても、未取得の再開情報は最新の進行状態として反映する。
      if (progressVersion === inProgressVersion.current) {
        setInProgressQuest(result.inProgressQuest);
      }
      if (version === choiceVersion.current) {
        setChoices(result);
        needsChoices.current = false;
      }
    } catch (cause) {
      if (!signal?.aborted && version === choiceVersion.current)
        setChoiceError(
          cause instanceof Error ? cause.message : "冒険の候補を取得できませんでした。",
        );
    } finally {
      if (!signal?.aborted && version === choiceVersion.current) setChoicePending(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    const version = ++statsVersion.current;
    setStatsError("");
    try {
      const result = await requestJson("/api/stats", StatsResponse, { cache: "no-store" });
      if (version === statsVersion.current) setStats(result);
    } catch (cause) {
      if (version === statsVersion.current)
        setStatsError(
          cause instanceof Error ? cause.message : "冒険の記録を取得できませんでした。",
        );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadTasks(controller.signal);
    void loadChoices(controller.signal);
    return () => controller.abort();
  }, [loadTasks, loadChoices]);

  function switchTab(next: Tab) {
    setTab(next);
    if (next === "quest" && needsChoices.current) void loadChoices();
    if (next === "status" && !stats) void loadStats();
  }

  async function createTask(input: CreateTaskRequest) {
    const result = await requestJson("/api/tasks", CreateTaskResponse, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    setTasks((previous) => [result.task, ...(previous ?? [])]);
    needsChoices.current = true;
    void loadChoices();
  }

  function invalidateChoices() {
    choiceVersion.current += 1;
    needsChoices.current = true;
    setChoices(null);
    setChoicePending(false);
    setChoiceError("");
  }

  async function updateTask(id: string, input: CreateTaskRequest) {
    const result = await requestJson(`/api/tasks/${id}`, UpdateTaskResponse, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    setTasks((previous) => previous?.map((task) => (task.id === id ? result.task : task)) ?? null);
    invalidateChoices();
  }

  async function deleteTask(id: string) {
    const response = await requestApi(`/api/tasks/${id}`, { method: "DELETE" });
    if (response.status !== 204) throw new Error("タスクの削除結果を確認できませんでした。");
    // 初回の候補取得前でも、進行中タスクの削除前に始まった応答は破棄する。
    if (
      inProgressQuest?.taskId === id ||
      tasks?.some((task) => task.id === id && task.status === "in_quest")
    ) {
      inProgressVersion.current += 1;
    }
    setTasks((previous) => previous?.filter((task) => task.id !== id) ?? null);
    setInProgressQuest((previous) => (previous?.taskId === id ? null : previous));
    invalidateChoices();
    statsVersion.current += 1;
    setStats(null);
    setStatsError("");
  }

  async function startQuest(task: Task) {
    if (!choices) return;
    const result = await requestJson("/api/quests", StartQuestResponse, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedTaskId: task.id,
        shownTaskIds: choices.candidates.map((candidate) => candidate.id),
      }),
    });
    inProgressVersion.current += 1;
    setInProgressQuest(result.quest);
    setTasks(
      (previous) =>
        previous?.map((item) => (item.id === task.id ? { ...item, status: "in_quest" } : item)) ??
        null,
    );
    setChoices(null);
    needsChoices.current = true;
    void loadTasks();
    void loadStats();

    // クエスト開始後、AI チェックポイント生成画面（04）へ直接遷移
    router.push(`/quests/${result.quest.id}/checkpoints`);
  }

  function handleResumeQuest(questId: string) {
    router.push(`/quests/${questId}`);
  }

  function addTask() {
    setOpenForm(true);
    setTab("tasks");
  }

  return (
    <div className="rogue-shell relative mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-[#111321] text-[#ededf4] shadow-2xl">
      <header className="flex h-[60px] shrink-0 items-center justify-between px-[22px]">
        <span className="flex items-center gap-2 text-[#f3ca70]">
          <span aria-hidden="true">✦</span>
          <span className="font-mono text-sm tracking-[-1px]">TriOne</span>
        </span>
        <span className="font-mono text-[10px] text-[#a4a8bc]">
          ●　{stats ? `${stats.completedQuests} CLEAR` : "冒険のはじまり"}
        </span>
      </header>
      <div className="pixel-divider shrink-0" aria-hidden="true" />
      <main id="main-content" className="flex-1 px-[22px] pb-32 pt-6" tabIndex={-1}>
        {tab === "quest" && (
          <QuestChoices
            choices={choices}
            pending={choicePending}
            error={choiceError}
            onAddTask={addTask}
            onHome={() => switchTab("status")}
            onRetry={() => void loadChoices()}
            onStart={startQuest}
            onResumeQuest={handleResumeQuest}
          />
        )}
        {tab === "tasks" &&
          (taskError ? (
            <div className="pixel-panel p-5">
              <h1 className="mb-4 text-xl">タスクリスト</h1>
              <p role="alert" className="text-sm leading-6 text-[#ffb5a9]">
                {taskError}
              </p>
              <button className="secondary-button mt-4 w-full" onClick={() => void loadTasks()}>
                もう一度読み込む
              </button>
            </div>
          ) : tasks ? (
            <TaskList
              tasks={tasks}
              openForm={openForm}
              onFormChange={setOpenForm}
              onCreate={createTask}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          ) : (
            <p role="status" className="text-sm text-[#a4a8bc]">
              タスクを読み込んでいます…
            </p>
          ))}
        {tab === "status" && (
          <HomeScreen
            tasks={tasks ?? []}
            stats={stats}
            error={statsError || taskError}
            inProgressQuestId={inProgressQuest?.id ?? null}
            onQuest={() => switchTab("quest")}
            onResumeQuest={handleResumeQuest}
          />
        )}
      </main>
      <PixelBottomNav currentTab={tab} onSelectTab={switchTab} />
    </div>
  );
}
