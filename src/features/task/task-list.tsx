import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { TASK_TITLE_MAX_LENGTH, type CreateTaskRequest, type Task } from "@/lib/schemas";

export function TaskList({
  tasks,
  openForm,
  onFormChange,
  onCreate,
  onUpdate,
  onDelete,
}: {
  tasks: Task[];
  openForm: boolean;
  onFormChange: (open: boolean) => void;
  onCreate: (input: CreateTaskRequest) => Promise<void>;
  onUpdate: (id: string, input: CreateTaskRequest) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const initialDueDate = useRef("");
  const savingRef = useRef(false);
  const deletingRef = useRef(false);
  const list = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const positions = useRef(new Map<string, number>());
  const initialized = useRef(false);
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.skippedCount - b.skippedCount),
    [tasks],
  );
  const pendingTasks = sortedTasks.filter((task) => task.status !== "done");
  const completedTasks = sortedTasks.filter((task) => task.status === "done");

  useLayoutEffect(() => {
    if (openForm && !dialog.current?.open) dialog.current?.showModal();
    if (!openForm && dialog.current?.open) dialog.current.close();
  }, [openForm]);

  useLayoutEffect(() => {
    if (deletingTask && !deleteDialog.current?.open) deleteDialog.current?.showModal();
    if (!deletingTask && deleteDialog.current?.open) deleteDialog.current.close();
  }, [deletingTask]);

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const item of list.current?.querySelectorAll<HTMLElement>("[data-task-id]") ?? []) {
      const id = item.dataset.taskId;
      if (!id) continue;
      const top = item.getBoundingClientRect().top;
      next.set(id, top);
      const previous = positions.current.get(id);
      if (!reducedMotion && item.animate && initialized.current) {
        if (previous !== undefined && previous !== top) {
          item.animate(
            [{ transform: `translateY(${previous - top}px)` }, { transform: "translateY(0)" }],
            { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
        } else if (previous === undefined) {
          item.animate(
            [
              { opacity: 0, transform: "translateY(-16px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: 320, easing: "ease-out" },
          );
        }
      }
    }
    positions.current = next;
    initialized.current = true;
  }, [tasks]);

  function closeForm() {
    onFormChange(false);
    setEditingTask(null);
    setTitle("");
    setDueDate("");
    initialDueDate.current = "";
    setError("");
  }

  async function confirmDelete() {
    if (!deletingTask || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(deletingTask.id);
      setDeletingTask(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "タスクを削除できませんでした。");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  async function submit() {
    if (savingRef.current) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError("タスク名を入力してください。");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const input: CreateTaskRequest = {
        title: trimmed,
        dueAt:
          editingTask && dueDate === initialDueDate.current
            ? editingTask.dueAt
            : dueDate
              ? new Date(`${dueDate}T23:59:59`).toISOString()
              : null,
      };
      if (editingTask) await onUpdate(editingTask.id, input);
      else await onCreate(input);
      closeForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "タスクを保存できませんでした。");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const renderTask = (task: Task) => (
    <li
      key={task.id}
      data-task-id={task.id}
      className="pixel-panel flex min-h-[84px] items-center gap-3 px-4 py-3"
    >
      <span
        aria-hidden="true"
        className={`h-[18px] w-[18px] shrink-0 border border-[#e9c874] ${task.status === "done" ? "bg-[#e9c874]" : ""}`}
      />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm leading-6">{task.title}</p>
        <p className="mt-1 text-xs text-[#a4a8bc]">
          {task.dueAt
            ? `期限 ${new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(task.dueAt))}`
            : "期限なし"}
          <span className="ml-3 text-muted" aria-label={`reject回数 ${task.skippedCount}回`}>
            ❌{task.skippedCount}
          </span>
          {task.status === "in_quest" && <span className="ml-3 text-[#a5d4be]">挑戦中</span>}
          {task.status === "done" && <span className="ml-3 text-[#a5d4be]">完了</span>}
        </p>
      </div>
      <details
        name="task-actions"
        className="relative shrink-0"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
      >
        <summary
          aria-label={`${task.title}のメニュー`}
          className="flex h-10 w-8 cursor-pointer list-none items-center justify-center text-2xl text-gold-text hover:bg-panel-active [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden="true">⋮</span>
        </summary>
        <div className="absolute right-0 top-10 z-20 w-28 border border-gold-border bg-panel p-1 shadow-xl">
          <button
            type="button"
            disabled={saving || deleting}
            className="block min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-panel-active"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              const date = task.dueAt ? new Date(task.dueAt) : null;
              const dateValue = date
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                : "";
              initialDueDate.current = dateValue;
              setEditingTask(task);
              setTitle(task.title);
              setDueDate(dateValue);
              setError("");
              onFormChange(true);
            }}
          >
            編集
          </button>
          <button
            type="button"
            disabled={saving || deleting}
            className="block min-h-11 w-full px-3 py-2 text-left text-sm text-danger hover:bg-panel-active"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              setDeleteError("");
              setDeletingTask(task);
            }}
          >
            削除
          </button>
        </div>
      </details>
    </li>
  );

  return (
    <section aria-labelledby="tasks-heading">
      <div className="screen-heading">
        <div>
          <h1 id="tasks-heading">タスクリスト</h1>
          <p>あなたの冒険の種を登録しよう</p>
        </div>
        <span className="pixel-wizard" aria-hidden="true" />
      </div>
      <button
        className="gold-button mb-7 w-full text-left"
        disabled={saving || deleting}
        onClick={() => {
          setError("");
          setEditingTask(null);
          setTitle("");
          setDueDate("");
          initialDueDate.current = "";
          onFormChange(true);
        }}
      >
        <span aria-hidden="true" className="mr-3">
          ＋
        </span>
        新しいタスクを追加
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="task-form-heading"
        onCancel={(event) => {
          if (savingRef.current) event.preventDefault();
          else closeForm();
        }}
        onClose={() => {
          if (!dialog.current?.open) closeForm();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-44px)] max-w-[346px] overflow-y-auto border-0 bg-transparent p-1 text-text backdrop:bg-surface/85"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="pixel-panel space-y-4 p-5"
          aria-label={editingTask ? "タスク編集" : "タスク作成"}
        >
          <h2 id="task-form-heading" className="text-lg text-gold-accent">
            {editingTask ? "タスクを編集" : "新しいタスクを追加"}
          </h2>
          <label className="block text-sm">
            タスク名 <span className="text-[#f3ca70]">必須</span>
            <input
              autoFocus
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TASK_TITLE_MAX_LENGTH}
              required
              aria-describedby="task-title-count"
              placeholder="やりたいことを書き出そう"
              className="pixel-input mt-2"
              disabled={saving}
            />
          </label>
          <p
            id="task-title-count"
            className={`-mt-3 text-right text-xs ${title.length >= TASK_TITLE_MAX_LENGTH ? "text-gold-accent" : "text-muted"}`}
          >
            {title.length}/{TASK_TITLE_MAX_LENGTH}
          </p>
          <label className="block text-sm">
            期限 <span className="text-xs text-[#a4a8bc]">任意</span>
            <input
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="pixel-input mt-2"
              disabled={saving}
            />
          </label>
          <p className="text-xs text-[#a4a8bc]">
            期限はその日の終わりまで。あとから決めても大丈夫。
          </p>
          {error && (
            <p role="alert" className="text-sm text-[#ffb5a9]">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="secondary-button flex-1"
            >
              キャンセル
            </button>
            <button type="submit" disabled={saving} className="gold-button flex-1">
              {saving
                ? editingTask
                  ? "保存中…"
                  : "追加中…"
                : editingTask
                  ? "保存する"
                  : "追加する"}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={deleteDialog}
        aria-labelledby="delete-task-heading"
        onCancel={(event) => {
          if (deletingRef.current) event.preventDefault();
          else setDeletingTask(null);
        }}
        onClose={() => {
          if (!deleteDialog.current?.open) setDeletingTask(null);
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-44px)] max-w-[346px] overflow-y-auto border-0 bg-transparent p-1 text-text backdrop:bg-surface/85"
      >
        <div className="pixel-panel space-y-4 p-5">
          <h2 id="delete-task-heading" className="text-lg text-gold-accent">
            タスクを削除しますか？
          </h2>
          <p className="break-words text-sm leading-6">{deletingTask?.title}</p>
          <p className="text-xs leading-6 text-muted">
            関連するクエストとチェックポイントも削除されます。この操作は取り消せません。
          </p>
          {deleteError && (
            <p role="alert" className="text-sm text-danger">
              {deleteError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className="secondary-button flex-1"
              disabled={deleting}
              onClick={() => setDeletingTask(null)}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="secondary-button min-h-11 flex-1 border-danger px-3 py-2 text-sm font-bold text-danger disabled:opacity-50"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "削除中…" : "削除する"}
            </button>
          </div>
        </div>
      </dialog>
      <ul
        ref={list}
        className="space-y-3"
        aria-label="登録済みタスク"
        aria-live="polite"
        aria-relevant="additions"
      >
        {pendingTasks.map(renderTask)}
      </ul>
      {completedTasks.length > 0 && (
        <details className="group/completed mt-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 border-b border-line py-3 text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-success [&::-webkit-details-marker]:hidden">
            <span>完了済みタスク（{completedTasks.length}件）</span>
            <span aria-hidden="true" className="group-open/completed:rotate-180">
              ▼
            </span>
          </summary>
          <ul className="mt-3 space-y-3" aria-label="完了済みタスク">
            {completedTasks.map(renderTask)}
          </ul>
        </details>
      )}
      {tasks.length === 0 && !openForm && (
        <p className="pixel-panel p-5 text-sm leading-7 text-[#a4a8bc]">
          まだタスクがありません。
          <br />
          最初の冒険の種を登録しましょう。
        </p>
      )}
    </section>
  );
}
