"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { HomeScreen } from "@/features/title/home-screen";
import { TaskList } from "@/features/task/task-list";
import { QuestChoices } from "@/features/quest/quest-choices";
import { PixelBottomNav, type NavTabId } from "@/components/ui/PixelBottomNav";
import { DebugActions } from "@/features/quest/debug-actions";
import {
  ApiError,
  CreateTaskResponse,
  StartQuestResponse,
  TasksResponse,
  QuestCandidatesResponse,
  StatsResponse,
  type Task,
  type CreateTaskRequest,
} from "@/lib/schemas";

type Tab = NavTabId;

async function requestJson<S extends z.ZodType>(
  url: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    throw new Error("通信に失敗しました。接続を確認して、もう一度お試しください。");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiError.safeParse(body);
    throw new Error(error.success ? error.data.error.message : "データを取得できませんでした。");
  }
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
  const [choiceError, setChoiceError] = useState("");
  const [choicePending, setChoicePending] = useState(true);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsError, setStatsError] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const choiceVersion = useRef(0);
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
    setChoicePending(true);
    setChoiceError("");
    try {
      const result = await requestJson("/api/quests/candidates", QuestCandidatesResponse, {
        signal,
        cache: "no-store",
      });
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
    setStatsError("");
    try {
      setStats(await requestJson("/api/stats", StatsResponse, { cache: "no-store" }));
    } catch (cause) {
      setStatsError(cause instanceof Error ? cause.message : "冒険の記録を取得できませんでした。");
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

  async function handleAddDummyTasks() {
    const dummyTitles = [
      "薬草を採取してポーションを作る",
      "ダンジョン地下1階を探索する",
      "鍛冶屋で剣を強化する",
    ];
    for (const title of dummyTitles) {
      await createTask({ title, dueAt: null });
    }
  }

  async function handleTriggerUrgentQuest() {
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await createTask({
      title: "【緊急】魔王軍の斥候を撃退せよ",
      dueAt: twoHoursLater,
    });
    switchTab("quest");
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
            inProgressQuestId={choices?.inProgressQuest?.id ?? null}
            onQuest={() => switchTab("quest")}
            onResumeQuest={handleResumeQuest}
          />
        )}
        <div className="mt-8">
          <DebugActions
            onAddDummyTasks={handleAddDummyTasks}
            onTriggerUrgentQuest={handleTriggerUrgentQuest}
          />
        </div>
      </main>
      <PixelBottomNav currentTab={tab} onSelectTab={switchTab} />
    </div>
  );
}
