import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestChoices } from "@/features/quest/quest-choices";
import type { QuestCandidatesResponse, Task } from "@/lib/schemas";

const sound = vi.hoisted(() => ({ playSfx: vi.fn(), vibrate: vi.fn() }));
vi.mock("@/components/ui/sound", () => sound);

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

  it("先頭の候補を3秒以内に選択したときに『即決!!』バッジが表示される", () => {
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

    expect(screen.getByTestId("instant-choice-badge")).toHaveTextContent("即決!!");
  });

  it("カード表示から3秒以内に選択すると『即決!!』バッジが表示される", () => {
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

    expect(screen.getByTestId("instant-choice-badge")).toHaveTextContent("即決!!");
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
    expect(screen.getByTestId("instant-choice-badge")).toHaveTextContent("即決!!");

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
    const heading = screen.getByRole("heading", { name: "今日の冒険を選べ" });
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
  it("「今日のクエスト候補」や視覚的な「選択する/選択中」ラベルを表示しない", () => {
    renderChoices();
    expect(screen.queryByText("今日のクエスト候補")).not.toBeInTheDocument();
    expect(screen.queryByText("選択する")).not.toBeInTheDocument();
    expect(screen.queryByText("選択中")).not.toBeInTheDocument();

    // カード選択後も「選択中」テキストは現れない
    fireEvent.click(screen.getByRole("radio", { name: /Webアプリ/ }));
    expect(screen.queryByText("選択中")).not.toBeInTheDocument();

    // ラジオボタン入力自体はスクリーンリーダー・キーボード操作用に sr-only で存在する
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(radio).toHaveClass("sr-only");
    }
  });

  it("緊急クエスト時のみ「緊急クエスト ・ 締切間近」を表示する", () => {
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
    expect(screen.getByText("緊急クエスト ・ 締切間近")).toBeInTheDocument();
    expect(screen.queryByText("今日のクエスト候補")).not.toBeInTheDocument();
  });
});

describe("QuestChoices - カードの演出", () => {
  beforeEach(() => {
    sound.playSfx.mockClear();
    sound.vibrate.mockClear();
  });

  function renderChoices(choices: QuestCandidatesResponse, onStart = vi.fn()) {
    render(
      <QuestChoices
        choices={choices}
        pending={false}
        error=""
        onAddTask={vi.fn()}
        onHome={vi.fn()}
        onRetry={vi.fn()}
        onStart={onStart}
      />,
    );
  }

  function cardOf(title: string) {
    return screen.getByRole("radio", { name: new RegExp(title) }).closest("label")!;
  }

  it("reject回数によらずレア表示や強調演出を付けず、回数は表示する", () => {
    const candidates = [
      { ...mockCandidates[0], skippedCount: 0 },
      { ...mockCandidates[1], skippedCount: 3 },
      { ...mockCandidates[1], id: "task-3", title: "部屋を片付ける", skippedCount: 5 },
    ];
    renderChoices({ ...mockChoices, candidates });

    for (const task of candidates) {
      const card = cardOf(task.title);
      expect(within(card).queryByText("レア")).not.toBeInTheDocument();
      expect(within(card).queryByText("幻")).not.toBeInTheDocument();
      expect(card).not.toHaveAttribute("data-rarity");
      expect(card.className).not.toMatch(/rarity|animate-rare-glow|animate-holo/);
      expect(within(card).getByLabelText(`reject回数 ${task.skippedCount}回`)).toHaveTextContent(
        `❌${task.skippedCount}`,
      );
    }
    expect(cardOf(candidates[0].title).className).toBe(cardOf(candidates[1].title).className);
    expect(cardOf(candidates[1].title).className).toBe(cardOf(candidates[2].title).className);
  });

  it("緊急クエストは reject回数が多くても「緊急」の見た目になる", () => {
    renderChoices({
      ...mockChoices,
      isUrgent: true,
      candidates: [{ ...mockCandidates[0], skippedCount: 6 }],
    });
    const card = cardOf("Webアプリ");
    expect(card).not.toHaveAttribute("data-rarity");
    expect(within(card).queryByText("幻")).not.toBeInTheDocument();
    expect(card.className).toContain("animate-urgent-pulse");
    expect(card).toHaveClass("border-urgent");
  });

  it("カードを表示すると効果音を 1 回鳴らす", () => {
    renderChoices(mockChoices);
    expect(sound.playSfx).toHaveBeenCalledTimes(1);
    expect(sound.playSfx).toHaveBeenCalledWith("flip");
  });

  it("カードを選ぶと選択音と振動を返す", () => {
    renderChoices(mockChoices);
    fireEvent.click(screen.getByRole("radio", { name: /レポート/ }));
    expect(sound.playSfx).toHaveBeenCalledWith("select");
    expect(sound.vibrate).toHaveBeenCalledWith(20);
  });

  it("挑戦ボタンを押すと、選ばなかったカードが崩れて消える", () => {
    renderChoices(
      mockChoices,
      vi.fn(() => new Promise<void>(() => {})),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Webアプリ/ }));
    fireEvent.click(screen.getByRole("button", { name: "このクエストに挑戦する" }));

    expect(cardOf("レポート").className).toContain("animate-dissolve");
    expect(cardOf("Webアプリ").className).not.toContain("animate-dissolve");
  });
});

describe("QuestChoices - 提示保存と演出の両立", () => {
  it("提示保存中に選んだカードは保存応答後も選択と即決表示を保持する", () => {
    const props = {
      presentationId: 1,
      error: "",
      onAddTask: vi.fn(),
      onHome: vi.fn(),
      onRetry: vi.fn(),
      onStart: vi.fn(),
    };
    sound.playSfx.mockClear();
    const { rerender } = render(
      <QuestChoices {...props} choices={mockChoices} pending startReady={false} />,
    );
    const radio = screen.getByRole("radio", { name: /Webアプリ/ });
    expect(radio).not.toBeDisabled();
    fireEvent.click(radio);
    expect(radio).toBeChecked();
    expect(screen.getByText("即決!!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).toBeDisabled();

    const saved = {
      ...mockChoices,
      candidates: mockCandidates.map((task) => ({ ...task, shownCount: task.shownCount + 1 })),
    };
    rerender(<QuestChoices {...props} choices={saved} pending={false} startReady />);
    expect(screen.getByRole("radio", { name: /Webアプリ/ })).toBeChecked();
    expect(screen.getByText("即決!!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "このクエストに挑戦する" })).not.toBeDisabled();
    expect(sound.playSfx.mock.calls.filter(([name]) => name === "flip")).toHaveLength(1);

    rerender(<QuestChoices {...props} presentationId={2} choices={saved} pending={false} />);
    expect(screen.getByRole("radio", { name: /Webアプリ/ })).not.toBeChecked();
    expect(screen.queryByText("即決!!")).not.toBeInTheDocument();
    expect(sound.playSfx.mock.calls.filter(([name]) => name === "flip")).toHaveLength(2);
  });
});
