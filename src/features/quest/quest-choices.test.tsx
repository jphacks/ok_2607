import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestChoices } from "@/features/quest/quest-choices";
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

describe("QuestChoices のreject回数", () => {
  it.each([false, true])("緊急クエスト=%sでもカードごとの回数を表示する", (isUrgent) => {
    const candidates = mockCandidates.map((task, index) => ({
      ...task,
      skippedCount: index * 12,
    }));
    render(
      <QuestChoices
        choices={{ ...mockChoices, candidates, isUrgent }}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    for (const task of candidates) {
      const card = screen.getByRole("radio", { name: new RegExp(task.title) }).closest("label")!;
      expect(within(card).getByLabelText(`reject回数 ${task.skippedCount}回`)).toHaveTextContent(
        `❌${task.skippedCount}`,
      );
    }
  });
});

describe("QuestChoices - ファースト・インプレッション（直感チョイス）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("緊急表示は先頭候補だけに付け、別候補も直感チョイスで選択できる", () => {
    render(
      <QuestChoices
        choices={{ ...mockChoices, isUrgent: true }}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", { name: /Webアプリを完成させる.*緊急クエスト/ }),
    ).toBeInTheDocument();
    const other = screen.getByRole("radio", { name: /レポートを提出する/ });
    expect(other).not.toHaveAccessibleName(/緊急/);
    vi.advanceTimersByTime(500);
    fireEvent.click(other);
    expect(other).toBeChecked();
    expect(screen.getByTestId("instant-choice-badge")).toBeVisible();
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

describe("QuestChoices - 選択の強調と再抽選", () => {
  const threeChoices: QuestCandidatesResponse = {
    ...mockChoices,
    candidates: [
      ...mockCandidates,
      { ...mockCandidates[1], id: "task-3", title: "部屋の掃除をする" },
    ],
  };

  function renderChoices(pending = false) {
    const onRetry = vi.fn();
    render(
      <QuestChoices
        choices={threeChoices}
        pending={pending}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={onRetry}
        onStart={vi.fn()}
      />,
    );
    return { onRetry };
  }

  function cardOf(title: RegExp) {
    return screen.getByRole("radio", { name: title }).closest("label")!;
  }

  it("未選択ではどのカードも暗くならない", () => {
    renderChoices();
    for (const title of [/Webアプリ/, /レポート/, /部屋の掃除/]) {
      expect(cardOf(title)).toHaveAttribute("data-dimmed", "false");
      expect(cardOf(title)).toHaveAttribute("data-selected", "false");
    }
  });

  it("1つ選ぶと選ばれていないカードが暗くなり、暗いカードをタップして選び直せる", () => {
    renderChoices();
    fireEvent.click(screen.getByRole("radio", { name: /レポート/ }));
    expect(cardOf(/レポート/)).toHaveAttribute("data-selected", "true");
    expect(cardOf(/レポート/)).toHaveAttribute("data-dimmed", "false");
    expect(cardOf(/レポート/)).toHaveClass("border-gold-accent", "bg-panel-active");
    expect(cardOf(/Webアプリ/)).toHaveAttribute("data-dimmed", "true");
    expect(cardOf(/Webアプリ/)).toHaveClass("opacity-40", "grayscale");
    expect(cardOf(/部屋の掃除/)).toHaveAttribute("data-dimmed", "true");

    fireEvent.click(screen.getByRole("radio", { name: /Webアプリ/ }));
    expect(screen.getByRole("radio", { name: /Webアプリ/ })).toBeChecked();
    expect(cardOf(/Webアプリ/)).toHaveAttribute("data-dimmed", "false");
    expect(cardOf(/レポート/)).toHaveAttribute("data-dimmed", "true");
  });

  it("見出し横の再抽選アイコンで onRetry が呼ばれ、下部の再抽選ボタンは無い", () => {
    const { onRetry } = renderChoices();
    const heading = screen.getByRole("heading", { name: "クエストを選べ" });
    const header = heading.parentElement!.parentElement!;
    fireEvent.click(within(header).getByRole("button", { name: "候補を再抽選する" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /再抽選する$/ })).toHaveAccessibleName(
      "候補を再抽選する",
    );
  });

  it("抽選中は再抽選アイコンが無効になり回転する", () => {
    renderChoices(true);
    const button = screen.getByRole("button", { name: "候補を再抽選する" });
    expect(button).toBeDisabled();
    expect(button.querySelector("span")).toHaveClass("motion-safe:animate-spin");
  });

  it("長いタイトルは2行で切る", () => {
    renderChoices();
    expect(within(cardOf(/Webアプリ/)).getByText("Webアプリを完成させる")).toHaveClass(
      "line-clamp-2",
    );
  });
});
