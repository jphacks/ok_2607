import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestApp } from "@/features/quest/quest-app";
import {
  QUEST_CACHE_TTL_MS,
  questCacheKey,
  readQuestCache,
  writeQuestCache,
} from "@/features/quest/cache";
import type { Quest, Task } from "@/lib/schemas";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const existing: Task = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "以前のタスク",
  dueAt: null,
  status: "active",
  shownCount: 0,
  skippedCount: 0,
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
};
let storedTasks: Task[];
let rejectCreation: boolean;
let inProgressQuest: Quest | null;
let rejectDeletion: boolean;
let pendingCandidateResponse: Promise<Response> | null;
let pendingStatsResponse: Promise<Response> | null;
let pendingTaskResponse: Promise<Response> | null;
let pendingPresentationResponse: Promise<Response> | null;
let pendingStartResponse: Promise<Response> | null;
let pendingAuthResponse: Promise<Response> | null;
let rejectPresentation: boolean;

beforeEach(() => {
  mockPush.mockClear();
  window.localStorage.clear();
  storedTasks = [];
  rejectCreation = false;
  inProgressQuest = null;
  rejectDeletion = false;
  pendingCandidateResponse = null;
  pendingStatsResponse = null;
  pendingTaskResponse = null;
  pendingPresentationResponse = null;
  pendingStartResponse = null;
  pendingAuthResponse = null;
  rejectPresentation = false;
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  // jsdom に未実装のネイティブダイアログAPIだけを補う。
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/tasks" && init?.method === "POST") {
        if (rejectCreation)
          return Response.json(
            { error: { code: "internal_error", message: "保存できませんでした" } },
            { status: 500 },
          );
        const input: { title: string; dueAt: string | null; skippedCount?: number } = JSON.parse(
          String(init.body),
        );
        const task = {
          ...existing,
          ...input,
          id: `10000000-0000-4000-8000-${String(storedTasks.length + 2).padStart(12, "0")}`,
        };
        storedTasks = [task, ...storedTasks];
        return Response.json({ task }, { status: 201 });
      }
      if (url.startsWith("/api/tasks/") && init?.method === "PATCH") {
        const id = url.split("/").at(-1);
        const input: { title: string; dueAt: string | null } = JSON.parse(String(init.body));
        storedTasks = storedTasks.map((task) => (task.id === id ? { ...task, ...input } : task));
        return Response.json({ task: storedTasks.find((task) => task.id === id) });
      }
      if (url.startsWith("/api/tasks/") && init?.method === "DELETE") {
        if (rejectDeletion)
          return Response.json(
            { error: { code: "internal_error", message: "削除できませんでした" } },
            { status: 500 },
          );
        const id = url.split("/").at(-1);
        storedTasks = storedTasks.filter((task) => task.id !== id);
        return new Response(null, { status: 204 });
      }
      if (url === "/api/auth/me") {
        if (pendingAuthResponse) return pendingAuthResponse;
        return Response.json({
          user: { id: "test-user-id", email: "hero@example.com", name: "勇者" },
        });
      }
      if (url === "/api/tasks") return pendingTaskResponse ?? Response.json({ tasks: storedTasks });
      if (url === "/api/quests/candidates" && init?.method === "POST") {
        if (pendingPresentationResponse) return pendingPresentationResponse;
        if (rejectPresentation)
          return Response.json(
            { error: { code: "internal_error", message: "候補を保存できませんでした" } },
            { status: 500 },
          );
        const input: { shownTaskIds: string[] } = JSON.parse(String(init.body));
        storedTasks = storedTasks.map((task) =>
          input.shownTaskIds.includes(task.id)
            ? { ...task, shownCount: task.shownCount + 1 }
            : task,
        );
        return Response.json({
          tasks: input.shownTaskIds.map((id) => storedTasks.find((task) => task.id === id)),
        });
      }
      if (url === "/api/quests/candidates") {
        if (pendingCandidateResponse) return pendingCandidateResponse;
        const urgent = storedTasks.find((t) => Boolean(t.dueAt));
        return Response.json({
          isUrgent: Boolean(urgent),
          candidates: inProgressQuest ? [] : urgent ? [urgent] : storedTasks.slice(0, 3),
          inProgressQuest,
        });
      }
      if (url === "/api/quests" && init?.method === "POST") {
        if (pendingStartResponse) return pendingStartResponse;
        const body = JSON.parse(String(init.body));
        const newQuest: Quest = {
          id: "10000000-0000-4000-8000-000000000099",
          taskId: body.selectedTaskId,
          status: "in_progress",
          isUrgent: false,
          xpEarned: 0,
          startedAt: "2026-10-17T00:00:00Z",
          completedAt: null,
        };
        inProgressQuest = newQuest;
        return Response.json({ quest: newQuest }, { status: 201 });
      }

      if (url === "/api/stats")
        return pendingStatsResponse ?? Response.json({ totalXp: 0, completedQuests: 0 });
      throw new Error(`想定外のリクエスト: ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("タスク登録と3択の画面遷移", () => {
  it("編集・期限解除を候補に反映し、削除失敗ではタスクを保持して再試行できる", async () => {
    storedTasks = [{ ...existing, dueAt: "2026-11-01T09:15:00Z" }];
    render(<QuestApp />);
    await screen.findByRole("radio");
    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    fireEvent.click(screen.getByLabelText(`${existing.title}のメニュー`));
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    fireEvent.change(screen.getByRole("textbox", { name: /タスク名/ }), {
      target: { value: "編集したタスク" },
    });
    fireEvent.change(screen.getByLabelText(/期限/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("listitem")).toHaveTextContent("編集したタスク");
    expect(screen.getByRole("listitem")).toHaveTextContent("期限なし");
    fireEvent.click(screen.getByRole("button", { name: "クエスト" }));
    expect(await screen.findByRole("radio", { name: /編集したタスク/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    fireEvent.click(screen.getByLabelText("編集したタスクのメニュー"));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    rejectDeletion = true;
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("listitem")).toHaveTextContent("編集したタスク");
    rejectDeletion = false;
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "クエスト" }));
    expect(await screen.findByRole("button", { name: "＋ 新しいタスクを追加" })).toBeVisible();
  });

  it.each(["再取得前", "再取得後", "古い取得の失敗"] as const)(
    "完了タスク削除後は削除前の集計応答を反映しない（%s）",
    async (timing) => {
      storedTasks = [{ ...existing, status: "done" }];
      const stale = Promise.withResolvers<Response>();
      pendingStatsResponse = stale.promise;
      render(<QuestApp />);
      await screen.findByRole("radio");
      fireEvent.click(screen.getByRole("button", { name: "ステータス" }));
      await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/stats", { cache: "no-store" }));
      fireEvent.click(screen.getByRole("button", { name: "タスク" }));
      fireEvent.click(screen.getByLabelText(`${existing.title}のメニュー`));
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "削除する" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      pendingStatsResponse = null;
      const deliverStale = async () => {
        await act(async () => {
          stale.resolve(
            timing === "古い取得の失敗"
              ? Response.json(
                  { error: { code: "internal_error", message: "削除前の集計エラー" } },
                  { status: 500 },
                )
              : Response.json({ totalXp: 100, completedQuests: 1 }),
          );
        });
      };
      if (timing === "再取得前") await deliverStale();
      fireEvent.click(screen.getByRole("button", { name: "ステータス" }));
      expect(await screen.findByText(/EXP\s+0$/)).toBeVisible();
      if (timing !== "再取得前") await deliverStale();
      expect(screen.getByText(/EXP\s+0$/)).toBeVisible();
      expect(screen.getByText(/クリアしたクエスト\s+0 件/)).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it.each([
    { operation: "編集", delayed: false },
    { operation: "別タスク削除", delayed: false },
    { operation: "編集", delayed: true },
    { operation: "別タスク削除", delayed: true },
  ])(
    "$operation（初回取得遅延: $delayed）後もステータスから進行中クエストを直接再開できる",
    async ({ operation, delayed }) => {
      storedTasks = [
        { ...existing, status: "in_quest" },
        { ...existing, id: "10000000-0000-4000-8000-000000000002", title: "別のタスク" },
      ];
      inProgressQuest = {
        id: "10000000-0000-4000-8000-000000000003",
        taskId: existing.id,
        status: "in_progress",
        isUrgent: false,
        xpEarned: 0,
        startedAt: existing.createdAt,
        completedAt: null,
      };
      const responseGate = delayed ? Promise.withResolvers<Response>() : null;
      if (responseGate) pendingCandidateResponse = responseGate.promise;
      render(<QuestApp />);
      await screen.findByRole("navigation");
      if (!delayed) await screen.findByRole("button", { name: "ステータスで確認する" });
      fireEvent.click(screen.getByRole("button", { name: "タスク" }));
      await screen.findByText(existing.title);
      const targetTitle = operation === "編集" ? existing.title : "別のタスク";
      fireEvent.click(screen.getByLabelText(`${targetTitle}のメニュー`));
      const row = screen.getByText(targetTitle).closest("li");
      if (!row) throw new Error("対象のタスクセルが見つかりません");
      if (operation === "編集") {
        fireEvent.click(within(row).getByRole("button", { name: "編集" }));
        fireEvent.change(screen.getByRole("textbox", { name: /タスク名/ }), {
          target: { value: "挑戦中タスクの編集" },
        });
        fireEvent.click(screen.getByRole("button", { name: "保存する" }));
      } else {
        fireEvent.click(within(row).getByRole("button", { name: "削除" }));
        fireEvent.click(screen.getByRole("button", { name: "削除する" }));
      }
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "ステータス" }));
      if (responseGate) {
        pendingCandidateResponse = null;
        await act(async () => {
          responseGate.resolve(Response.json({ isUrgent: false, candidates: [], inProgressQuest }));
        });
      }
      fireEvent.click(await screen.findByRole("button", { name: "進行中のクエストを再開する" }));
      expect(mockPush).toHaveBeenCalledWith("/quests/10000000-0000-4000-8000-000000000003");
    },
  );

  it("進行中は開始・再抽選を表示せずステータスで現在のタスクを確認できる", async () => {
    storedTasks = [{ ...existing, status: "in_quest" }];
    inProgressQuest = {
      id: "10000000-0000-4000-8000-000000000003",
      taskId: existing.id,
      status: "in_progress",
      isUrgent: false,
      xpEarned: 0,
      startedAt: existing.createdAt,
      completedAt: null,
    };
    render(<QuestApp />);

    fireEvent.click(await screen.findByRole("button", { name: "ステータスで確認する" }));

    expect(screen.getByRole("button", { name: "ステータス" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText(existing.title)).toBeVisible();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "メインメニュー" })).getByRole("button", {
        name: /クエスト/,
      }),
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "このクエストに挑戦する" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /再抽選する/ })).not.toBeInTheDocument();
  });

  it("ヘッダーに効果音の切り替えボタンがある", async () => {
    render(<QuestApp />);
    expect(await screen.findByRole("button", { name: "効果音" })).toBeInTheDocument();
  });

  it("初回はクエストを表示し、空の状態からタスク名・期限だけの作成画面に進める", async () => {
    render(<QuestApp />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("クエストを選べ");
    fireEvent.click(await screen.findByRole("button", { name: "＋ 新しいタスクを追加" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("textbox", { name: /タスク名/ })).toBeVisible();
    expect(within(dialog).getByLabelText(/期限/)).toHaveAttribute("type", "date");
    expect(dialog.querySelectorAll("input")).toHaveLength(2);
  });

  it("新規タスクを既存タスクの先頭に挿入し、クエストタブで候補を直接表示する", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    await screen.findByRole("radio");
    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    fireEvent.click(screen.getByRole("button", { name: "新しいタスクを追加" }));
    fireEvent.change(screen.getByRole("textbox", { name: /タスク名/ }), {
      target: { value: "新しいクエスト" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const rows = within(screen.getByRole("list", { name: "登録済みタスク" })).getAllByRole(
      "listitem",
    );
    expect(rows[0]).toHaveTextContent("新しいクエスト");
    expect(rows[1]).toHaveTextContent("以前のタスク");
    fireEvent.click(screen.getByRole("button", { name: /^クエスト/ }));
    expect(await screen.findByRole("radio", { name: /新しいクエスト/ })).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("保存失敗時は入力を失わず、再送が成功するまで作成画面を閉じない", async () => {
    rejectCreation = true;
    render(<QuestApp />);
    fireEvent.click(await screen.findByRole("button", { name: "＋ 新しいタスクを追加" }));
    fireEvent.change(screen.getByRole("textbox", { name: /タスク名/ }), {
      target: { value: "消してはいけない下書き" },
    });
    fireEvent.change(screen.getByLabelText(/期限/), { target: { value: "2026-11-01" } });
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: /タスク名/ })).toHaveValue("消してはいけない下書き");
    expect(screen.getByLabelText(/期限/)).toHaveValue("2026-11-01");
    expect(screen.getByRole("dialog")).toBeVisible();
    rejectCreation = false;
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("listitem")).toHaveTextContent("消してはいけない下書き");
    expect(screen.getByRole("listitem")).toHaveTextContent("期限 11/1");
  });

  it("クエストを開始すると画面04(/quests/[id]/checkpoints)へ画面遷移する", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    const radio = await screen.findByRole("radio", { name: new RegExp(existing.title) });
    await waitFor(() => expect(radio).toBeEnabled());
    fireEvent.click(radio);
    const startButton = screen.getByRole("button", { name: "このクエストに挑戦する" });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/quests/10000000-0000-4000-8000-000000000099/checkpoints",
      );
    });
  });

  it("クエスト開始時に /api/tasks や /api/stats への不要なリクエストを行わずに速やかに遷移する", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    const radio = await screen.findByRole("radio", { name: new RegExp(existing.title) });
    await waitFor(() => expect(radio).toBeEnabled());
    fireEvent.click(radio);
    const startButton = screen.getByRole("button", { name: "このクエストに挑戦する" });
    await waitFor(() => expect(startButton).toBeEnabled());

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockClear();

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/quests/10000000-0000-4000-8000-000000000099/checkpoints",
      );
    });

    const calledUrls = fetchMock.mock.calls.map(([url]) => url);
    expect(calledUrls).toContain("/api/quests");
    expect(calledUrls).not.toContain("/api/tasks");
    expect(calledUrls).not.toContain("/api/stats");
  });

  it("ステータスやタスクタブを開いた際に最新の統計・タスク一覧を再取得する", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    await screen.findByRole("radio");

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockClear();

    // ステータスタブを開くと、最新の統計(/api/stats)とタスク(/api/tasks)が再取得される
    fireEvent.click(screen.getByRole("button", { name: "ステータス" }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => url);
      expect(calls).toContain("/api/stats");
      expect(calls).toContain("/api/tasks");
    });

    fetchMock.mockClear();

    // タスクタブを開くと、最新のタスク(/api/tasks)が再取得される
    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => url);
      expect(calls).toContain("/api/tasks");
    });
  });

  it("進行中クエストがあるとき「進行中のクエスト画面を開く」ボタンで画面05へ遷移する", async () => {
    storedTasks = [{ ...existing, status: "in_quest" }];
    inProgressQuest = {
      id: "10000000-0000-4000-8000-000000000003",
      taskId: existing.id,
      status: "in_progress",
      isUrgent: false,
      xpEarned: 0,
      startedAt: existing.createdAt,
      completedAt: null,
    };
    render(<QuestApp />);

    const resumeBtn = await screen.findByRole("button", { name: "進行中のクエスト画面を開く" });
    fireEvent.click(resumeBtn);

    expect(mockPush).toHaveBeenCalledWith("/quests/10000000-0000-4000-8000-000000000003");
  });

  it("ステータス画面で進行中のクエストがある場合、再開ボタンで画面05へ遷移する", async () => {
    storedTasks = [{ ...existing, status: "in_quest" }];
    inProgressQuest = {
      id: "10000000-0000-4000-8000-000000000003",
      taskId: existing.id,
      status: "in_progress",
      isUrgent: false,
      xpEarned: 0,
      startedAt: existing.createdAt,
      completedAt: null,
    };
    render(<QuestApp />);

    fireEvent.click(await screen.findByRole("button", { name: "ステータスで確認する" }));
    const homeResumeBtn = await screen.findByRole("button", {
      name: "進行中のクエストを再開する",
    });
    fireEvent.click(homeResumeBtn);

    expect(mockPush).toHaveBeenCalledWith("/quests/10000000-0000-4000-8000-000000000003");
  });

  it("3タブ（タスク / クエスト / ステータス）が表示され、中央のクエストが強調される", async () => {
    render(<QuestApp />);

    const nav = await screen.findByRole("navigation", { name: "メインメニュー" });
    expect(nav).toBeInTheDocument();

    const buttons = within(nav).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent("タスク");
    expect(buttons[1]).toHaveTextContent("クエスト");
    expect(buttons[1]).not.toHaveTextContent("クエストを開始");
    expect(buttons[1]).not.toHaveTextContent("冒険を開始する");
    expect(buttons[2]).toHaveTextContent("ステータス");

    // 初期表示はクエストタブがアクティブ
    expect(buttons[1]).toHaveAttribute("aria-current", "page");
  });

  it("クエスト画面ではデバッグメニューが表示されない", async () => {
    render(<QuestApp />);
    await screen.findByRole("navigation", { name: "メインメニュー" });
    expect(screen.queryByText("🛠 デバッグ操作")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ダミータスクを追加" })).not.toBeInTheDocument();
  });

  it("ダミータスク6件を異なるreject回数・期限なしで追加し、既存タスクを保持する", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    fireEvent.click(await screen.findByRole("button", { name: /^タスク/ }));

    expect(screen.getByText("🛠 デバッグ操作")).toBeInTheDocument();
    const dummyBtn = screen.getByRole("button", { name: "ダミータスクを追加" });
    fireEvent.click(dummyBtn);

    await waitFor(() => {
      expect(screen.getByText("ダミータスクを追加しました")).toBeInTheDocument();
    });
    expect(storedTasks).toHaveLength(7);
    expect(storedTasks).toContainEqual(existing);
    const addedTasks = storedTasks.filter((task) => task.id !== existing.id);
    expect(addedTasks.every((task) => task.dueAt === null)).toBe(true);
    expect(addedTasks.map((task) => task.skippedCount).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 5, 10,
    ]);
    for (const category of [/会議|プレゼン/, /課題|英単語/, /買い|掃除/]) {
      expect(addedTasks.filter((task) => category.test(task.title))).toHaveLength(2);
    }
    for (const task of storedTasks) {
      expect(screen.getByText(task.title)).toBeInTheDocument();
    }
  });

  it("タスク画面から緊急クエスト発動を実行するとクエスト画面に切り替わり緊急クエストが表示される", async () => {
    render(<QuestApp />);
    fireEvent.click(await screen.findByRole("button", { name: /^タスク/ }));

    const urgentBtn = screen.getByRole("button", { name: "緊急クエストを発動" });
    fireEvent.click(urgentBtn);

    const urgentCandidate = await screen.findByRole("radio", { name: /緊急クエスト/ });
    await waitFor(() => expect(urgentCandidate).toBeEnabled());
    const nav = screen.getByRole("navigation", { name: "メインメニュー" });
    expect(within(nav).getByRole("button", { name: /クエスト/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const startButton = screen.getByRole("button", { name: "このクエストに挑戦する" });
    expect(startButton).toBeDisabled();
    fireEvent.click(urgentCandidate);
    expect(urgentCandidate).toBeChecked();
    expect(startButton).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "緊急クエストを発動", hidden: true }),
    ).not.toBeInTheDocument();
  });

  it("未ログイン時はタスクを表示せず、ログイン専用画面を表示する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/auth/me") {
          return Response.json({ user: null });
        }
        return Response.json({});
      }),
    );

    render(<QuestApp />);

    expect(
      await screen.findByRole("button", { name: "Google アカウントでクエストを始める" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "メインメニュー" })).not.toBeInTheDocument();
  });
});

function candidateRequests(method = "GET") {
  return vi
    .mocked(fetch)
    .mock.calls.filter(
      ([url, init]) => url === "/api/quests/candidates" && (init?.method ?? "GET") === method,
    );
}

describe("ローカル抽選と確認済みキャッシュ", () => {
  it("再抽選はGETを増やさず即座に新しいカードを表示し、提示保存中も選択できる", async () => {
    storedTasks = Array.from({ length: 4 }, (_, index) => ({
      ...existing,
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      title: `冒険${index + 1}`,
    }));
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    render(<QuestApp />);
    await screen.findByRole("radio", { name: /冒険1/ });
    await waitFor(() => expect(screen.getByRole("button", { name: /再抽選する/ })).toBeEnabled());
    await waitFor(() => expect(readQuestCache("test-user-id")).not.toBeNull());
    const getsBefore = candidateRequests().length;
    const save = Promise.withResolvers<Response>();
    pendingPresentationResponse = save.promise;
    pendingCandidateResponse = Promise.withResolvers<Response>().promise;

    fireEvent.click(screen.getByRole("button", { name: /再抽選する/ }));

    const newlyDrawn = screen.getByRole("radio", { name: /冒険4/ });
    expect(newlyDrawn).toBeEnabled();
    fireEvent.click(newlyDrawn);
    expect(newlyDrawn).toBeChecked();
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "候補を再抽選する" })).toBeDisabled();
    expect(candidateRequests()).toHaveLength(getsBefore);
    expect(candidateRequests("POST")).toHaveLength(1);
    expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
    const progress = screen.getByRole("region", { name: "候補の提示を保存" });
    expect(within(progress).getByText("完了した処理: 0 / 1 件")).toBeVisible();
    const input: { shownTaskIds: string[] } = JSON.parse(
      String(candidateRequests("POST")[0][1]?.body),
    );
    expect(input.shownTaskIds).toEqual(
      screen.getAllByRole("radio").map((radio) => radio.getAttribute("value")),
    );

    await act(async () => {
      save.resolve(
        Response.json({
          tasks: input.shownTaskIds.map((id) => ({
            ...storedTasks.find((task) => task.id === id)!,
            shownCount: 1,
          })),
        }),
      );
    });
    expect(screen.getByRole("radio", { name: /冒険4/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeEnabled();
    expect(candidateRequests()).toHaveLength(getsBefore);
    fireEvent.click(screen.getByRole("button", { name: "このクエストに挑戦する" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    const startRequest = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/quests");
    expect(JSON.parse(String(startRequest?.[1]?.body))).toEqual({
      selectedTaskId: input.shownTaskIds[0],
      shownTaskIds: input.shownTaskIds,
    });
  });

  it("提示保存の失敗はカードを残して開始を止め、明示的な再取得で復旧する", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    await screen.findByRole("radio");
    await waitFor(() => expect(screen.getByRole("button", { name: /再抽選する/ })).toBeEnabled());
    rejectPresentation = true;
    fireEvent.click(screen.getByRole("button", { name: /再抽選する/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("候補を保存できませんでした");
    const radio = screen.getByRole("radio");
    expect(radio).toBeEnabled();
    fireEvent.click(radio);
    expect(radio).toBeChecked();
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeDisabled();
    expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
    expect(screen.getByRole("region", { name: "候補の提示を保存" })).toHaveTextContent(
      "エラーがあります",
    );
    rejectPresentation = false;
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("radio"));
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeEnabled();
    expect(candidateRequests()).toHaveLength(2);
  });

  it("認証が完了するまで保存領域を読まず、認証後は通信を待たずに候補と全タスクを復元する", async () => {
    const extraTask = {
      ...existing,
      id: "10000000-0000-4000-8000-000000000002",
      title: "候補外の保存済みタスク",
    };
    writeQuestCache("test-user-id", {
      tasks: [existing, extraTask],
      choices: { candidates: [existing], isUrgent: false, inProgressQuest: null },
    });
    const auth = Promise.withResolvers<Response>();
    const read = Promise.withResolvers<Response>();
    pendingAuthResponse = auth.promise;
    pendingCandidateResponse = read.promise;
    pendingTaskResponse = Promise.withResolvers<Response>().promise;
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    render(<QuestApp />);
    expect(screen.queryByText(existing.title)).not.toBeInTheDocument();
    expect(getItem).not.toHaveBeenCalled();
    await act(async () => {
      auth.resolve(Response.json({ user: { id: "test-user-id", email: "hero@example.com" } }));
    });
    const cachedRadio = await screen.findByRole("radio", { name: new RegExp(existing.title) });
    expect(cachedRadio).toBeEnabled();
    fireEvent.click(cachedRadio);
    expect(cachedRadio).toBeChecked();
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeDisabled();
    expect(candidateRequests()).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/tasks")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    expect(screen.getByText(extraTask.title)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "クエスト" }));

    await act(async () => {
      read.resolve(
        Response.json({ candidates: [extraTask], isUrgent: false, inProgressQuest: null }),
      );
    });
    expect(
      screen.queryByRole("radio", { name: new RegExp(existing.title) }),
    ).not.toBeInTheDocument();
    const authoritativeRadio = screen.getByRole("radio", { name: new RegExp(extraTask.title) });
    expect(authoritativeRadio).not.toBeChecked();
    fireEvent.click(authoritativeRadio);
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeEnabled();
  });

  it.each(["期限切れ", "破損", "別ユーザー"] as const)(
    "%sのキャッシュを表示せず、全タスクと候補をDBから取得する",
    async (kind) => {
      const snapshot = {
        tasks: [existing],
        choices: { candidates: [existing], isUrgent: false, inProgressQuest: null },
      };
      writeQuestCache(
        kind === "別ユーザー" ? "other-user" : "test-user-id",
        snapshot,
        kind === "期限切れ" ? Date.now() - QUEST_CACHE_TTL_MS : Date.now(),
      );
      if (kind === "破損")
        window.localStorage.setItem(questCacheKey("test-user-id"), "{invalid-json");
      pendingTaskResponse = Promise.withResolvers<Response>().promise;
      pendingCandidateResponse = Promise.withResolvers<Response>().promise;
      render(<QuestApp />);
      await screen.findByRole("navigation");
      expect(screen.queryByText(existing.title)).not.toBeInTheDocument();
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/tasks")).toHaveLength(1),
      );
      expect(candidateRequests()).toHaveLength(1);
    },
  );

  it.each(["編集", "削除"] as const)(
    "%s後に届く古いタスク一覧・候補の応答で変更前のデータを復活させない",
    async (operation) => {
      storedTasks = [existing];
      render(<QuestApp />);
      await screen.findByRole("radio");
      await waitFor(() => expect(readQuestCache("test-user-id")).not.toBeNull());
      const tasksRead = Promise.withResolvers<Response>();
      const candidatesRead = Promise.withResolvers<Response>();
      pendingTaskResponse = tasksRead.promise;
      pendingCandidateResponse = candidatesRead.promise;
      fireEvent(window, new Event("focus"));
      fireEvent.click(screen.getByRole("button", { name: "タスク" }));
      fireEvent.click(screen.getByLabelText(`${existing.title}のメニュー`));
      fireEvent.click(screen.getByRole("button", { name: operation }));
      if (operation === "編集") {
        fireEvent.change(screen.getByRole("textbox", { name: /タスク名/ }), {
          target: { value: "変更後のタスク" },
        });
        fireEvent.click(screen.getByRole("button", { name: "保存する" }));
      } else {
        fireEvent.click(screen.getByRole("button", { name: "削除する" }));
      }
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
      await act(async () => {
        tasksRead.resolve(Response.json({ tasks: [existing] }));
        candidatesRead.resolve(
          Response.json({ candidates: [existing], isUrgent: false, inProgressQuest: null }),
        );
      });
      expect(screen.queryByText(existing.title)).not.toBeInTheDocument();
      if (operation === "編集") expect(screen.getByText("変更後のタスク")).toBeVisible();
      else expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
      pendingTaskResponse = null;
      pendingCandidateResponse = null;
      fireEvent.click(screen.getByRole("button", { name: "クエスト" }));
      if (operation === "編集")
        expect(await screen.findByRole("radio", { name: /変更後のタスク/ })).toBeVisible();
      else
        expect(await screen.findByRole("button", { name: "＋ 新しいタスクを追加" })).toBeVisible();
      expect(
        screen.queryByRole("radio", { name: new RegExp(existing.title) }),
      ).not.toBeInTheDocument();
    },
  );

  it("削除前の提示保存が後から完了してもカードとキャッシュを復活させない", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    await screen.findByRole("radio");
    await waitFor(() => expect(screen.getByRole("button", { name: /再抽選する/ })).toBeEnabled());
    const save = Promise.withResolvers<Response>();
    pendingPresentationResponse = save.promise;
    fireEvent.click(screen.getByRole("button", { name: /再抽選する/ }));
    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    fireEvent.click(screen.getByLabelText(`${existing.title}のメニュー`));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "クエスト" }));
    await screen.findByRole("button", { name: "＋ 新しいタスクを追加" });
    await act(async () => {
      save.resolve(Response.json({ tasks: [{ ...existing, shownCount: 1 }] }));
    });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText(existing.title)).not.toBeInTheDocument();
    const cached = readQuestCache("test-user-id");
    expect(cached?.tasks ?? []).toEqual([]);
  });

  it.each(["focus", "storage"] as const)(
    "%sでキャッシュを破棄し、カードを操作可能に保ったままDBを再確認する",
    async (eventType) => {
      storedTasks = [existing];
      render(<QuestApp />);
      await screen.findByRole("radio");
      await waitFor(() => expect(readQuestCache("test-user-id")).not.toBeNull());
      const tasksRead = Promise.withResolvers<Response>();
      const candidatesRead = Promise.withResolvers<Response>();
      pendingTaskResponse = tasksRead.promise;
      pendingCandidateResponse = candidatesRead.promise;
      fireEvent(
        window,
        eventType === "focus"
          ? new Event("focus")
          : new StorageEvent("storage", { key: questCacheKey("test-user-id"), newValue: null }),
      );
      const radio = screen.getByRole("radio");
      expect(radio).toBeEnabled();
      fireEvent.click(radio);
      expect(radio).toBeChecked();
      expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeDisabled();
      expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
      expect(candidateRequests()).toHaveLength(2);
      await act(async () => {
        tasksRead.resolve(Response.json({ tasks: [] }));
        candidatesRead.resolve(
          Response.json({ candidates: [], isUrgent: false, inProgressQuest: null }),
        );
      });
      expect(await screen.findByRole("button", { name: "＋ 新しいタスクを追加" })).toBeVisible();
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "タスク" }));
      expect(screen.queryByText(existing.title)).not.toBeInTheDocument();
    },
  );

  it("再抽選時に現在時刻で期限を再計算し、期限切れになった緊急タスクを除く", async () => {
    const dueAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
    const alternative = {
      ...existing,
      id: "10000000-0000-4000-8000-000000000002",
      title: "まだ選べるタスク",
    };
    storedTasks = [{ ...existing, dueAt }, alternative];
    render(<QuestApp />);
    await screen.findByRole("radio", { name: new RegExp(existing.title) });
    await waitFor(() => expect(screen.getByRole("button", { name: /再抽選する/ })).toBeEnabled());
    pendingPresentationResponse = Promise.withResolvers<Response>().promise;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(dueAt) + 1));
    fireEvent.click(screen.getByRole("button", { name: /再抽選する/ }));
    expect(
      screen.queryByRole("radio", { name: new RegExp(existing.title) }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: new RegExp(alternative.title) })).toBeEnabled();
    expect(candidateRequests()).toHaveLength(1);
    vi.useRealTimers();
  });

  it("表示後に期限が切れた候補は、DB開始リクエスト前に再確認を求める", async () => {
    const dueAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
    storedTasks = [{ ...existing, dueAt }];
    render(<QuestApp />);
    await screen.findByRole("radio");
    await waitFor(() => expect(screen.getByRole("button", { name: /再抽選する/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("radio"));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(dueAt) + 1));
    fireEvent.click(screen.getByRole("button", { name: "このクエストに挑戦する" }));
    expect(screen.getByRole("alert")).toHaveTextContent("候補の期限が変わりました");
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/quests")).toHaveLength(0);
    expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
    vi.useRealTimers();
  });

  it("開始と実際の画面遷移を別段階で表示し、遷移前のタスク・集計再取得は行わない", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    await screen.findByRole("radio");
    await waitFor(() => expect(readQuestCache("test-user-id")).not.toBeNull());
    fireEvent.click(screen.getByRole("radio"));
    const start = Promise.withResolvers<Response>();
    pendingStartResponse = start.promise;
    const taskReads = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/tasks").length;
    fireEvent.click(screen.getByRole("button", { name: "このクエストに挑戦する" }));
    const overlay = screen.getByRole("dialog", { name: "クエスト画面へ移動" });
    expect(within(overlay).getByText("完了した処理: 0 / 2 件")).toBeVisible();
    expect(
      within(overlay).getByRole("progressbar", {
        name: "DBで候補を検証してクエストを開始：処理中",
      }),
    ).toBeVisible();
    expect(mockPush).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
    await act(async () => {
      start.resolve(
        Response.json({
          quest: {
            id: "10000000-0000-4000-8000-000000000099",
            taskId: existing.id,
            status: "in_progress",
            isUrgent: false,
            xpEarned: 0,
            startedAt: existing.createdAt,
            completedAt: null,
          },
        }),
      );
    });
    expect(mockPush).toHaveBeenCalledWith(
      "/quests/10000000-0000-4000-8000-000000000099/checkpoints",
    );
    expect(screen.getByRole("dialog", { name: "クエスト画面へ移動" })).toBeVisible();
    expect(within(overlay).getByText("完了した処理: 1 / 2 件")).toBeVisible();
    expect(
      within(overlay).getByRole("progressbar", { name: "チェックポイント画面へ移動：処理中" }),
    ).toBeVisible();
    expect(within(overlay).queryByText("すべての処理が完了しました")).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/tasks")).toHaveLength(
      taskReads,
    );
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/stats")).toHaveLength(0);
  });
});

describe("キャッシュと再開情報の有効性", () => {
  it("候補の保存で全タスクの取得時刻を延長せず、元の60秒でキャッシュを失効させる", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    await screen.findByRole("radio");
    await waitFor(() => expect(readQuestCache("test-user-id")).not.toBeNull());
    const savedAt = readQuestCache("test-user-id")!.savedAt;
    const clock = vi.spyOn(Date, "now").mockReturnValue(savedAt + 30_000);
    fireEvent.click(screen.getByRole("button", { name: /再抽選する/ }));
    await waitFor(() =>
      expect(readQuestCache("test-user-id")?.choices.candidates[0].shownCount).toBe(1),
    );
    expect(readQuestCache("test-user-id")?.savedAt).toBe(savedAt);
    clock.mockReturnValue(savedAt + QUEST_CACHE_TTL_MS);
    expect(readQuestCache("test-user-id")).toBeNull();
  });

  it("保存応答のIDが表示と違う場合も開始を許可せず、カードの選択は維持する", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    await screen.findByRole("radio");
    await waitFor(() => expect(screen.getByRole("button", { name: /再抽選する/ })).toBeEnabled());
    const save = Promise.withResolvers<Response>();
    pendingPresentationResponse = save.promise;
    fireEvent.click(screen.getByRole("button", { name: /再抽選する/ }));
    fireEvent.click(screen.getByRole("radio"));
    await act(async () => {
      save.resolve(
        Response.json({
          tasks: [{ ...existing, id: "10000000-0000-4000-8000-000000000002" }],
        }),
      );
    });
    expect(screen.getByRole("alert")).toHaveTextContent("保存結果を確認できませんでした");
    expect(screen.getByRole("radio")).toBeEnabled();
    expect(screen.getByRole("radio")).toBeChecked();
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeDisabled();
    expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
  });

  it("保存した進行中クエストが完了済みなら、確認後に再開情報とタスク状態を更新する", async () => {
    const quest: Quest = {
      id: "10000000-0000-4000-8000-000000000003",
      taskId: existing.id,
      status: "in_progress",
      isUrgent: false,
      xpEarned: 0,
      startedAt: existing.createdAt,
      completedAt: null,
    };
    writeQuestCache("test-user-id", {
      tasks: [{ ...existing, status: "in_quest" }],
      choices: { candidates: [], isUrgent: false, inProgressQuest: quest },
    });
    storedTasks = [{ ...existing, status: "done" }];
    const read = Promise.withResolvers<Response>();
    pendingCandidateResponse = read.promise;
    render(<QuestApp />);
    const resume = await screen.findByRole("button", { name: "進行中のクエスト画面を開く" });
    expect(resume).toBeDisabled();
    fireEvent.click(resume);
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => {
      read.resolve(Response.json({ candidates: [], isUrgent: false, inProgressQuest: null }));
    });
    expect(await screen.findByRole("button", { name: "＋ 新しいタスクを追加" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "進行中のクエスト画面を開く" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ステータス" }));
    expect(
      screen.queryByRole("button", { name: "進行中の冒険を再開する" }),
    ).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/tasks")).toHaveLength(1);
  });
});

describe("開始・再開の実処理の進捗", () => {
  it("DB開始が失敗した処理を完了扱いにせず、候補の再確認まで開始を止める", async () => {
    storedTasks = [existing];
    render(<QuestApp />);
    await screen.findByRole("radio");
    await waitFor(() => expect(readQuestCache("test-user-id")).not.toBeNull());
    const start = Promise.withResolvers<Response>();
    pendingStartResponse = start.promise;
    fireEvent.click(screen.getByRole("radio"));
    fireEvent.click(screen.getByRole("button", { name: "このクエストに挑戦する" }));
    await act(async () => {
      start.resolve(
        Response.json(
          { error: { code: "conflict", message: "選択したタスクは変更されています" } },
          { status: 409 },
        ),
      );
    });
    expect(screen.getByRole("alert")).toHaveTextContent("選択したタスクは変更されています");
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const progress = screen.getByRole("region", { name: "クエストを開始" });
    expect(progress).toHaveTextContent("エラーがあります");
    expect(progress).toHaveTextContent("完了した処理: 0 / 2 件");
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeDisabled();
    expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const radio = await screen.findByRole("radio");
    fireEvent.click(radio);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeEnabled(),
    );
  });

  it("再開時もルーター呼び出しだけで完了扱いにせず、遷移待ちの表示を保つ", async () => {
    storedTasks = [{ ...existing, status: "in_quest" }];
    inProgressQuest = {
      id: "10000000-0000-4000-8000-000000000003",
      taskId: existing.id,
      status: "in_progress",
      isUrgent: false,
      xpEarned: 0,
      startedAt: existing.createdAt,
      completedAt: null,
    };
    render(<QuestApp />);
    const resume = await screen.findByRole("button", { name: "進行中のクエスト画面を開く" });
    await waitFor(() => expect(readQuestCache("test-user-id")).not.toBeNull());
    fireEvent.click(resume);
    expect(mockPush).toHaveBeenCalledWith(`/quests/${inProgressQuest.id}`);
    const overlay = screen.getByRole("dialog", { name: "クエスト画面へ移動" });
    expect(within(overlay).getByRole("region", { name: "冒険を再開" })).toBeVisible();
    expect(within(overlay).getByText("完了した処理: 0 / 1 件")).toBeVisible();
    expect(
      within(overlay).getByRole("progressbar", { name: "クエスト画面へ移動：処理中" }),
    ).toBeVisible();
    expect(within(overlay).queryByText("すべての処理が完了しました")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(questCacheKey("test-user-id"))).toBeNull();
  });
});
