import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestChoices } from "./quest-choices";
import type { QuestCandidatesResponse, Task } from "@/lib/schemas";

const mockCandidates: Task[] = [
  {
    id: "task-1",
    title: "Webアプリを完成させる",
    dueAt: "2026-10-25T15:00:00Z",
    status: "active",
    shownCount: 1,
    skippedCount: 0,
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
  },
  {
    id: "task-2",
    title: "レポートを提出する",
    dueAt: null,
    status: "active",
    shownCount: 1,
    skippedCount: 0,
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
  },
];

const mockChoices: QuestCandidatesResponse = {
  candidates: mockCandidates,
  isUrgent: false,
  inProgressQuest: null,
};

describe("QuestChoices - ファースト・インプレッション（直感チョイス）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ガイド文言『直感を信じて、最初に目が留まったものをタップ！』が表示される", () => {
    render(
      <QuestChoices
        choices={mockChoices}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText("直感を信じて、最初に目が留まったものをタップ！")).toBeInTheDocument();
    expect(screen.getByText("Webアプリを完成させる")).toBeInTheDocument();
    expect(screen.getByText("レポートを提出する")).toBeInTheDocument();
  });

  it("先頭の候補を3秒以内に選択したときに『⚡ 直感即決！』バッジが表示される", () => {
    render(
      <QuestChoices
        choices={mockChoices}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    // 0.5秒後に先頭（1番目）のタスクを選択
    vi.advanceTimersByTime(500);
    const radio = screen.getByRole("radio", { name: /Webアプリを完成させる/ });
    fireEvent.click(radio);

    expect(screen.getByTestId("instant-choice-badge")).toHaveTextContent("⚡ 直感即決！");
  });

  it("カード表示から3秒以内に選択すると『⚡ 直感即決！』バッジが表示される", () => {
    render(
      <QuestChoices
        choices={mockChoices}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    // 1秒後に2番目のタスクを選択
    vi.advanceTimersByTime(1000);
    const radio = screen.getByRole("radio", { name: /レポートを提出する/ });
    fireEvent.click(radio);

    expect(screen.getByTestId("instant-choice-badge")).toHaveTextContent("⚡ 直感即決！");
  });

  it("カード表示から3秒以上経過して選択した場合は直感バッジが表示されない", () => {
    render(
      <QuestChoices
        choices={mockChoices}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    // 3.5秒経過
    vi.advanceTimersByTime(3500);
    const radio = screen.getByRole("radio", { name: /レポートを提出する/ });
    fireEvent.click(radio);

    expect(screen.queryByTestId("instant-choice-badge")).not.toBeInTheDocument();
  });

  it("3秒以内に選択した後に3秒以上経過して別の候補を選び直した場合は直感バッジが消える", () => {
    render(
      <QuestChoices
        choices={mockChoices}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    // 1秒後に先頭を選択（直感即決）
    vi.advanceTimersByTime(1000);
    const radio1 = screen.getByRole("radio", { name: /Webアプリを完成させる/ });
    fireEvent.click(radio1);
    expect(screen.getByTestId("instant-choice-badge")).toHaveTextContent("⚡ 直感即決！");

    // さらに3秒経過（合計4秒）した後に2番目を選択し直す
    vi.advanceTimersByTime(3000);
    const radio2 = screen.getByRole("radio", { name: /レポートを提出する/ });
    fireEvent.click(radio2);
    expect(screen.queryByTestId("instant-choice-badge")).not.toBeInTheDocument();
  });

  it("初期状態（未選択）では開始ボタンが無効化され、タスク選択で有効化される", () => {
    render(
      <QuestChoices
        choices={mockChoices}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    const startBtn = screen.getByRole("button", { name: "このクエストに挑戦する" });
    expect(startBtn).toBeDisabled();

    const radio = screen.getByRole("radio", { name: /Webアプリを完成させる/ });
    fireEvent.click(radio);

    expect(startBtn).not.toBeDisabled();
  });
});
