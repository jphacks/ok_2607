import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
let inProgressQuest: Quest | null;

beforeEach(() => {
  mockPush.mockClear();
  storedTasks = [];
  rejectCreation = false;
  inProgressQuest = null;
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
      if (url === "/api/tasks") return Response.json({ tasks: storedTasks });
      if (url === "/api/quests/candidates")
        return Response.json({
          isUrgent: false,
          candidates: inProgressQuest ? [] : storedTasks.slice(0, 3),
          inProgressQuest,
        });
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

      if (url === "/api/stats") return Response.json({ totalXp: 0, completedQuests: 0 });
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
    fireEvent.click(screen.getByRole("button", { name: /クエスト/ }));
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
      name: "進行中の冒険を再開する",
    });
    fireEvent.click(homeResumeBtn);

    expect(mockPush).toHaveBeenCalledWith("/quests/10000000-0000-4000-8000-000000000003");
  });

  it("3タブ（タスク / クエスト / ステータス）が表示され、中央のクエストが強調される", async () => {
    render(<QuestApp />);

    const nav = screen.getByRole("navigation", { name: "メインメニュー" });
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
});
