"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { HomeScreen } from "@/features/title/home-screen";
import { TaskList } from "@/features/task/task-list";
import { QuestChoices } from "@/features/quest/quest-choices";
import { PixelBottomNav, type NavTabId } from "@/components/ui/PixelBottomNav";
import { DebugActions } from "@/features/quest/debug-actions";
import { AuthStatus } from "@/features/auth/components/AuthStatus";
import { LoginScreen } from "@/features/auth/components/LoginScreen";
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
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("quest");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [taskError, setTaskError] = useState("");
  const [choices, setChoices] = useState<QuestCandidatesResponse | null>(null);
  // 候補を無効化しても、既存クエストの再開情報は保持する。
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

  // 認証状態の確認
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { user: { id: string; email?: string } | null };
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        clearTimeout(timeoutId);
        setAuthLoading(false);
      }
    }
    void checkAuth();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

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

  // ログイン済みの場合のみタスク・候補を取得
  useEffect(() => {
    if (!currentUser) return;
    const controller = new AbortController();
    void loadTasks(controller.signal);
    void loadChoices(controller.signal);
    return () => controller.abort();
  }, [currentUser, loadTasks, loadChoices]);

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

  async function handleAddDummyTasks() {
    const dummyTasks = [
      { title: "会議の議事録をまとめる", skippedCount: 0 },
      { title: "来週のプレゼン資料を作成する", skippedCount: 1 },
      { title: "数学の課題を提出する", skippedCount: 2 },
      { title: "英単語を20個復習する", skippedCount: 3 },
      { title: "食料品を買いに行く", skippedCount: 5 },
      { title: "部屋の掃除をする", skippedCount: 10 },
    ];
    for (const task of dummyTasks) {
      await createTask({ ...task, dueAt: null });
    }
  }

  async function handleTriggerUrgentQuest() {
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await createTask({
      title: "【緊急】大学のレポートを提出する",
      dueAt: twoHoursLater,
    });
    switchTab("quest");
  }

  // 認証チェック中はローディング
  if (authLoading) {
    return (
      <div className="rogue-shell relative mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center bg-surface text-muted">
        <p className="font-mono text-xs">冒険の書を読み込み中…</p>
      </div>
    );
  }

  // 未ログイン時はログイン専用画面を表示
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="rogue-shell relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-[#111321] text-[#ededf4] shadow-2xl">
      <header className="flex h-[60px] shrink-0 items-center justify-between px-[22px] sm:px-8 lg:px-12">
        <span className="flex items-center gap-2 text-[#f3ca70]">
          <span aria-hidden="true">✦</span>
          <span className="font-mono text-sm tracking-[-1px]">TriOne</span>
        </span>
        <span className="font-mono text-[10px] text-[#a4a8bc]">
          ●　{stats ? `${stats.completedQuests} CLEAR` : "冒険のはじまり"}
        </span>
      </header>
      <AuthStatus />
      <div className="pixel-divider shrink-0" aria-hidden="true" />
      <main
        id="main-content"
        className={`flex-1 px-[22px] pt-6 sm:px-8 sm:pt-8 lg:px-12 lg:pt-10 ${
          // 3択はスクロールなしで収めたいので、ボトムナビの分だけ余白を取る
          tab === "quest" ? "pb-24" : "pb-32"
        }`}
        tabIndex={-1}
      >
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
        {tab !== "quest" && (
          <div className="mt-8">
            <DebugActions
              onAddDummyTasks={handleAddDummyTasks}
              onTriggerUrgentQuest={handleTriggerUrgentQuest}
            />
          </div>
        )}
      </main>
      <PixelBottomNav currentTab={tab} onSelectTab={switchTab} />
    </div>
  );
}
