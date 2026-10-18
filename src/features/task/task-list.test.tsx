import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskList } from "@/features/task/task-list";
import { TASK_TITLE_MAX_LENGTH, type CreateTaskRequest, type Task } from "@/lib/schemas";

const sound = vi.hoisted(() => ({ playSfx: vi.fn(), vibrate: vi.fn() }));
vi.mock("@/components/ui/sound", () => sound);

const task: Task = {
  id: "task-1",
  title: "レポートを提出する",
  dueAt: "2026-10-25T03:04:05.678Z",
  status: "active",
  shownCount: 1,
  skippedCount: 0,
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
};

function renderTaskList({
  tasks = [task],
  onCreate = vi.fn<(input: CreateTaskRequest) => Promise<void>>().mockResolvedValue(undefined),
  onUpdate = vi
    .fn<(id: string, input: CreateTaskRequest) => Promise<void>>()
    .mockResolvedValue(undefined),
  onDelete = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
} = {}) {
  function TaskListHarness() {
    const [openForm, setOpenForm] = useState(false);
    return (
      <TaskList
        tasks={tasks}
        openForm={openForm}
        onFormChange={setOpenForm}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    );
  }

  render(<TaskListHarness />);
  return { onCreate, onUpdate, onDelete };
}

function openAction(name: "編集" | "削除") {
  fireEvent.click(screen.getByLabelText(`${task.title}のメニュー`));
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
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
        this.dispatchEvent(new Event("close"));
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("完了済みタスクのアコーディオン", () => {
  it("未完了と挑戦中は表示を保ち、完了済みだけを繰り返し開閉する", () => {
    renderTaskList({
      tasks: [
        task,
        { ...task, id: "progress", title: "挑戦中のタスク", status: "in_quest" },
        { ...task, id: "done-many", title: "完了したタスクB", status: "done", skippedCount: 4 },
        { ...task, id: "done-first", title: "完了したタスクA", status: "done", skippedCount: 1 },
      ],
    });
    const summary = screen.getByText("完了済みタスク（2件）");
    const completed = screen.getByRole("list", { name: "完了済みタスク", hidden: true });
    const pending = screen.getByRole("list", { name: "登録済みタスク" });
    expect(
      within(pending)
        .getAllByRole("listitem")
        .map((row) => row.dataset.taskId),
    ).toEqual([task.id, "progress"]);
    expect(completed).not.toBeVisible();
    fireEvent.click(summary);
    expect(completed).toBeVisible();
    expect(
      within(completed)
        .getAllByRole("listitem")
        .map((row) => row.dataset.taskId),
    ).toEqual(["done-first", "done-many"]);
    fireEvent.click(summary);
    expect(completed).not.toBeVisible();
    expect(screen.getByText(task.title)).toBeVisible();
    expect(screen.getByText("挑戦中のタスク")).toBeVisible();
    fireEvent.click(summary);
    expect(completed).toBeVisible();
  });

  it("完了済みが0件なら空のアコーディオンを表示しない", () => {
    renderTaskList();
    expect(screen.queryByText(/完了済みタスク/)).not.toBeInTheDocument();
    expect(screen.getByText(task.title)).toBeVisible();
  });

  it("完了済みだけでも開いて編集・削除できる", async () => {
    const { onUpdate, onDelete } = renderTaskList({ tasks: [{ ...task, status: "done" }] });
    fireEvent.click(screen.getByText("完了済みタスク（1件）"));
    openAction("編集");
    const form = screen.getByRole("form", { name: "タスク編集" });
    fireEvent.change(within(form).getByLabelText(/タスク名/), {
      target: { value: "修正した記録" },
    });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(task.id, {
        title: "修正した記録",
        dueAt: task.dueAt,
      }),
    );
    await waitFor(() => expect(form.closest("dialog")).not.toHaveAttribute("open"));
    openAction("削除");
    const confirmation = screen.getByRole("dialog", { name: "タスクを削除しますか？" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(task.id));
  });
});

describe("TaskList のreject回数", () => {
  it("回数の昇順に並べ、同数の順序を保ち、回数の更新で並べ直す", () => {
    const tasks: Task[] = [
      { ...task, id: "many", title: "何度か見送ったタスク", skippedCount: 12 },
      { ...task, id: "zero", title: "まだ見送っていないタスク", skippedCount: 0 },
      { ...task, id: "two-first", title: "同数の新しいタスク", skippedCount: 2 },
      { ...task, id: "two-second", title: "同数の古いタスク", skippedCount: 2 },
    ];
    const props = {
      openForm: false,
      onFormChange: vi.fn(),
      onCreate: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
    };
    const { rerender } = render(<TaskList {...props} tasks={tasks} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.dataset.taskId)).toEqual([
      "zero",
      "two-first",
      "two-second",
      "many",
    ]);
    for (const [index, count] of [0, 2, 2, 12].entries()) {
      expect(within(rows[index]).getByLabelText(`reject回数 ${count}回`)).toHaveTextContent(
        `❌${count}`,
      );
    }
    expect(tasks.map((item) => item.id)).toEqual(["many", "zero", "two-first", "two-second"]);

    rerender(
      <TaskList
        {...props}
        tasks={tasks.map((item) => (item.id === "zero" ? { ...item, skippedCount: 3 } : item))}
      />,
    );
    expect(screen.getAllByRole("listitem").map((row) => row.dataset.taskId)).toEqual([
      "two-first",
      "two-second",
      "zero",
      "many",
    ]);
    expect(screen.getByLabelText("reject回数 3回")).toHaveTextContent("❌3");
  });
});

