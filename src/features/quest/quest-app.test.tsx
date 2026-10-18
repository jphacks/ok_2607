import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestApp } from "@/features/quest/quest-app";
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
  weight: 1,
  status: "active",
  shownCount: 0,
  skippedCount: 0,
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
};
let storedTasks: Task[];
let rejectCreation: boolean;
let rejectDeletion: boolean;
let inProgressQuest: Quest | null;
let pendingCandidateResponse: Promise<Response> | null;
let pendingStatsResponse: Promise<Response> | null;

beforeEach(() => {
  mockPush.mockClear();
  storedTasks = [];
  rejectCreation = false;
  rejectDeletion = false;
  inProgressQuest = null;
  pendingCandidateResponse = null;
  pendingStatsResponse = null;
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
        const input: { title: string; dueAt: string | null } = JSON.parse(String(init.body));
        const task = { ...existing, ...input, id: "10000000-0000-4000-8000-000000000002" };
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
      if (url === "/api/tasks") return Response.json({ tasks: storedTasks });
      if (url === "/api/quests/candidates") {
        if (pendingCandidateResponse) return pendingCandidateResponse;
        return Response.json({
          isUrgent: false,
          candidates: inProgressQuest ? [] : storedTasks.slice(0, 3),
          inProgressQuest,
        });
      }
      if (url === "/api/quests" && init?.method === "POST") {
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("タスク登録と3択の画面遷移", () => {
  it.each(["再取得前", "再取得後", "古い取得の失敗"] as const)(
    "完了タスク削除後は削除前の集計応答を反映しない（%s）",
    async (timing) => {
      storedTasks = [{ ...existing, status: "done" }];
      const stale = Promise.withResolvers<Response>();
      pendingStatsResponse = stale.promise;
      render(<QuestApp />);
      await screen.findByRole("radio");
      fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
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
      fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
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
    "$operation（初回取得遅延: $delayed）後もホームから進行中クエストを直接再開できる",
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
      if (!delayed) await screen.findByRole("button", { name: "ホームで確認する" });
      fireEvent.click(screen.getByRole("button", { name: "タスク" }));
      await screen.findByText(existing.title);
      if (operation === "編集") {
        fireEvent.click(screen.getByLabelText(`${existing.title}のメニュー`));
        const row = screen.getByText(existing.title).closest("li");
        if (!row) throw new Error("編集するタスクセルが見つかりません");
        fireEvent.click(within(row).getByRole("button", { name: "編集" }));
        fireEvent.change(screen.getByRole("textbox", { name: /タスク名/ }), {
          target: { value: "挑戦中タスクの編集" },
        });
        fireEvent.click(screen.getByRole("button", { name: "保存する" }));
      } else {
        fireEvent.click(screen.getByLabelText("別のタスクのメニュー"));
        const row = screen.getByText("別のタスク").closest("li");
        if (!row) throw new Error("削除するタスクセルが見つかりません");
        fireEvent.click(within(row).getByRole("button", { name: "削除" }));
        fireEvent.click(screen.getByRole("button", { name: "削除する" }));
      }
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
      if (responseGate) {
        pendingCandidateResponse = null;
        await act(async () => {
          responseGate.resolve(Response.json({ isUrgent: false, candidates: [], inProgressQuest }));
        });
      }
      fireEvent.click(await screen.findByRole("button", { name: "進行中の冒険を再開する" }));
      expect(mockPush).toHaveBeenCalledWith("/quests/10000000-0000-4000-8000-000000000003");
    },
  );

  it("メニューから編集でき、タイトルだけの変更では元の期限時刻を変えない", async () => {
    storedTasks = [{ ...existing, dueAt: "2026-11-01T09:15:00Z" }];
    render(<QuestApp />);
    await screen.findByRole("radio");
    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    fireEvent.click(screen.getByLabelText(`${existing.title}のメニュー`));
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    fireEvent.change(screen.getByRole("textbox", { name: /タスク名/ }), {
      target: { value: "編集したタスク" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("listitem")).toHaveTextContent("編集したタスク");
    expect(Date.parse(storedTasks[0].dueAt ?? "")).toBe(Date.parse("2026-11-01T09:15:00Z"));
    fireEvent.click(screen.getByRole("button", { name: "クエスト" }));
    expect(await screen.findByRole("radio", { name: /編集したタスク/ })).toBeVisible();
  });

  it("削除をキャンセル・再試行でき、保存に成功するまでセルを消さない", async () => {
    storedTasks = [existing];
    rejectDeletion = true;
    render(<QuestApp />);
    await screen.findByRole("radio");
    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    fireEvent.click(screen.getByLabelText(`${existing.title}のメニュー`));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.getByRole("listitem")).toHaveTextContent(existing.title);
    fireEvent.click(screen.getByLabelText(`${existing.title}のメニュー`));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await screen.findByRole("alert");
    expect(storedTasks).toEqual([existing]);
    expect(screen.getByRole("listitem")).toHaveTextContent(existing.title);
    rejectDeletion = false;
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(storedTasks).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "クエスト" }));
    expect(await screen.findByRole("button", { name: "＋ 新しいタスクを追加" })).toBeVisible();
  });

  it("進行中は開始・再抽選を表示せずホームで現在のタスクを確認できる", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: "ホームで確認する" }));

    expect(screen.getByRole("button", { name: "ホーム" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText(existing.title)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "クエスト" }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "このクエストに挑戦する" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /再抽選する/ })).not.toBeInTheDocument();
  });

  it("初回はクエストを表示し、空の状態からタスク名・期限だけの作成画面に進める", async () => {
    render(<QuestApp />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("今日の冒険を選べ");
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
      target: { value: "新しい冒険" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const rows = within(screen.getByRole("list", { name: "登録済みタスク" })).getAllByRole(
      "listitem",
    );
    expect(rows[0]).toHaveTextContent("新しい冒険");
    expect(rows[1]).toHaveTextContent("以前のタスク");
    fireEvent.click(screen.getByRole("button", { name: "クエスト" }));
    expect(await screen.findByRole("radio", { name: /新しい冒険/ })).toBeVisible();
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
    fireEvent.click(radio);
    const startButton = screen.getByRole("button", { name: "このクエストに挑戦する" });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/quests/10000000-0000-4000-8000-000000000099/checkpoints",
      );
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

  it("ホーム画面で進行中のクエストがある場合、再開ボタンで画面05へ遷移する", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: "ホームで確認する" }));
    const homeResumeBtn = await screen.findByRole("button", {
      name: "進行中の冒険を再開する",
    });
    fireEvent.click(homeResumeBtn);

    expect(mockPush).toHaveBeenCalledWith("/quests/10000000-0000-4000-8000-000000000003");
  });
});
