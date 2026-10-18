"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { HomeScreen } from "@/features/title/home-screen";
import { TaskList } from "@/features/task/task-list";
import { QuestChoices } from "@/features/quest/quest-choices";
import { recommendTasks } from "@/features/quest/recommend";
import {
  clearQuestCache,
  questCacheKey,
  readQuestCache,
  writeQuestCache,
} from "@/features/quest/cache";
import { OperationProgress } from "@/components/ui/OperationProgress";
import { PixelBottomNav, type NavTabId } from "@/components/ui/PixelBottomNav";
import { SoundToggle } from "@/components/ui/SoundToggle";
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
  RecordQuestCandidatesResponse,
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

function mergeCandidateTasks(tasks: Task[], candidates: Task[]): Task[] {
  const updates = new Map(candidates.map((task) => [task.id, task]));
  const merged = tasks.map((task) => {
    const update = updates.get(task.id);
    updates.delete(task.id);
    return update ?? task;
  });
  return [...merged, ...updates.values()];
}

export function QuestApp() {
  const router = useRouter();
  const [isNavigating, beginNavigation] = useTransition();
  const [navigation, setNavigation] = useState<"starting" | "routing" | "resume" | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("quest");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [taskPending, setTaskPending] = useState(true);
  const [taskError, setTaskError] = useState("");
  const [choices, setChoices] = useState<QuestCandidatesResponse | null>(null);
  // 候補の無効化とは別に管理し、無関係な編集中に届いた再開情報も保持する。
  const [inProgressQuest, setInProgressQuest] = useState<Quest | null>(null);
  const [choiceError, setChoiceError] = useState("");
  const [choicePending, setChoicePending] = useState(true);
  const [choiceOperation, setChoiceOperation] = useState<"read" | "record" | "start">("read");
  const [presentationId, setPresentationId] = useState(0);
  const [startReady, setStartReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsError, setStatsError] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const tasksRef = useRef<Task[] | null>(null);
  const tasksReadAt = useRef(0);
  const choicesRef = useRef<QuestCandidatesResponse | null>(null);
  const userIdRef = useRef<string | null>(null);
  const taskVersion = useRef(0);
  const choiceVersion = useRef(0);
  const inProgressVersion = useRef(0);
  const statsVersion = useRef(0);
  const needsChoices = useRef(false);
  const confirmed = useRef(false);
  const presentationPending = useRef(true);
  const recordInFlight = useRef(false);
  const mutationCount = useRef(0);
  const navigating = useRef(false);
  const cacheWriteAllowed = useRef(true);
  const hasActiveCache = useRef(false);

  const applyTasks = useCallback((next: Task[] | null) => {
    tasksRef.current = next;
    setTasks(next);
  }, []);

  const applyChoices = useCallback((next: QuestCandidatesResponse | null) => {
    choicesRef.current = next;
    setChoices(next);
  }, []);

  const confirmPresentation = useCallback((ready: boolean) => {
    confirmed.current = ready;
    setStartReady(ready);
  }, []);

  const markPresentationPending = useCallback((pending: boolean) => {
    presentationPending.current = pending;
    setChoicePending(pending);
  }, []);

  const clearCache = useCallback(() => {
    if (userIdRef.current) clearQuestCache(userIdRef.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { user: { id: string; email?: string } | null };
          if (active) setCurrentUser(data.user);
        }
      } catch {
        if (active) setCurrentUser(null);
      } finally {
        clearTimeout(timeoutId);
        if (active) setAuthLoading(false);
      }
    }
    void checkAuth();
    return () => {
      active = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const loadTasks = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++taskVersion.current;
      setTaskPending(true);
      setTaskError("");
      try {
        const result = await requestJson("/api/tasks", TasksResponse, {
          signal,
          cache: "no-store",
        });
        if (signal?.aborted || version !== taskVersion.current) return;
        tasksReadAt.current = Date.now();
        // 候補GET/POSTが先に完了した場合、一覧GETの古い提示回数で上書きしない。
        applyTasks(
          confirmed.current && choicesRef.current
            ? mergeCandidateTasks(result.tasks, choicesRef.current.candidates)
            : result.tasks,
        );
      } catch (cause) {
        if (!signal?.aborted && version === taskVersion.current)
          setTaskError(cause instanceof Error ? cause.message : "タスクを取得できませんでした。");
      } finally {
        if (!signal?.aborted && version === taskVersion.current) setTaskPending(false);
      }
    },
    [applyTasks],
  );

  const loadChoices = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++choiceVersion.current;
      const progressVersion = ++inProgressVersion.current;
      markPresentationPending(true);
      confirmPresentation(false);
      setChoiceOperation("read");
      setChoiceError("");
      try {
        const result = await requestJson("/api/quests/candidates", QuestCandidatesResponse, {
          signal,
          cache: "no-store",
        });
        if (signal?.aborted) return;
        if (progressVersion === inProgressVersion.current)
          setInProgressQuest(result.inProgressQuest);
        if (version !== choiceVersion.current) return;
        const hadChoices = choicesRef.current !== null;
        const previousQuestId = choicesRef.current?.inProgressQuest?.id;
        applyChoices(result);
        setPresentationId((previous) => previous + 1);
        if (tasksRef.current) applyTasks(mergeCandidateTasks(tasksRef.current, result.candidates));
        if (
          hadChoices &&
          previousQuestId !== result.inProgressQuest?.id &&
          (previousQuestId || result.inProgressQuest)
        ) {
          // 別画面で完了・開始されていた場合、キャッシュのタスク状態も確認し直す。
          void loadTasks(signal);
        }
        confirmPresentation(true);
        needsChoices.current = false;
      } catch (cause) {
        if (!signal?.aborted && version === choiceVersion.current) {
          clearCache();
          setChoiceError(
            cause instanceof Error ? cause.message : "冒険の候補を取得できませんでした。",
          );
        }
      } finally {
        if (!signal?.aborted && version === choiceVersion.current) markPresentationPending(false);
      }
    },
    [applyChoices, applyTasks, clearCache, confirmPresentation, loadTasks, markPresentationPending],
  );

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
    if (!currentUser) return;
    const userId = currentUser.id;
    userIdRef.current = userId;
    const controller = new AbortController();
    // 認証済みIDが確定するまで保存領域を参照しない。
    const cached = readQuestCache(userId);
    hasActiveCache.current = Boolean(cached);
    tasksReadAt.current = cached?.savedAt ?? 0;
    applyTasks(cached?.tasks ?? null);
    applyChoices(cached?.choices ?? null);
    setInProgressQuest(cached?.choices.inProgressQuest ?? null);
    setPresentationId((previous) => previous + 1);
    setTaskPending(!cached);
    if (!cached) void loadTasks(controller.signal);
    void loadChoices(controller.signal);

    function refreshFromOutside(event?: StorageEvent) {
      if (
        navigating.current ||
        mutationCount.current > 0 ||
        (event && event.key !== null && event.key !== questCacheKey(userId))
      )
        return;
      clearCache();
      // 他タブからの更新確認は再保存しない。保存イベントの往復を防ぐ。
      cacheWriteAllowed.current = !event;
      void loadTasks(controller.signal);
      void loadChoices(controller.signal);
      statsVersion.current += 1;
      setStats(null);
      setStatsError("");
    }
    const onFocus = () => refreshFromOutside();
    const onStorage = (event: StorageEvent) => refreshFromOutside(event);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      controller.abort();
      taskVersion.current += 1;
      choiceVersion.current += 1;
      inProgressVersion.current += 1;
      statsVersion.current += 1;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [currentUser, applyChoices, applyTasks, clearCache, loadChoices, loadTasks]);

  useEffect(() => {
    if (
      currentUser &&
      tasks &&
      choices &&
      startReady &&
      !choicePending &&
      !taskPending &&
      !taskError &&
      !mutationPending &&
      !navigation &&
      cacheWriteAllowed.current
    ) {
      writeQuestCache(currentUser.id, { tasks, choices }, tasksReadAt.current);
    }
  }, [
    currentUser,
    tasks,
    choices,
    startReady,
    choicePending,
    taskPending,
    taskError,
    mutationPending,
    navigation,
  ]);

  function refreshChoices() {
    if (navigating.current || mutationCount.current > 0 || recordInFlight.current) return;
    clearCache();
    cacheWriteAllowed.current = true;
    void loadTasks();
    void loadChoices();
  }

  async function rerollChoices() {
    if (
      !tasksRef.current ||
      presentationPending.current ||
      recordInFlight.current ||
      mutationCount.current > 0 ||
      navigating.current
    )
      return;
    const draw: QuestCandidatesResponse = {
      ...recommendTasks(tasksRef.current),
      inProgressQuest: null,
    };
    const version = ++choiceVersion.current;
    clearCache();
    cacheWriteAllowed.current = true;
    applyChoices(draw);
    setPresentationId((previous) => previous + 1);
    confirmPresentation(false);
    setChoiceError("");
    setChoiceOperation("record");
    if (draw.candidates.length === 0) {
      confirmPresentation(true);
      return;
    }
    recordInFlight.current = true;
    setRecording(true);
    markPresentationPending(true);
    try {
      const ids = draw.candidates.map((task) => task.id);
      const result = await requestJson("/api/quests/candidates", RecordQuestCandidatesResponse, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shownTaskIds: ids }),
      });
      if (version !== choiceVersion.current) return;
      if (
        result.tasks.length !== ids.length ||
        result.tasks.some((task, index) => task.id !== ids[index] || task.status !== "active")
      )
        throw new Error(
          "提示した候補の保存結果を確認できませんでした。もう一度読み込んでください。",
        );
      applyChoices({ ...draw, candidates: result.tasks });
      if (tasksRef.current) applyTasks(mergeCandidateTasks(tasksRef.current, result.tasks));
      confirmPresentation(true);
      needsChoices.current = false;
    } catch (cause) {
      if (version === choiceVersion.current) {
        clearCache();
        setChoiceError(
          cause instanceof Error ? cause.message : "提示した候補を保存できませんでした。",
        );
      }
    } finally {
      recordInFlight.current = false;
      setRecording(false);
      if (version === choiceVersion.current) markPresentationPending(false);
    }
  }

  function switchTab(next: Tab) {
    if (navigating.current) return;
    setTab(next);
    if (
      next === "quest" &&
      needsChoices.current &&
      !presentationPending.current &&
      mutationCount.current === 0
    ) {
      cacheWriteAllowed.current = true;
      void loadChoices();
    }
    if (next === "status") {
      void loadStats();
      if (!hasActiveCache.current) void loadTasks();
    }
    if (next === "tasks") {
      if (!hasActiveCache.current) void loadTasks();
    }
  }

  function beginTaskMutation() {
    mutationCount.current += 1;
    setMutationPending(true);
    taskVersion.current += 1;
    setTaskPending(false);
    choiceVersion.current += 1;
    markPresentationPending(false);
    confirmPresentation(false);
    needsChoices.current = true;
    cacheWriteAllowed.current = false;
    clearCache();
  }

  function finishTaskMutation() {
    mutationCount.current -= 1;
    setMutationPending(mutationCount.current > 0);
    // 変更中に開始した一覧取得も、変更前の内容を返す可能性がある。
    taskVersion.current += 1;
    setTaskPending(false);
    if (mutationCount.current === 0 && tasksReadAt.current === 0) void loadTasks();
  }

  function invalidateChoices() {
    choiceVersion.current += 1;
    needsChoices.current = true;
    applyChoices(null);
    markPresentationPending(false);
    confirmPresentation(false);
    setChoiceError("");
    clearCache();
  }

  async function createTask(input: CreateTaskRequest) {
    beginTaskMutation();
    try {
      const result = await requestJson("/api/tasks", CreateTaskResponse, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      applyTasks([result.task, ...(tasksRef.current ?? [])]);
      invalidateChoices();
    } finally {
      finishTaskMutation();
    }
    cacheWriteAllowed.current = true;
    void loadChoices();
  }

  async function updateTask(id: string, input: CreateTaskRequest) {
    beginTaskMutation();
    try {
      const result = await requestJson(`/api/tasks/${id}`, UpdateTaskResponse, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      applyTasks(tasksRef.current?.map((task) => (task.id === id ? result.task : task)) ?? null);
      invalidateChoices();
    } finally {
      finishTaskMutation();
    }
  }

  async function deleteTask(id: string) {
    beginTaskMutation();
    try {
      const response = await requestApi(`/api/tasks/${id}`, { method: "DELETE" });
      if (response.status !== 204) throw new Error("タスクの削除結果を確認できませんでした。");
      if (
        inProgressQuest?.taskId === id ||
        tasksRef.current?.some((task) => task.id === id && task.status === "in_quest")
      ) {
        inProgressVersion.current += 1;
      }
      applyTasks(tasksRef.current?.filter((task) => task.id !== id) ?? null);
      setInProgressQuest((previous) => (previous?.taskId === id ? null : previous));
      invalidateChoices();
      statsVersion.current += 1;
      setStats(null);
      setStatsError("");
    } finally {
      finishTaskMutation();
    }
  }

  async function startQuest(task: Task) {
    const presentation = choicesRef.current;
    if (
      !presentation ||
      !confirmed.current ||
      presentationPending.current ||
      recordInFlight.current ||
      mutationCount.current > 0 ||
      navigating.current ||
      !presentation.candidates.some((candidate) => candidate.id === task.id)
    )
      throw new Error("提示した候補を確認してから、もう一度お試しください。");
    const now = new Date();
    const current = recommendTasks(tasksRef.current ?? [], { now, random: () => 0 });
    if (
      current.isUrgent !== presentation.isUrgent ||
      (current.isUrgent && current.candidates[0]?.id !== presentation.candidates[0]?.id) ||
      presentation.candidates.some(
        (candidate) =>
          candidate.status !== "active" ||
          (candidate.dueAt !== null && Date.parse(candidate.dueAt) < now.getTime()),
      )
    ) {
      confirmPresentation(false);
      clearCache();
      setChoiceOperation("read");
      setChoiceError("候補の期限が変わりました。もう一度読み込んでから選んでください。");
      return;
    }
    navigating.current = true;
    setNavigation("starting");
    setChoiceOperation("start");
    needsChoices.current = true;
    cacheWriteAllowed.current = false;
    clearCache();
    taskVersion.current += 1;
    choiceVersion.current += 1;
    inProgressVersion.current += 1;
    confirmPresentation(false);
    try {
      const result = await requestJson("/api/quests", StartQuestResponse, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selectedTaskId: task.id,
          shownTaskIds: presentation.candidates.map((candidate) => candidate.id),
        }),
      });
      setInProgressQuest(result.quest);
      applyTasks(
        tasksRef.current?.map((item) =>
          item.id === task.id ? { ...item, status: "in_quest" } : item,
        ) ?? null,
      );
      applyChoices(null);
      needsChoices.current = true;
      statsVersion.current += 1;
      setStats(null);
      setNavigation("routing");
      // 遷移先がコミットしてこの画面が外れるまで、実際の画面遷移を待つ。
      beginNavigation(() => router.push(`/quests/${result.quest.id}/checkpoints`));
    } catch (cause) {
      navigating.current = false;
      setNavigation(null);
      setChoiceError(
        cause instanceof Error
          ? cause.message
          : "クエストを開始できませんでした。もう一度読み込んでください。",
      );
    }
  }

  function handleResumeQuest(questId: string) {
    if (presentationPending.current || mutationCount.current > 0 || navigating.current) return;
    navigating.current = true;
    cacheWriteAllowed.current = false;
    clearCache();
    taskVersion.current += 1;
    choiceVersion.current += 1;
    inProgressVersion.current += 1;
    setNavigation("resume");
    beginNavigation(() => router.push(`/quests/${questId}`));
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
        <OperationProgress
          title="冒険の書を読み込み中"
          steps={[
            { label: "ログイン状態を確認", status: "running" },
            { label: "タスク一覧を確認", status: "pending" },
            { label: "最新の候補を確認", status: "pending" },
          ]}
        />
      </div>
    );
  }

  // 未ログイン時はログイン専用画面を表示
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="rogue-shell relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-surface text-text shadow-2xl">
      <header className="flex h-[60px] shrink-0 items-center justify-between px-[22px] sm:px-8 lg:px-12">
        <span className="flex items-center gap-2 text-gold-accent">
          <span aria-hidden="true">✦</span>
          <span className="font-mono text-sm tracking-[-1px]">TriOne</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted">
            ●　{stats ? `${stats.completedQuests} CLEAR` : "冒険のはじまり"}
          </span>
          <SoundToggle />
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
        {tab === "quest" && (choicePending || taskPending || choiceError || taskError) && (
          <div className="mb-6">
            <OperationProgress
              title={
                choiceOperation === "record"
                  ? "候補の提示を保存"
                  : choiceOperation === "start"
                    ? "クエストを開始"
                    : "冒険の準備"
              }
              steps={
                choiceOperation === "record"
                  ? [
                      {
                        label: "表示した候補をサーバーに保存",
                        status: choiceError ? "error" : choicePending ? "running" : "complete",
                      },
                    ]
                  : choiceOperation === "start"
                    ? [
                        { label: "DBで候補を検証してクエストを開始", status: "error" },
                        { label: "チェックポイント画面へ移動", status: "pending" },
                      ]
                    : [
                        { label: "ログイン状態を確認", status: "complete" },
                        {
                          label: "タスク一覧を確認",
                          status: taskError
                            ? "error"
                            : taskPending
                              ? "running"
                              : tasks
                                ? "complete"
                                : "pending",
                        },
                        {
                          label: "最新の候補を確認",
                          status: choiceError
                            ? "error"
                            : choicePending
                              ? "running"
                              : startReady
                                ? "complete"
                                : "pending",
                        },
                      ]
              }
            />
          </div>
        )}
        {tab === "quest" && (
          <QuestChoices
            choices={choices}
            pending={choicePending || recording}
            error={choiceError || taskError}
            startReady={
              startReady && tasks !== null && !taskPending && !taskError && !mutationPending
            }
            rerollDisabled={tasks === null || taskPending || mutationPending || recording}
            presentationId={presentationId}
            onReroll={() => void rerollChoices()}
            onAddTask={addTask}
            onHome={() => switchTab("status")}
            onRetry={refreshChoices}
            onStart={startQuest}
            onResumeQuest={handleResumeQuest}
          />
        )}
        {tab === "tasks" &&
          (taskError ? (
            <div className="pixel-panel p-5">
              <h1 className="mb-4 text-xl">タスクリスト</h1>
              <p role="alert" className="text-sm leading-6 text-danger">
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
            <p role="status" className="text-sm text-muted">
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
      {(navigation || isNavigating) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="クエスト画面へ移動"
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface/95 p-6"
        >
          <div className="w-full max-w-xl">
            <OperationProgress
              title={navigation === "resume" ? "冒険を再開" : "クエストを開始"}
              steps={
                navigation === "resume"
                  ? [{ label: "クエスト画面へ移動", status: "running" }]
                  : [
                      {
                        label: "DBで候補を検証してクエストを開始",
                        status: navigation === "starting" ? "running" : "complete",
                      },
                      {
                        label: "チェックポイント画面へ移動",
                        status: navigation === "starting" ? "pending" : "running",
                      },
                    ]
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