describe("TaskList の編集と削除", () => {
  it("タイトルだけの編集では元の期限の時刻と精度を保持する", async () => {
    const { onUpdate, onCreate } = renderTaskList();
    openAction("編集");

    const form = screen.getByRole("form", { name: "タスク編集" });
    fireEvent.change(within(form).getByLabelText(/タスク名/), {
      target: { value: "  レポートを仕上げる  " },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(task.id, {
        title: "レポートを仕上げる",
        dueAt: "2026-10-25T03:04:05.678Z",
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("期限の入力を空にすると期限を削除する", async () => {
    const { onUpdate } = renderTaskList();
    openAction("編集");
    const form = screen.getByRole("form", { name: "タスク編集" });
    fireEvent.change(within(form).getByLabelText(/期限/), { target: { value: "" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(task.id, { title: task.title, dueAt: null });
    });
  });

  it("変更した期限は端末のタイムゾーンでその日の終わりにする", async () => {
    const { onUpdate } = renderTaskList();
    openAction("編集");
    const form = screen.getByRole("form", { name: "タスク編集" });
    fireEvent.change(within(form).getByLabelText(/期限/), { target: { value: "2026-11-12" } });
    fireEvent.submit(form);

    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    const savedDate = new Date(onUpdate.mock.calls[0][1].dueAt!);
    expect([
      savedDate.getFullYear(),
      savedDate.getMonth(),
      savedDate.getDate(),
      savedDate.getHours(),
      savedDate.getMinutes(),
      savedDate.getSeconds(),
    ]).toEqual([2026, 10, 12, 23, 59, 59]);
  });

  it("削除確認をキャンセルするとタスクを残して削除を実行しない", () => {
    const { onDelete } = renderTaskList();
    openAction("削除");
    const confirmation = screen.getByRole("dialog", { name: "タスクを削除しますか？" });
    expect(within(confirmation).getByText(task.title)).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "キャンセル" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "登録済みタスク" })).getByText(task.title),
    ).toBeInTheDocument();
  });

  it("編集の失敗時は入力とタスクを残して再保存できる", async () => {
    const onUpdate = vi
      .fn<(id: string, input: CreateTaskRequest) => Promise<void>>()
      .mockRejectedValueOnce(new Error("保存に失敗しました"))
      .mockResolvedValue(undefined);
    renderTaskList({ onUpdate });
    openAction("編集");
    const form = screen.getByRole("form", { name: "タスク編集" });
    fireEvent.change(within(form).getByLabelText(/タスク名/), {
      target: { value: "書きかけのタイトル" },
    });
    fireEvent.change(within(form).getByLabelText(/期限/), { target: { value: "" } });
    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent("保存に失敗しました");
    expect(within(form).getByLabelText(/タスク名/)).toHaveValue("書きかけのタイトル");
    expect(within(form).getByLabelText(/期限/)).toHaveValue("");
    expect(within(screen.getByRole("list")).getByText(task.title)).toBeInTheDocument();
    fireEvent.submit(form);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(task.id, {
      title: "書きかけのタイトル",
      dueAt: null,
    });
  });

  it("削除の失敗時は確認とタスクを残して再試行できる", async () => {
    const onDelete = vi
      .fn<(id: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("削除に失敗しました"))
      .mockResolvedValue(undefined);
    renderTaskList({ onDelete });
    openAction("削除");
    const confirmation = screen.getByRole("dialog", { name: "タスクを削除しますか？" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("削除に失敗しました");
    expect(within(confirmation).getByText(task.title)).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByText(task.title)).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenLastCalledWith(task.id);
  });

  it.each(["作成", "編集"] as const)("%s中は連続送信とキャンセルを防ぐ", async (mode) => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onCreate = vi.fn<(input: CreateTaskRequest) => Promise<void>>().mockReturnValue(pending);
    const onUpdate = vi
      .fn<(id: string, input: CreateTaskRequest) => Promise<void>>()
      .mockReturnValue(pending);
    renderTaskList({ onCreate, onUpdate });
    if (mode === "編集") openAction("編集");
    else {
      fireEvent.click(screen.getByRole("button", { name: "新しいタスクを追加" }));
      fireEvent.change(screen.getByLabelText(/タスク名/), { target: { value: "新規タスク" } });
    }
    const form = screen.getByRole("form", { name: `タスク${mode}` });
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(mode === "編集" ? onUpdate : onCreate).toHaveBeenCalledOnce();
    expect(within(form).getByLabelText(/タスク名/)).toBeDisabled();
    expect(within(form).getByLabelText(/期限/)).toBeDisabled();
    expect(within(form).getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(within(form).getByRole("button", { name: /中…/ })).toBeDisabled();
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => finish());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("削除中は連続削除とキャンセルを防ぐ", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onDelete = vi.fn<(id: string) => Promise<void>>().mockReturnValue(pending);
    renderTaskList({ onDelete });
    openAction("削除");
    const confirmation = screen.getByRole("dialog", { name: "タスクを削除しますか？" });
    const deleteButton = within(confirmation).getByRole("button", { name: "削除する" });
    act(() => {
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);
    });

    expect(onDelete).toHaveBeenCalledOnce();
    expect(within(confirmation).getByRole("button", { name: "削除中…" })).toBeDisabled();
    expect(within(confirmation).getByRole("button", { name: "キャンセル" })).toBeDisabled();
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(confirmation, cancel);
    expect(cancel.defaultPrevented).toBe(true);

    await act(async () => finish());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["キャンセル", "保存する"])("編集の%s後は空の新規作成に戻る", async (action) => {
    const { onCreate, onUpdate } = renderTaskList();
    openAction("編集");
    const editForm = screen.getByRole("form", { name: "タスク編集" });
    fireEvent.change(within(editForm).getByLabelText(/タスク名/), {
      target: { value: "編集したタイトル" },
    });
    fireEvent.click(within(editForm).getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "新しいタスクを追加" }));
    const createForm = screen.getByRole("form", { name: "タスク作成" });
    expect(within(createForm).getByLabelText(/タスク名/)).toHaveValue("");
    expect(within(createForm).getByLabelText(/期限/)).toHaveValue("");
    fireEvent.change(within(createForm).getByLabelText(/タスク名/), {
      target: { value: "別のタスク" },
    });
    fireEvent.submit(createForm);

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ title: "別のタスク", dueAt: null });
    });
    expect(onUpdate).toHaveBeenCalledTimes(action === "保存する" ? 1 : 0);
  });
});

