import { useLayoutEffect, useRef, useState } from "react";
import type { CreateTaskRequest, Task } from "@/lib/schemas";

export function TaskList({
  tasks,
  openForm,
  onFormChange,
  onCreate,
}: {
  tasks: Task[];
  openForm: boolean;
  onFormChange: (open: boolean) => void;
  onCreate: (input: CreateTaskRequest) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const positions = useRef(new Map<string, number>());
  const initialized = useRef(false);

  useLayoutEffect(() => {
    if (openForm && !dialog.current?.open) dialog.current?.showModal();
    if (!openForm && dialog.current?.open) dialog.current.close();
  }, [openForm]);

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

  async function submit() {
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError("タスク名を入力してください。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate({
        title: trimmed,
        dueAt: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
      });
      setTitle("");
      setDueDate("");
      onFormChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "タスクを追加できませんでした。");
    } finally {
      setSaving(false);
    }
  }

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
        onClick={() => {
          setError("");
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
        aria-labelledby="create-task-heading"
        onCancel={(event) => {
          if (saving) event.preventDefault();
          else onFormChange(false);
        }}
        onClose={() => onFormChange(false)}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-44px)] max-w-[346px] overflow-y-auto border-0 bg-transparent p-1 text-[#ededf4] backdrop:bg-[#080a14]/85"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="pixel-panel space-y-4 p-5"
          aria-label="タスク作成"
        >
          <h2 id="create-task-heading" className="text-lg text-[#f3ca70]">
            新しいタスクを追加
          </h2>
          <label className="block text-sm">
            タスク名 <span className="text-[#f3ca70]">必須</span>
            <input
              autoFocus
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              placeholder="やりたいことを書き出そう"
              className="pixel-input mt-2"
              disabled={saving}
            />
          </label>
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
              onClick={() => onFormChange(false)}
              disabled={saving}
              className="secondary-button flex-1"
            >
              キャンセル
            </button>
            <button type="submit" disabled={saving} className="gold-button flex-1">
              {saving ? "追加中…" : "追加する"}
            </button>
          </div>
        </form>
      </dialog>
      <ul
        ref={list}
        className="space-y-3"
        aria-label="登録済みタスク"
        aria-live="polite"
        aria-relevant="additions"
      >
        {tasks.map((task) => (
          <li
            key={task.id}
            data-task-id={task.id}
            className="pixel-panel flex min-h-[84px] items-center gap-3 px-4 py-3"
          >
            <span
              aria-hidden="true"
              className={`h-[18px] w-[18px] shrink-0 border border-[#e9c874] ${task.status === "done" ? "bg-[#e9c874]" : ""}`}
            />
            <div className="min-w-0">
              <p className="break-words text-sm leading-6">{task.title}</p>
              <p className="mt-1 text-xs text-[#a4a8bc]">
                {task.dueAt
                  ? `期限 ${new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(task.dueAt))}`
                  : "期限なし"}
                {task.status === "in_quest" && <span className="ml-3 text-[#a5d4be]">挑戦中</span>}
                {task.status === "done" && <span className="ml-3 text-[#a5d4be]">完了</span>}
              </p>
            </div>
          </li>
        ))}
      </ul>
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