describe("タスク名の文字数上限", () => {
  it("入力欄の上限を30文字にし、入力中の文字数を表示する", () => {
    renderTaskList({ tasks: [] });
    fireEvent.click(screen.getByRole("button", { name: "新しいタスクを追加" }));
    const form = screen.getByRole("form", { name: "タスク作成" });
    const input = within(form).getByLabelText(/タスク名/);
    expect(TASK_TITLE_MAX_LENGTH).toBe(30);
    expect(input).toHaveAttribute("maxLength", "30");
    expect(input).toHaveAccessibleDescription("0/30");

    fireEvent.change(input, { target: { value: "レポートの参考文献を探す" } });
    expect(input).toHaveAccessibleDescription("12/30");
    expect(within(form).getByText("12/30")).toHaveClass("text-muted");

    fireEvent.change(input, { target: { value: "あ".repeat(30) } });
    expect(within(form).getByText("30/30")).toHaveClass("text-gold-accent");
  });

  it("編集時は既存のタスク名の文字数を表示する", () => {
    renderTaskList();
    openAction("編集");
    const form = screen.getByRole("form", { name: "タスク編集" });
    expect(within(form).getByLabelText(/タスク名/)).toHaveAttribute("maxLength", "30");
    expect(within(form).getByText(`${task.title.length}/30`)).toBeInTheDocument();
  });
});

describe("タスク登録の演出", () => {
  const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sound.playSfx.mockClear();
    animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: animate,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalAnimate) {
      Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  });

  type CreateMock = ReturnType<typeof vi.fn<(input: CreateTaskRequest) => Promise<void>>>;

  function submitNewTask(onCreate: CreateMock) {
    renderTaskList({ tasks: [], onCreate });
    fireEvent.click(screen.getByRole("button", { name: "新しいタスクを追加" }));
    const form = screen.getByRole("form", { name: "タスク作成" });
    fireEvent.change(within(form).getByLabelText(/タスク名/), { target: { value: "新しい冒険" } });
    fireEvent.submit(form);
  }

  it("登録に成功すると効果音を鳴らす", async () => {
    submitNewTask(
      vi.fn<(input: CreateTaskRequest) => Promise<void>>().mockResolvedValue(undefined),
    );
    await waitFor(() => expect(sound.playSfx).toHaveBeenCalledWith("select"));
  });

  it("登録に失敗したときは効果音を鳴らさない", async () => {
    submitNewTask(
      vi
        .fn<(input: CreateTaskRequest) => Promise<void>>()
        .mockRejectedValue(new Error("保存できませんでした")),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("保存できませんでした");
    expect(sound.playSfx).not.toHaveBeenCalled();
  });

  it("新しく追加されたタスクはポンと拡大して出てくる", () => {
    const props = {
      openForm: false,
      onFormChange: vi.fn(),
      onCreate: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
    };
    const { rerender } = render(<TaskList tasks={[task]} {...props} />);
    const added: Task = { ...task, id: "task-new", title: "新しい冒険" };
    rerender(<TaskList tasks={[added, task]} {...props} />);

    const newItem = screen.getByText("新しい冒険").closest("[data-task-id]");
    const call = animate.mock.calls.find((_, i) => animate.mock.contexts[i] === newItem);
    expect(call).toBeDefined();
    expect(JSON.stringify(call![0])).toContain("scale(");
  });
});
